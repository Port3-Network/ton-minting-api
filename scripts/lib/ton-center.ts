import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import * as fs from 'fs';
import { OpenedContract, Builder, Cell, contractAddress, WalletContractV4 } from 'ton';
import { KeyPair, mnemonicToWalletKey } from 'ton-crypto';
import { TonClient, TonClientParameters } from 'ton/dist/client/TonClient';
import BasicContract from './base-contract';

export class TonCenter {
    uri: string;
    workchain: number;

    ton: TonClient;
    wallet: WalletContractV4;
    keyPair: KeyPair;
    constructor() {
        this.ton = this.getClient();
        console.log(process.env.TON_SCAN_ENDPOINT)
        this.uri = process.env.TON_SCAN_ENDPOINT ? process.env.TON_SCAN_ENDPOINT : 'https://testnet.tonscan.org/address';
        this.workchain = 0;
    }

    static sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private getClient() {
        let apiKey = process.env.RPC_API_KEY;
        if (!apiKey) throw Error('Please Provide API Key For RPC');
        let param: TonClientParameters = {
            endpoint: process.env.RPC_ENDPOINT ? process.env.RPC_ENDPOINT : 'https://testnet.toncenter.com/api/v2/jsonRPC',
            apiKey: apiKey,
        };
        return new TonClient(param);
    }

    // Waiting for transaction to be packaged
    async awaitTransaction(contract: OpenedContract<WalletContractV4>, seqno: number) {
        console.log('waiting for deploy transaction to confirm...');
        let currentSeqno = seqno;
        while (currentSeqno == seqno) {
            await TonCenter.sleep(1500);
            currentSeqno = await contract.getSeqno();
        }
    }

    // get wallet infomation via mnemonic
    async getWallet(mnemonic?: string[]) {
        if (!mnemonic) {
            const mnemonicEnv = process.env.MNEMONIC;
            if (!mnemonicEnv) throw Error('Please Provide Mnemonic');
            mnemonic = mnemonicEnv.split(' ');
        }

        this.keyPair = await mnemonicToWalletKey(mnemonic);
        this.wallet = WalletContractV4.create({ publicKey: this.keyPair.publicKey, workchain: 0 });

        // check the wallet is Active
        const isDeployed = await this.ton.isContractDeployed(this.wallet.address);
        if (!isDeployed) throw Error(`Wallet ${this.wallet.address.toString()} Not Found!`);
        console.log(`Wallet address: ${this.uri}/${this.wallet.address.toString()}`);
    }

    async createContract(data: Cell, cellFile?: string): Promise<BasicContract> {
        // get contract build out from file
        let filename = cellFile ? cellFile : 'contract.cell';
        const code = Cell.fromBoc(fs.readFileSync(`output/${filename}`))[0];
        const contract = contractAddress(this.workchain, { code: code, data: data });
        console.log(`contract address: ${this.uri}/${contract.toString()}`);

        // check the contract is deployed
        const isDeployed = await this.ton.isContractDeployed(contract);
        if (isDeployed) throw Error(`Contract ${contract.toString()} Already Deployed`);

        return new BasicContract(contract, { code, data });
    }

    // Handler for contract content
    stringToCell(str: string) {
        let cell = new Builder();
        cell.storeBuffer(Buffer.from(str));
        return cell.endCell();
    }

    encodeContent(content: string) {
        let data = Buffer.from(content);
        let offChainPrefix = Buffer.from([0x01]);
        data = Buffer.concat([offChainPrefix, data]);
        return this.makeSnakeCell(data);
    }

    makeSnakeCell(data: Buffer) {
        let chunks = this.bufferToChunks(data, 127);
        let rootCell: Builder = new Builder();
        let curCell = rootCell;

        for (let i = 0; i < chunks.length; i++) {
            let chunk = chunks[i];
            curCell.storeBuffer(chunk);

            if (chunks[i + 1]) {
                let netCell: Builder = new Builder();
                curCell.storeRef(netCell);
                curCell = netCell;
            }
        }
        return rootCell.endCell();
    }

    bufferToChunks(buff: Buffer, chunkSize: number) {
        let chunks: Buffer[] = [];
        while (buff.byteLength > 0) {
            chunks.push(buff.slice(0, chunkSize));
            buff = buff.slice(chunkSize);
        }
        return chunks;
    }
}

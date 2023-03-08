import { Address, Builder, Cell, toNano } from 'ton';
import BasicContract from './lib/base-contract';
import { TonCenter } from './lib/ton-center';
import { CollectionOpCode } from './op-code';

export class CollectionMintNFT extends TonCenter {
    constructor() {
        super();
    }

    getMintBody(owner: Address) {
        let itemCell: Builder = new Builder();
        itemCell.storeBuffer(Buffer.from('1.json'));

        let nftItemCell: Builder = new Builder();
        nftItemCell.storeAddress(owner);
        nftItemCell.storeRef(itemCell);

        let bodyCell: Builder = new Builder();
        bodyCell.storeUint(CollectionOpCode.Mint, 32); // op code
        bodyCell.storeUint(0, 64); // query id -> for royalty
        bodyCell.storeUint(1, 64); // index
        bodyCell.storeCoins(toNano('0.01')); // amount
        bodyCell.storeRef(nftItemCell);
        return bodyCell.endCell();
    }

    async main() {
        await this.getWallet();

        const bodyCell = this.getMintBody(this.wallet.address);

        const contractAddress = Address.parse('EQAEdOi-1qE5KdIAv9qejm-hj64nuo8qJqQWQGNSdR8btw-c');
        const collection = new BasicContract(contractAddress);

        // get wallet params
        const walletC = this.ton.open(this.wallet);
        const seqno = await walletC.getSeqno();
        console.log(`seqno: ${seqno}`);

        // send message
        const sender = walletC.sender(this.keyPair.secretKey);
        const contract = this.ton.open(collection);
        await contract.sendMessage(sender, bodyCell);

        // waiting for tx
        await this.awaitTransaction(walletC, seqno);
        console.log('transaction confirmed!');
    }
}

new CollectionMintNFT().main();

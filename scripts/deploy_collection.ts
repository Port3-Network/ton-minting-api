import { Address, Builder, Cell } from 'ton';
import { TonCenter } from './lib/ton-center';

export class DeployCollection extends TonCenter {
    constructor() {
        super();
    }

    getDeployData(owner: Address) {
        let contentCell: Builder = new Builder();
        contentCell.storeRef(this.encodeContent('https://file-8sgle4kt.w3tools.app/ton/nft.json'));

        let royaltyCell: Builder = new Builder();
        royaltyCell.storeUint(10, 16);
        royaltyCell.storeUint(20, 16);
        royaltyCell.storeAddress(owner);

        let dataCell: Builder = new Builder();
        dataCell.storeAddress(owner); // owner_address
        dataCell.storeUint(0, 64); // next_item_index
        dataCell.storeRef(contentCell);
        dataCell.storeRef(new Cell()); // nft_item_code
        dataCell.storeRef(royaltyCell); // royalty_params

        return dataCell.endCell();
    }

    async main() {
        await this.getWallet();

        const dataCell = this.getDeployData(this.wallet.address);

        // get new contract address
        const newContract = await this.createContract(dataCell);

        // get wallet params
        const walletC = this.ton.open(this.wallet);
        const seqno = await walletC.getSeqno();
        console.log(`seqno: ${seqno}`);

        // deploy
        const sender = walletC.sender(this.keyPair.secretKey);
        const contract = this.ton.open(newContract);
        await contract.sendDeploy(sender);

        // waiting for tx
        await this.awaitTransaction(walletC, seqno);
        console.log('transaction confirmed!');
    }

}

new DeployCollection().main();

import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { Config } from './config';

import AgroasysEscrow  from './abi/AgroasysEscrow.json';

export class Client {
    protected provider: JsonRpcProvider;
    protected signer: Wallet;
    protected contract: Contract;
  
    constructor(protected config: Config) {
        this.provider = new ethers.JsonRpcProvider(config.rpc);
        this.signer = new Wallet(config.privateKey, this.provider);
        this.contract = new ethers.Contract(config.escrowAddress,AgroasysEscrow.abi,this.provider).connect(this.signer) as Contract;
    }
}
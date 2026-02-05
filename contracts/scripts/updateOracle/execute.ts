import {ethers} from "hardhat";

async function main(){
    const [admin1] = await ethers.getSigners();

    const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";

    console.log("Admin1 address:", admin1.address);
    const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

    const proposalId = 0;

    console.log(`\nexecute oracle update proposal ${proposalId}`);
    const tx = await escrow.executeOracleUpdate(proposalId);

    const receipt = await tx.wait();
    console.log("Oracle updated");
    console.log("Transaction hash:", receipt?.hash);
    console.log("Block number:", receipt?.blockNumber);
    
    const newOracle = await escrow.oracleAddress();
    console.log("New oracle address:", newOracle);
}

main().catch(console.error);
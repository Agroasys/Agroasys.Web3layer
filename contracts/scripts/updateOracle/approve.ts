import {ethers} from "hardhat";

async function main(){
    const [, admin2] = await ethers.getSigners();

    const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";

    console.log("Admin2 address:", admin2.address);
    const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

    const proposalId = 0;

    console.log(`\napprove oracle update proposal ${proposalId}`);
    const tx = await escrow.connect(admin2).approveOracleUpdate(proposalId);

    const receipt = await tx.wait();
    console.log("Oracle update approved");
    console.log("Transaction hash:", receipt?.hash);
    console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);
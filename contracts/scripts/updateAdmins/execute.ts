import {ethers} from "hardhat";

async function main(){
    const [admin1] = await ethers.getSigners();

    const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";

    console.log("Admin1 address:", admin1.address);
    const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

    const proposalId = 0;

    console.log(`\nexecute admin add proposal ${proposalId}`);
    const tx = await escrow.executeAddAdmin(proposalId);

    const receipt = await tx.wait();
    console.log("Admin added");
    console.log("Transaction hash:", receipt?.hash);
    console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);
import {ethers} from "hardhat";

const DisputeStatus = {
  REFUND: 0,
  RESOLVE: 1
};

async function main(){
    const [admin1] = await ethers.getSigners();

    const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";

    console.log("Admin1 address:", admin1.address);
    const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

    const tradeId = 1;

    console.log(`\npropose solution for trade ${tradeId}`);
    const tx = await escrow.proposeDisputeSolution(tradeId, DisputeStatus.RESOLVE);

    const receipt = await tx.wait();
    console.log("Arrival confirmed");
    console.log("Transaction hash:", receipt?.hash);
    console.log("Block number:", receipt?.blockNumber);
}


main().catch(console.error);
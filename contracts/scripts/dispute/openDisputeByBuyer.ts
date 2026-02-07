import { ethers } from "hardhat";

async function main() {
  const [buyer] = await ethers.getSigners();
  
  const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";
  
  console.log("Buyer address:", buyer.address);
  const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

  const tradeId = 1;

  console.log(`\nopening dispute for trade ${tradeId}`);
  
  const tx = await escrow.openDispute(tradeId);
  
  const receipt = await tx.wait();
  console.log("Dispute opened");
  console.log("Transaction hash:", receipt?.hash);
  console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);

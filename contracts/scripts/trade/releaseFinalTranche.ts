import { ethers } from "hardhat";

async function main() {
  const [caller] = await ethers.getSigners();
  
  const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";
  
  console.log("Caller address:", caller.address);
  const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

  const tradeId = 0;


  console.log(`\nfinalizing trade ${tradeId}`);
  const tx = await escrow.finalizeAfterDisputeWindow(tradeId);
  
  const receipt = await tx.wait();
  console.log("Final tranche released");
  console.log("Transaction hash:", receipt?.hash);
  console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);
import { ethers } from "hardhat";

async function main() {
  const [oracle] = await ethers.getSigners();
  
  const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";
  
  console.log("oracle address:", oracle.address);
  const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);

  const tradeId = 0;

  console.log(`\nreleasing Stage 1 funds for trade ${tradeId}`);
  const tx = await escrow.releaseFundsStage1(tradeId);
  
  const receipt = await tx.wait();
  console.log("Stage 1 funds released");
  console.log("Transaction hash:", receipt?.hash);
  console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);
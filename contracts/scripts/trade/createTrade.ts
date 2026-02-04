import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a";
  const USDC_ADDRESS = "0xEea5766E43D0c7032463134Afc121e63C9f9C260";
  
  console.log("deployer address:", deployer.address);
  
  const escrow = await ethers.getContractAt("AgroasysEscrow", ESCROW_ADDRESS);
  const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

  console.log("\nmint test USDC");
  const totalAmount = ethers.parseUnits("10000", 6);
  const mintTx = await usdc.mint(deployer.address, totalAmount);
  await mintTx.wait();
  console.log("minted 10,000 USDC");

  console.log("\napprove escrow");
  const approveTx = await usdc.approve(ESCROW_ADDRESS, totalAmount);
  await approveTx.wait();
  console.log("approved escrow to spend USDC");

  console.log("\nprepare trade parameters");
  const supplier = "0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c";
  const logisticsAmount = ethers.parseUnits("1000", 6);
  const platformFeesAmount = ethers.parseUnits("500", 6);
  const supplierFirstTranche = ethers.parseUnits("4000", 6);
  const supplierSecondTranche = ethers.parseUnits("4500", 6);
  const ricardianHash = ethers.keccak256(ethers.toUtf8Bytes("test-contract-v1"));
  
  const buyerNonce = await escrow.getBuyerNonce(deployer.address);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const treasuryAddress = await escrow.treasuryAddress();
  
  console.log("\nsign trade message");
  
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const messageHash = ethers.keccak256(
    abiCoder.encode(
      ["uint256", "address", "address", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32", "uint256", "uint256"],
      [
        420420417,
        ESCROW_ADDRESS,
        deployer.address,
        supplier,
        treasuryAddress,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        buyerNonce,
        deadline
      ]
    )
  );
  
  const signature = await deployer.signMessage(ethers.getBytes(messageHash));
  console.log("signature created");

  console.log("\ncreate trade (emit TradeLocked event)");
  const createTx = await escrow.createTrade(
    supplier,
    totalAmount,
    logisticsAmount,
    platformFeesAmount,
    supplierFirstTranche,
    supplierSecondTranche,
    ricardianHash,
    buyerNonce,
    deadline,
    signature
  );
  
  const receipt = await createTx.wait();
  console.log("Trade created");
  console.log("Transaction hash:", receipt?.hash);
  console.log("Block number:", receipt?.blockNumber);
}

main().catch(console.error);
import { expect } from "chai";
import { ethers } from "hardhat";
import { AgroasysEscrow, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgroasysEscrow", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;


  async function createSignature(
    signer: SignerWithAddress,
    contractAddr: string,
    buyerAddr: string,
    supplierAddr: string,
    totalAmount: bigint,
    logisticsAmount: bigint,
    platformFeesAmount: bigint,
    supplierFirstTranche: bigint,
    supplierSecondTranche: bigint,
    ricardianHash: string,
    nonce: bigint,
    deadline: bigint
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const treasuryAddr = treasury.address;

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "uint256", "address", "address", "address", "address",
        "uint256", "uint256", "uint256", "uint256", "uint256",
        "bytes32", "uint256", "uint256"
      ],
      [
        chainId,
        contractAddr,
        buyerAddr,
        supplierAddr,
        treasuryAddr,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        nonce,
        deadline
      ]
    );

    const messageHash = ethers.keccak256(encoded);
    return await signer.signMessage(ethers.toBeArray(messageHash));
  }

  beforeEach(async function () {
    [buyer, supplier, treasury, oracle, admin1, admin2, admin3] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    const admins = [admin1.address, admin2.address, admin3.address];
    escrow = await EscrowFactory.deploy(
      await usdc.getAddress(),
      oracle.address,
      treasury.address,
      admins,
      2
    );
    await escrow.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set correct initial values", async function () {
      expect(await escrow.oracleAddress()).to.equal(oracle.address);
      expect(await escrow.treasuryAddress()).to.equal(treasury.address);
      expect(await escrow.requiredApprovals()).to.equal(2);
      expect(await escrow.governanceTimelock()).to.equal(24 * 3600);
      expect(await escrow.isAdmin(admin1.address)).to.be.true;
      expect(await escrow.isAdmin(admin2.address)).to.be.true;
      expect(await escrow.isAdmin(admin3.address)).to.be.true;
    });

    it("Should reject invalid constructor params", async function () {
      const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
      
      await expect(
        EscrowFactory.deploy(ethers.ZeroAddress, oracle.address, treasury.address, [admin1.address], 1)
      ).to.be.revertedWith("invalid token");

      await expect(
        EscrowFactory.deploy(await usdc.getAddress(), ethers.ZeroAddress, treasury.address, [admin1.address], 1)
      ).to.be.revertedWith("invalid oracle");

      await expect(
        EscrowFactory.deploy(await usdc.getAddress(), oracle.address, ethers.ZeroAddress, [admin1.address], 1)
      ).to.be.revertedWith("invalid treasury");

      await expect(
        EscrowFactory.deploy(await usdc.getAddress(), oracle.address, treasury.address, [admin1.address], 0)
      ).to.be.revertedWith("required approvals must be > 0");

      await expect(
        EscrowFactory.deploy(await usdc.getAddress(), oracle.address, treasury.address, [admin1.address], 3)
      ).to.be.revertedWith("not enough admins");
    });
  });

  describe("createTrade", function () {
    const totalAmount = ethers.parseUnits("107000", 6);
    const logisticsAmount = ethers.parseUnits("5000", 6);
    const platformFeesAmount = ethers.parseUnits("2000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const supplierSecondTranche = ethers.parseUnits("60000", 6);
    const ricardianHash = ethers.id("trade-contract-hash");

    it("Should create a trade with valid signature", async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer,
        await escrow.getAddress(),
        buyer.address,
        supplier.address,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        nonce,
        deadline
      );

      const tx = await escrow.connect(buyer).createTrade(
        supplier.address,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        nonce,
        deadline,
        signature
      );

      await expect(tx)
        .to.emit(escrow, "TradeLocked")
        .withArgs(
          0,
          buyer.address,
          supplier.address,
          totalAmount,
          logisticsAmount,
          platformFeesAmount,
          supplierFirstTranche,
          supplierSecondTranche,
          ricardianHash
        );

      const trade = await escrow.trades(0);
      expect(trade.tradeId).to.equal(0);
      expect(trade.status).to.equal(0); // LOCKED
      expect(trade.buyerAddress).to.equal(buyer.address);
      expect(trade.supplierAddress).to.equal(supplier.address);
      expect(trade.totalAmountLocked).to.equal(totalAmount);
      expect(await escrow.getBuyerNonce(buyer.address)).to.equal(nonce + 1n);
    });

    it("Should create multiple trades with incrementing nonces", async function () {
      const amount = ethers.parseUnits("107000", 6);
      const hash1 = ethers.id("hash1");
      const hash2 = ethers.id("hash2");

      await usdc.connect(buyer).approve(await escrow.getAddress(), amount * 2n);

      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);

      const nonce0 = await escrow.getBuyerNonce(buyer.address);

      // First trade with nonce 0
      const sig1 = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        amount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash1, nonce0, deadline
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, amount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash1, nonce0, deadline, sig1
      );

      const nonce1 = await escrow.getBuyerNonce(buyer.address);
      // Second trade with nonce 1
      const sig2 = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        amount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash2, nonce1, deadline
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, amount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash2, nonce1, deadline, sig2
      );

      expect(await escrow.tradeCounter()).to.equal(2);
      expect(await escrow.getBuyerNonce(buyer.address)).to.equal(2);
    });

    it("Should reject invalid signature (wrong signer)", async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      // Signature from wrong signer
      const signature = await createSignature(
        supplier, // wrong signer
        await escrow.getAddress(),
        buyer.address,
        supplier.address,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        nonce,
        deadline
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, totalAmount, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ricardianHash,
          nonce, deadline, signature
        )
      ).to.be.revertedWith("bad signature");
    });

    it("Should reject replay signature", async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer,
        await escrow.getAddress(),
        buyer.address,
        supplier.address,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        nonce,
        deadline
      );

      const tx = await escrow.connect(buyer).createTrade(
        supplier.address,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        nonce,
        deadline,
        signature
      );

      await expect(tx)
        .to.emit(escrow, "TradeLocked")
        .withArgs(
          0,
          buyer.address,
          supplier.address,
          totalAmount,
          logisticsAmount,
          platformFeesAmount,
          supplierFirstTranche,
          supplierSecondTranche,
          ricardianHash
        );

      // try to create a trade with the same signature
      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, totalAmount, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ricardianHash,
          nonce, deadline, signature
        )
      ).to.be.revertedWith("bad nonce"); // got rejected because of the nonce
    });


    it("Should reject with invalid parameters (zero addresses, bad hash, mismatched amounts)", async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);

      await expect(
        escrow.connect(buyer).createTrade(
          ethers.ZeroAddress, totalAmount, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ricardianHash,
          nonce, deadline, "0x00"
        )
      ).to.be.revertedWith("supplier required");

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, totalAmount, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ethers.ZeroHash,
          nonce, deadline, "0x00"
        )
      ).to.be.revertedWith("ricardian hash required");

      const wrongTotal = ethers.parseUnits("100000", 6);
      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, wrongTotal, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ricardianHash,
          nonce, deadline, "0x00"
        )
      ).to.be.revertedWith("breakdown mismatch");
    });

    it("Should reject with bad nonce", async function () {
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);
      const wrongNonce = 5n;

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ricardianHash,
        wrongNonce, deadline
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, totalAmount, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ricardianHash,
          wrongNonce, deadline, signature
        )
      ).to.be.revertedWith("bad nonce");
    });

    it("Should reject expired signature", async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const expiredDeadline = BigInt(blockTimestamp - 100);

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ricardianHash,
        nonce, expiredDeadline
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, totalAmount, logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, ricardianHash,
          nonce, expiredDeadline, signature
        )
      ).to.be.revertedWith("signature expired");
    });
  });

  describe("Complete Flow (Without dispute)", function () {
    let tradeId: bigint;
    const totalAmount = ethers.parseUnits("107000", 6);
    const logisticsAmount = ethers.parseUnits("5000", 6);
    const platformFeesAmount = ethers.parseUnits("2000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const supplierSecondTranche = ethers.parseUnits("60000", 6);

    beforeEach(async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);
      const ricardianHash = ethers.id("trade-hash");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ricardianHash,
        nonce, deadline
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ricardianHash,
        nonce, deadline, signature
      );

      tradeId = 0n;
    });

    it("Should complete full trade lifecycle without dispute", async function () {
      const supplierBalBefore = await usdc.balanceOf(supplier.address);
      const treasuryBalBefore = await usdc.balanceOf(treasury.address);

      await expect(escrow.connect(oracle).releaseFundsStage1(tradeId))
        .to.emit(escrow, "FundsReleasedStage1")
        .and.to.emit(escrow, "PlatformFeesPaidStage1");

      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalBefore + supplierFirstTranche
      );
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalBefore + logisticsAmount + platformFeesAmount
      );

      let trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(1); // IN_TRANSIT

      await expect(escrow.connect(oracle).confirmArrival(tradeId))
        .to.emit(escrow, "ArrivalConfirmed");

      trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(2); // ARRIVAL_CONFIRMED

      await time.increase(24 * 3600 + 1);

      const supplierBalBeforeStage2 = await usdc.balanceOf(supplier.address);

      await expect(escrow.connect(buyer).finalizeAfterDisputeWindow(tradeId))
        .to.emit(escrow, "FinalTrancheReleased");

      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalBeforeStage2 + supplierSecondTranche
      );

      trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(4); // CLOSED
    });
  });

  describe("releaseFundsStage1", function () {
    let tradeId: bigint;

    beforeEach(async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);
      const totalAmount = ethers.parseUnits("107000", 6);
      const ricardianHash = ethers.id("trade-hash");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        totalAmount, ethers.parseUnits("5000", 6), ethers.parseUnits("2000", 6),
        ethers.parseUnits("40000", 6), ethers.parseUnits("60000", 6),
        ricardianHash, nonce, deadline
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, totalAmount, ethers.parseUnits("5000", 6),
        ethers.parseUnits("2000", 6), ethers.parseUnits("40000", 6),
        ethers.parseUnits("60000", 6), ricardianHash, nonce, deadline, signature
      );

      tradeId = 0n;
    });

    it("Should reject if not oracle", async function () {
      await expect(
        escrow.connect(buyer).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("only oracle");
    });

    it("Should reject if wrong status", async function () {
      await escrow.connect(oracle).releaseFundsStage1(tradeId);

      await expect(
        escrow.connect(oracle).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("status must be LOCKED");
    });
  });

  describe("confirmArrival", function () {
    let tradeId: bigint;

    beforeEach(async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);
      const totalAmount = ethers.parseUnits("107000", 6);
      const ricardianHash = ethers.id("trade-hash");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        totalAmount, ethers.parseUnits("5000", 6), ethers.parseUnits("2000", 6),
        ethers.parseUnits("40000", 6), ethers.parseUnits("60000", 6),
        ricardianHash, nonce, deadline
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, totalAmount, ethers.parseUnits("5000", 6),
        ethers.parseUnits("2000", 6), ethers.parseUnits("40000", 6),
        ethers.parseUnits("60000", 6), ricardianHash, nonce, deadline, signature
      );

      tradeId = 0n;
      await escrow.connect(oracle).releaseFundsStage1(tradeId);
    });

    it("Should confirm arrival", async function () {
      await expect(escrow.connect(oracle).confirmArrival(tradeId))
        .to.emit(escrow, "ArrivalConfirmed");

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(2); // ARRIVAL_CONFIRMED
      expect(trade.arrivalTimestamp).to.be.gt(0);
    });

    it("Should reject if not oracle", async function () {
      await expect(
        escrow.connect(buyer).confirmArrival(tradeId)
      ).to.be.revertedWith("only oracle");
    });

    it("Should reject if wrong status", async function () {
      await escrow.connect(oracle).confirmArrival(tradeId);

      await expect(
        escrow.connect(oracle).confirmArrival(tradeId)
      ).to.be.revertedWith("status must be IN_TRANSIT");
    });
  });

  describe("Dispute Flow", function () {
    let tradeId: bigint;
    const supplierSecondTranche = ethers.parseUnits("60000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const logistics = ethers.parseUnits("5000", 6);
    const fees = ethers.parseUnits("2000", 6);
    const totalAmount = ethers.parseUnits("107000", 6);

    beforeEach(async function () {
      const nonce = await escrow.getBuyerNonce(buyer.address);
      const blockTimestamp = (await ethers.provider.getBlock('latest'))!.timestamp;
      const deadline = BigInt(blockTimestamp + 3600);
      const ricardianHash = ethers.id("trade-hash");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, await escrow.getAddress(), buyer.address, supplier.address,
        totalAmount,logistics, fees,
        supplierFirstTranche, supplierSecondTranche,
        ricardianHash, nonce, deadline
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, totalAmount, logistics,
        fees, supplierFirstTranche,
        supplierSecondTranche, ricardianHash, nonce, deadline, signature
      );

      tradeId = 0n;
      await escrow.connect(oracle).releaseFundsStage1(tradeId);
      await escrow.connect(oracle).confirmArrival(tradeId);
    });

    it("Should allow buyer to open dispute within 24h", async function () {
      await expect(escrow.connect(buyer).openDispute(tradeId))
        .to.emit(escrow, "DisputeOpenedByBuyer");

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(3); // FROZEN
    });

    it("Should reject dispute after 24h window", async function () {
      await time.increase(24 * 3600 + 1);

      await expect(
        escrow.connect(buyer).openDispute(tradeId)
      ).to.be.revertedWith("window closed");
    });

    it("Should reject dispute from non-buyer", async function () {
      await expect(
        escrow.connect(supplier).openDispute(tradeId)
      ).to.be.revertedWith("only buyer");
    });

    it("Should refund buyer after dispute REFUND resolution", async function () {
      await escrow.connect(buyer).openDispute(tradeId);

      const buyerBalBefore = await usdc.balanceOf(buyer.address);

      // propose REFUND
      await escrow.connect(admin1).proposeDisputeSolution(tradeId, 0); // REFUND
      
      await escrow.connect(admin2).approveDisputeSolution(0);

      expect(await usdc.balanceOf(buyer.address)).to.equal(
        buyerBalBefore + supplierSecondTranche
      );

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(4); // CLOSED
    });

    it("Should pay supplier after dispute RESOLVE resolution", async function () {
      await escrow.connect(buyer).openDispute(tradeId);

      const supplierBalBefore = await usdc.balanceOf(supplier.address);

      // propose RESOLVE
      await escrow.connect(admin1).proposeDisputeSolution(tradeId, 1); // RESOLVE
      
      await escrow.connect(admin2).approveDisputeSolution(0);

      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalBefore + supplierSecondTranche
      );

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(4); // CLOSED
    });

    it("Should reject dispute proposal from non-admin", async function () {
      await escrow.connect(buyer).openDispute(tradeId);

      await expect(
        escrow.connect(buyer).proposeDisputeSolution(tradeId, 0)
      ).to.be.revertedWith("only admin");
    });

    it("Should reject dispute approval from non-admin", async function () {
      await escrow.connect(buyer).openDispute(tradeId);
      await escrow.connect(admin1).proposeDisputeSolution(tradeId, 0);

      await expect(
        escrow.connect(buyer).approveDisputeSolution(0)
      ).to.be.revertedWith("only admin");
    });
  });

  describe("Governance: Oracle Update", function () {
    it("Should update oracle with timelock", async function () {
      const newOracle = admin3.address;

      await escrow.connect(admin1).proposeOracleUpdate(newOracle);

      await escrow.connect(admin2).approveOracleUpdate(0);

      await time.increase(24 * 3600 + 1);

      await expect(escrow.connect(admin1).executeOracleUpdate(0))
        .to.emit(escrow, "OracleUpdated")
        .withArgs(oracle.address, newOracle);

      expect(await escrow.oracleAddress()).to.equal(newOracle);
    });

    it("Should reject execution before timelock", async function () {
      const newOracle = admin3.address;

      await escrow.connect(admin1).proposeOracleUpdate(newOracle);
      await escrow.connect(admin2).approveOracleUpdate(0);

      await expect(
        escrow.connect(admin1).executeOracleUpdate(0)
      ).to.be.revertedWith("timelock not elapsed");
    });

    it("Should reject oracle update from non-admin", async function () {
      await expect(
        escrow.connect(buyer).proposeOracleUpdate(admin3.address)
      ).to.be.revertedWith("only admin");
    });
  });

  describe("Governance: Add Admin", function () {
    it("Should add new admin with timelock", async function () {
      const newAdmin = buyer.address;

      await escrow.connect(admin1).proposeAddAdmin(newAdmin);

      await escrow.connect(admin2).approveAddAdmin(0);

      await time.increase(24 * 3600 + 1);

      await expect(escrow.connect(admin1).executeAddAdmin(0))
        .to.emit(escrow, "AdminAdded")
        .withArgs(newAdmin);

      expect(await escrow.isAdmin(newAdmin)).to.be.true;
    });

    it("Should reject add admin from non-admin", async function () {
      await expect(
        escrow.connect(buyer).proposeAddAdmin(buyer.address)
      ).to.be.revertedWith("only admin");
    });
  });
});
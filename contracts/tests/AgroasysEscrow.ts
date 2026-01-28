import { expect } from "chai";
import { ethers } from "hardhat";
import { AgroasysEscrow, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("AgroasysEscrow: createTrade", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;

  beforeEach(async function () {
    [buyer, supplier, treasury, oracle, admin1, admin2, admin3] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    const admins = [admin1.address, admin2.address, admin3.address];
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address, admins, 2);
    await escrow.waitForDeployment();
  });

  // hepler function to create signature
  async function createSignature(
    signer: SignerWithAddress,
    tradeId: bigint,
    supplierAddr: string,
    treasuryAddr: string,
    totalAmount: bigint,
    logisticsAmount: bigint,
    platformFeesAmount: bigint,
    supplierFirstTranche: bigint,
    supplierSecondTranche: bigint,
    ricardianHash: string
  ) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [tradeId, supplierAddr, treasuryAddr, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash]
    );
    return await signer.signMessage(ethers.toBeArray(messageHash));
  }

  describe("Success:", function () {
    it("Should create a trade successfully with valid signature", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("107000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("60000", 6);
      const ricardianHash = ethers.id("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, tradeId, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ricardianHash
      );

      const tx = await escrow.connect(buyer).createTrade(
        supplier.address,
        treasury.address,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash,
        signature
      );

      await expect(tx)
        .to.emit(escrow, "TradeLocked")
        .withArgs(0, buyer.address, supplier.address, treasury.address, totalAmount, ricardianHash);

      const trade = await escrow.trades(0);
      expect(trade.tradeId).to.equal(0);
      expect(trade.ricardianHash).to.equal(ricardianHash);
      expect(trade.status).to.equal(0); // LOCKED
      expect(trade.buyerAddress).to.equal(buyer.address);
      expect(trade.supplierAddress).to.equal(supplier.address);
      expect(trade.treasuryAddress).to.equal(treasury.address);
      expect(trade.totalAmountLocked).to.equal(totalAmount);
      expect(trade.logisticsAmount).to.equal(logisticsAmount);
      expect(trade.platformFeesAmount).to.equal(platformFeesAmount);
      expect(trade.supplierFirstTranche).to.equal(supplierFirstTranche);
      expect(trade.supplierSecondTranche).to.equal(supplierSecondTranche);
      expect(trade.arrivalTimestamp).to.equal(0);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(totalAmount);
      expect(await usdc.balanceOf(buyer.address)).to.equal(ethers.parseUnits("893000", 6));
      expect(await escrow.tradeCounter()).to.equal(1);
    });

    it("Should create multiple trades", async function () {
      const amount = ethers.parseUnits("50000", 6);
      const logisticsAmount = ethers.parseUnits("2000", 6);
      const platformFeesAmount = ethers.parseUnits("1000", 6);
      const firstTranche = ethers.parseUnits("20000", 6);
      const secondTranche = ethers.parseUnits("27000", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), amount * 2n);

      const ricardianHash1 = ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014");
      const ricardianHash2 = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      const sig1 = await createSignature(
        buyer, 0n, supplier.address, treasury.address,
        amount, logisticsAmount, platformFeesAmount, firstTranche, secondTranche, ricardianHash1
      );

      const sig2 = await createSignature(
        buyer, 1n, supplier.address, treasury.address,
        amount, logisticsAmount, platformFeesAmount, firstTranche, secondTranche, ricardianHash2
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, treasury.address, amount,
        logisticsAmount, platformFeesAmount, firstTranche, secondTranche, ricardianHash1, sig1
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, treasury.address, amount,
        logisticsAmount, platformFeesAmount, firstTranche, secondTranche, ricardianHash2, sig2
      );

      expect(await escrow.tradeCounter()).to.equal(2);

      const trade0 = await escrow.trades(0);
      const trade1 = await escrow.trades(1);

      expect(trade0.ricardianHash).to.equal(ricardianHash1);
      expect(trade1.ricardianHash).to.equal(ricardianHash2);
    });
  });

  describe("Failure:", function () {
    it("Should reject invalid signature", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("107000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("60000", 6);
      const hash = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      // wrong signer
      const wrongSignature = await createSignature(
        supplier, tradeId, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, treasury.address, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche,
          hash, wrongSignature
        )
      ).to.be.revertedWith("incorrect signature");
    });

    it("Should reject invalid ricardian hash (bytes32(0))", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("100000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("53000", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, tradeId, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ethers.ZeroHash
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, treasury.address, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche,
          ethers.ZeroHash, signature
        )
      ).to.be.revertedWith("valid ricardian hash is required");
    });

    it("Should reject invalid supplier address (address(0))", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("100000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("53000", 6);
      const hash = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, tradeId, ethers.ZeroAddress, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash
      );

      await expect(
        escrow.connect(buyer).createTrade(
          ethers.ZeroAddress, treasury.address, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, hash, signature
        )
      ).to.be.revertedWith("valid supplier address is required");
    });

    it("Should reject invalid treasury address (address(0))", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("100000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("53000", 6);
      const hash = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, tradeId, supplier.address, ethers.ZeroAddress,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, ethers.ZeroAddress, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, hash, signature
        )
      ).to.be.revertedWith("valid treasury address is required");
    });

    it("Should reject mismatched amounts (sum != total)", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("100000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("50000", 6);
      const hash = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, tradeId, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, treasury.address, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, hash, signature
        )
      ).to.be.revertedWith("total amount and payement breakdown are different");
    });

    it("Should reject without USDC approval", async function () {
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("107000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("60000", 6);
      const hash = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      // buyer should approve the contract

      const signature = await createSignature(
        buyer, tradeId, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash
      );

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address, treasury.address, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, hash, signature
        )
      ).to.be.reverted;
    });

    it("Should reject with insufficient USDC balance", async function () {
      // let's set admin3 as a buyer (admin hasn't usdc)
      const tradeId = await escrow.getNextTradeId();
      const totalAmount = ethers.parseUnits("107000", 6);
      const logisticsAmount = ethers.parseUnits("5000", 6);
      const platformFeesAmount = ethers.parseUnits("2000", 6);
      const supplierFirstTranche = ethers.parseUnits("40000", 6);
      const supplierSecondTranche = ethers.parseUnits("60000", 6);
      const hash = ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752");

      await usdc.connect(admin3).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        admin3, tradeId, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, hash
      );

      await expect(
        escrow.connect(admin3).createTrade(
          supplier.address, treasury.address, totalAmount,
          logisticsAmount, platformFeesAmount,
          supplierFirstTranche, supplierSecondTranche, hash, signature
        )
      ).to.be.reverted;
    });
  });
});


describe("AgroasysEscrow: releaseFundsStage1", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;
  let tradeId: bigint;

  // helper function to create signature
  async function createSignature(
    signer: SignerWithAddress,
    tradeId: bigint,
    supplierAddr: string,
    treasuryAddr: string,
    totalAmount: bigint,
    logisticsAmount: bigint,
    platformFeesAmount: bigint,
    supplierFirstTranche: bigint,
    supplierSecondTranche: bigint,
    ricardianHash: string
  ) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [tradeId, supplierAddr, treasuryAddr, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash]
    );
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
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address, admins, 2);
    await escrow.waitForDeployment();

    const totalAmount = ethers.parseUnits("107000", 6);
    const logisticsAmount = ethers.parseUnits("5000", 6);
    const platformFeesAmount = ethers.parseUnits("2000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const supplierSecondTranche = ethers.parseUnits("60000", 6);
    const ricardianHash = ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014");

    await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

    const signature = await createSignature(
      buyer, 0n, supplier.address, treasury.address,
      totalAmount, logisticsAmount, platformFeesAmount,
      supplierFirstTranche, supplierSecondTranche, ricardianHash
    );

    await escrow.connect(buyer).createTrade(
      supplier.address,
      treasury.address,
      totalAmount,
      logisticsAmount,
      platformFeesAmount,
      supplierFirstTranche,
      supplierSecondTranche,
      ricardianHash,
      signature
    );

    tradeId = 0n;
  });

  describe("Success:", function () {
    it("Should release stage 1 funds", async function () {
      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);
      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);
      const escrowBalanceBefore = await usdc.balanceOf(await escrow.getAddress());

      const tx = await escrow.connect(oracle).releaseFundsStage1(tradeId);

      await expect(tx)
        .to.emit(escrow, "FundsReleasedStage1")
        .withArgs(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(1); // IN_TRANSIT

      // check if treasury received logistics fees
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + trade.logisticsAmount
      );

      // check if supplier received first tranche
      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + ethers.parseUnits("40000", 6)
      );

      // check if escrow balance decreased correctly
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(
        escrowBalanceBefore - trade.supplierFirstTranche - trade.logisticsAmount
      );

      // check if remaining amount in the escrow is correct
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(
        trade.supplierSecondTranche + trade.platformFeesAmount
      );
    });
  });

  describe("Failure:", function () {
    it("Should reject if caller is not oracle", async function () {
      await expect(
        escrow.connect(buyer).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("Only oracle can call");

      await expect(
        escrow.connect(supplier).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("Only oracle can call");

      await expect(
        escrow.connect(admin1).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("Only oracle can call");
    });

    it("Should reject if trade doesn't exist", async function () {
      await expect(
        escrow.connect(oracle).releaseFundsStage1(999)
      ).to.be.revertedWith("trade doesn't exist");
    });

    it("Should reject if status is IN_TRANSIT", async function () {
      await escrow.connect(oracle).releaseFundsStage1(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(1); // IN_TRANSIT

      await expect(
        escrow.connect(oracle).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("trade status should be LOCKED");
    });

    it("Should reject if status is ARRIVAL_CONFIRMED", async function () {
      await escrow.connect(oracle).releaseFundsStage1(tradeId);
      await escrow.connect(oracle).confirmArrival(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(2); // ARRIVAL_CONFIRMED

      await expect(
        escrow.connect(oracle).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("trade status should be LOCKED");
    });


    it("Should reject if status is CLOSED", async function () {
      await escrow.connect(oracle).releaseFundsStage1(tradeId);
      await escrow.connect(oracle).confirmArrival(tradeId);
      
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      
      await escrow.connect(oracle).releaseFundsStage2(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(4); // CLOSED

      await expect(
        escrow.connect(oracle).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("trade status should be LOCKED");
    });

    it("Should reject if status is FROZEN", async function () {
      await escrow.connect(oracle).releaseFundsStage1(tradeId);
      await escrow.connect(oracle).confirmArrival(tradeId);
      await escrow.connect(buyer).openDispute(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(3); // FROZEN

      await expect(
        escrow.connect(oracle).releaseFundsStage1(tradeId)
      ).to.be.revertedWith("trade status should be LOCKED");
    });
  });
});



describe("AgroasysEscrow: confirmArrival", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;
  let tradeId: bigint;

  // helper function to create signature
  async function createSignature(
    signer: SignerWithAddress,
    tradeId: bigint,
    supplierAddr: string,
    treasuryAddr: string,
    totalAmount: bigint,
    logisticsAmount: bigint,
    platformFeesAmount: bigint,
    supplierFirstTranche: bigint,
    supplierSecondTranche: bigint,
    ricardianHash: string
  ) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [tradeId, supplierAddr, treasuryAddr, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash]
    );
    return await signer.signMessage(ethers.toBeArray(messageHash));
  }

  beforeEach(async function () {
    //complete flow before comfirm arrival
    [buyer, supplier, treasury, oracle, admin1, admin2, admin3] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    const admins = [admin1.address, admin2.address, admin3.address];
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address, admins, 2);
    await escrow.waitForDeployment();

    const totalAmount = ethers.parseUnits("107000", 6);
    const logisticsAmount = ethers.parseUnits("5000", 6);
    const platformFeesAmount = ethers.parseUnits("2000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const supplierSecondTranche = ethers.parseUnits("60000", 6);
    const ricardianHash = ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014");

    await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

    const signature = await createSignature(
      buyer, 0n, supplier.address, treasury.address,
      totalAmount, logisticsAmount, platformFeesAmount,
      supplierFirstTranche, supplierSecondTranche, ricardianHash
    );

    await escrow.connect(buyer).createTrade(
      supplier.address,
      treasury.address,
      totalAmount,
      logisticsAmount,
      platformFeesAmount,
      supplierFirstTranche,
      supplierSecondTranche,
      ricardianHash,
      signature
    );

    tradeId = 0n;

    await escrow.connect(oracle).releaseFundsStage1(tradeId);
  });

  describe("Success:", function () {
    it("Should confirm arrival and start 24h dispute window", async function () {
      const tx = await escrow.connect(oracle).confirmArrival(tradeId);

      await expect(tx)
        .to.emit(escrow, "ArrivalConfirmed")
        .withArgs(tradeId);

      const trade = await escrow.trades(tradeId);
      
      expect(trade.status).to.equal(2); // ARRIVAL_CONFIRMED

      expect(trade.arrivalTimestamp).to.be.greaterThan(0);
    });
  });

  describe("Failure:", function () {
    it("Should reject if caller is not oracle", async function () {
      await expect(
        escrow.connect(buyer).confirmArrival(tradeId)
      ).to.be.revertedWith("Only oracle can call");

      await expect(
        escrow.connect(supplier).confirmArrival(tradeId)
      ).to.be.revertedWith("Only oracle can call");

      await expect(
        escrow.connect(admin1).confirmArrival(tradeId)
      ).to.be.revertedWith("Only oracle can call");
    });

    it("Should reject if trade doesn't exist", async function () {
      await expect(
        escrow.connect(oracle).confirmArrival(999)
      ).to.be.revertedWith("trade doesn't exist");
    });

    it("Should reject if already called", async function () {
      await escrow.connect(oracle).confirmArrival(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(2); // ARRIVAL_CONFIRMED

      // try to call again
      await expect(
        escrow.connect(oracle).confirmArrival(tradeId)
      ).to.be.revertedWith("order status should be IN_TRANSIT");
    });
  });
});


describe("AgroasysEscrow: releaseFundsStage2", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;
  let tradeId: bigint;

  // helper function to create signature
  async function createSignature(
    signer: SignerWithAddress,
    tradeId: bigint,
    supplierAddr: string,
    treasuryAddr: string,
    totalAmount: bigint,
    logisticsAmount: bigint,
    platformFeesAmount: bigint,
    supplierFirstTranche: bigint,
    supplierSecondTranche: bigint,
    ricardianHash: string
  ) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [tradeId, supplierAddr, treasuryAddr, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash]
    );
    return await signer.signMessage(ethers.toBeArray(messageHash));
  }

  beforeEach(async function () {
    // complete flow before releaseStage2
    [buyer, supplier, treasury, oracle, admin1, admin2, admin3] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    const admins = [admin1.address, admin2.address, admin3.address];
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address, admins, 2);
    await escrow.waitForDeployment();

    const totalAmount = ethers.parseUnits("107000", 6);
    const logisticsAmount = ethers.parseUnits("5000", 6);
    const platformFeesAmount = ethers.parseUnits("2000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const supplierSecondTranche = ethers.parseUnits("60000", 6);
    const ricardianHash = ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014");

    await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

    const signature = await createSignature(
      buyer, 0n, supplier.address, treasury.address,
      totalAmount, logisticsAmount, platformFeesAmount,
      supplierFirstTranche, supplierSecondTranche, ricardianHash
    );

    await escrow.connect(buyer).createTrade(
      supplier.address,
      treasury.address,
      totalAmount,
      logisticsAmount,
      platformFeesAmount,
      supplierFirstTranche,
      supplierSecondTranche,
      ricardianHash,
      signature
    );

    tradeId = 0n;

    await escrow.connect(oracle).releaseFundsStage1(tradeId);
    await escrow.connect(oracle).confirmArrival(tradeId);
  });

  describe("Success:", function () {
    it("Should release stage 2 funds after 24h window", async function () {
      // wait + 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);
      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);

      const tx = await escrow.connect(oracle).releaseFundsStage2(tradeId);

      await expect(tx)
        .to.emit(escrow, "FundsReleasedStage2")
        .withArgs(tradeId);

      const trade = await escrow.trades(tradeId);

      // check if status is now closed
      expect(trade.status).to.equal(4); // CLOSED

      // check that treasury received platform fees
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + trade.platformFeesAmount
      );

      // check that supplier received second tranche
      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + trade.supplierSecondTranche
      );

      // Check escrow is empty
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("Should complete full user flow (without dispute)", async function () {
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(oracle).releaseFundsStage2(tradeId);

      const trade = await escrow.trades(tradeId);

      expect(trade.status).to.equal(4); // CLOSED
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
      expect(await usdc.balanceOf(supplier.address)).to.equal(trade.supplierFirstTranche+trade.supplierSecondTranche);
      expect(await usdc.balanceOf(treasury.address)).to.equal(trade.logisticsAmount+trade.platformFeesAmount);
    });
  });

  describe("Failure:", function () {
    it("Should reject if caller is not oracle", async function () {
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        escrow.connect(buyer).releaseFundsStage2(tradeId)
      ).to.be.revertedWith("Only oracle can call");

      await expect(
        escrow.connect(supplier).releaseFundsStage2(tradeId)
      ).to.be.revertedWith("Only oracle can call");

      await expect(
        escrow.connect(admin1).releaseFundsStage2(tradeId)
      ).to.be.revertedWith("Only oracle can call");
    });

    it("Should reject if trade doesn't exist", async function () {
      await expect(
        escrow.connect(oracle).releaseFundsStage2(999)
      ).to.be.revertedWith("trade doesn't exist");
    });

    it("Should reject if called before 24h window expires", async function () {
      // try now
      await expect(
        escrow.connect(oracle).releaseFundsStage2(tradeId)
      ).to.be.revertedWith("called within the 24h window");

      // try after 23 hours
      await ethers.provider.send("evm_increaseTime", [23 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        escrow.connect(oracle).releaseFundsStage2(tradeId)
      ).to.be.revertedWith("called within the 24h window");
    });

    it("Should reject if already called (status is CLOSED)", async function () {
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(oracle).releaseFundsStage2(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(4); // CLOSED

      await expect(
        escrow.connect(oracle).releaseFundsStage2(tradeId)
      ).to.be.revertedWith("trade status should be ARRIVAL_CONFIRMED");
    });
  });
});




describe("AgroasysEscrow: Dispute Flow", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;
  let tradeId: bigint;

  // helper function to create signature
  async function createSignature(
    signer: SignerWithAddress,
    tradeId: bigint,
    supplierAddr: string,
    treasuryAddr: string,
    totalAmount: bigint,
    logisticsAmount: bigint,
    platformFeesAmount: bigint,
    supplierFirstTranche: bigint,
    supplierSecondTranche: bigint,
    ricardianHash: string
  ) {
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
      [tradeId, supplierAddr, treasuryAddr, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash]
    );
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
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address, admins, 2);
    await escrow.waitForDeployment();

    const totalAmount = ethers.parseUnits("107000", 6);
    const logisticsAmount = ethers.parseUnits("5000", 6);
    const platformFeesAmount = ethers.parseUnits("2000", 6);
    const supplierFirstTranche = ethers.parseUnits("40000", 6);
    const supplierSecondTranche = ethers.parseUnits("60000", 6);
    const ricardianHash = ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014");

    await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

    const signature = await createSignature(
      buyer, 0n, supplier.address, treasury.address,
      totalAmount, logisticsAmount, platformFeesAmount,
      supplierFirstTranche, supplierSecondTranche, ricardianHash
    );

    await escrow.connect(buyer).createTrade(
      supplier.address,
      treasury.address,
      totalAmount,
      logisticsAmount,
      platformFeesAmount,
      supplierFirstTranche,
      supplierSecondTranche,
      ricardianHash,
      signature
    );

    tradeId = 0n;

    await escrow.connect(oracle).releaseFundsStage1(tradeId);
    await escrow.connect(oracle).confirmArrival(tradeId);
  });

  describe("openDispute", function () {
    describe("Success:", function () {
      it("Should allow buyer to open dispute within 24h window", async function () {
        const tx = await escrow.connect(buyer).openDispute(tradeId);

        await expect(tx)
          .to.emit(escrow, "DisputeOpenedByBuyer")
          .withArgs(tradeId);

        const trade = await escrow.trades(tradeId);
        expect(trade.status).to.equal(3); // FROZEN
      });

      it("Should work just before 24h window expires", async function () {
        // wait 23 hours 59 minutes
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 - 60]);
        await ethers.provider.send("evm_mine", []);

        await expect(escrow.connect(buyer).openDispute(tradeId)).to.not.be.reverted;
      });
    });

    describe("Failure:", function () {
      it("Should reject if caller is not buyer", async function () {
        await expect(
          escrow.connect(supplier).openDispute(tradeId)
        ).to.be.revertedWith("only buyer can open a dispute");

        await expect(
          escrow.connect(oracle).openDispute(tradeId)
        ).to.be.revertedWith("only buyer can open a dispute");

        await expect(
          escrow.connect(admin1).openDispute(tradeId)
        ).to.be.revertedWith("only buyer can open a dispute");
      });

      it("Should reject after 24h window expires", async function () {
        // wait 24 hours + 1 second
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
        await ethers.provider.send("evm_mine", []);

        await expect(
          escrow.connect(buyer).openDispute(tradeId)
        ).to.be.revertedWith("the function can be called only in the 24 hours window");
      });

      it("Should reject if already disputed", async function () {
        await escrow.connect(buyer).openDispute(tradeId);

        const trade = await escrow.trades(tradeId);
        expect(trade.status).to.equal(3); // FROZEN

        await expect(
          escrow.connect(buyer).openDispute(tradeId)
        ).to.be.revertedWith("order should be received to call the function");
      });
    });
  });

  describe("Success: Complete Dispute Flow: REFUND", function () {
    it("Should refund buyer completely (tranche2 + platform fees)", async function () {
      await escrow.connect(buyer).openDispute(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(3); // FROZEN

      const tx1 = await escrow.connect(admin1).proposeDisputeSolution(tradeId, 0);

      await expect(tx1)
        .to.emit(escrow, "DisputeSolution")
        .withArgs(0, tradeId, 0, admin1.address);

      const proposal = await escrow.disputeProposals(0);
      expect(proposal.tradeId).to.equal(tradeId);
      expect(proposal.disputeStatus).to.equal(0);
      expect(proposal.approvalCount).to.equal(1);
      expect(proposal.executed).to.equal(false);

      const buyerBalanceBefore = await usdc.balanceOf(buyer.address);

      const tx2 = await escrow.connect(admin2).approveDisputeSolution(0);

      await expect(tx2)
        .to.emit(escrow, "DisputeApproved")
        .withArgs(0, admin2.address, 2, 2);

      await expect(tx2)
        .to.emit(escrow, "DisputeFinalized")
        .withArgs(0);

      expect(await usdc.balanceOf(buyer.address)).to.equal(
        buyerBalanceBefore + trade.supplierSecondTranche + trade.platformFeesAmount
      );

      const tradeFinal = await escrow.trades(tradeId);
      expect(tradeFinal.status).to.equal(4); // CLOSED

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });
  });

  describe("Success: Complete Dispute Flow: RESOLVE", function () {
    it("Should pay supplier tranche2 + treasury platform fees", async function () {
      await escrow.connect(buyer).openDispute(tradeId);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(3); // FROZEN

      const tx1 = await escrow.connect(admin1).proposeDisputeSolution(tradeId, 1);

      await expect(tx1)
        .to.emit(escrow, "DisputeSolution")
        .withArgs(0, tradeId, 1, admin1.address);

      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);
      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);

      await escrow.connect(admin2).approveDisputeSolution(0);

      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + trade.supplierSecondTranche
      );

      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + trade.platformFeesAmount
      );

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);

    const tradeUpdated = await escrow.trades(tradeId);
      expect(tradeUpdated.status).to.equal(4); // CLOSED
    });
  });

  describe("Failure: proposeDisputeSolution", function () {
    beforeEach(async function () {
      await escrow.connect(buyer).openDispute(tradeId);
    });

    it("Should reject if caller is not admin", async function () {
      await expect(
        escrow.connect(buyer).proposeDisputeSolution(tradeId, 0)
      ).to.be.revertedWith("Only admin can call");

      await expect(
        escrow.connect(supplier).proposeDisputeSolution(tradeId, 0)
      ).to.be.revertedWith("Only admin can call");

      await expect(
        escrow.connect(oracle).proposeDisputeSolution(tradeId, 0)
      ).to.be.revertedWith("Only admin can call");
    });

    it("Should reject if trade doesn't exist", async function () {
      await expect(
        escrow.connect(admin1).proposeDisputeSolution(999, 0)
      ).to.be.revertedWith("trade doesn't exist");
    });

    it("Should reject if trade is not FROZEN", async function () {
      const totalAmount = ethers.parseUnits("50000", 6);
      const logisticsAmount = ethers.parseUnits("2000", 6);
      const platformFeesAmount = ethers.parseUnits("1000", 6);
      const supplierFirstTranche = ethers.parseUnits("20000", 6);
      const supplierSecondTranche = ethers.parseUnits("27000", 6);
      const ricardianHash = ethers.id("a145fd6df482a914725d7cd0ad060b69d8778191887f5a94b705749aa2c62fde");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const signature = await createSignature(
        buyer, 1n, supplier.address, treasury.address,
        totalAmount, logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche, ricardianHash
      );

      await escrow.connect(buyer).createTrade(
        supplier.address, treasury.address, totalAmount,
        logisticsAmount, platformFeesAmount,
        supplierFirstTranche, supplierSecondTranche,
        ricardianHash, signature
      );

      await expect(
        escrow.connect(admin1).proposeDisputeSolution(1n, 0)
      ).to.be.revertedWith("trade is not frozen");
    });
  });

  describe("Failure: approveDisputeSolution", function () {
    beforeEach(async function () {
      await escrow.connect(buyer).openDispute(tradeId);
      await escrow.connect(admin1).proposeDisputeSolution(tradeId, 0); // REFUND
    });

    it("Should reject if caller is not admin", async function () {
      await expect(
        escrow.connect(buyer).approveDisputeSolution(0)
      ).to.be.revertedWith("Only admin can call");

      await expect(
        escrow.connect(supplier).approveDisputeSolution(0)
      ).to.be.revertedWith("Only admin can call");
    });

    it("Should reject if proposal doesn't exist", async function () {
      await expect(
        escrow.connect(admin2).approveDisputeSolution(999)
      ).to.be.revertedWith("dispute not created");
    });

    it("Should reject double approval from same admin", async function () {
      await expect(
        escrow.connect(admin1).approveDisputeSolution(0)
      ).to.be.revertedWith("already approved by this admin");
    });

    it("Should reject if proposal already executed", async function () {
      await escrow.connect(admin2).approveDisputeSolution(0);

      const proposal = await escrow.disputeProposals(0);
      expect(proposal.executed).to.equal(true);

      await expect(
        escrow.connect(admin3).approveDisputeSolution(0)
      ).to.be.revertedWith("proposal already executed");
    });

    it("Should reject if trade is not FROZEN anymore", async function () {
      await escrow.connect(admin2).approveDisputeSolution(0);

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(4); // CLOSED

      await expect(
        escrow.connect(admin1).proposeDisputeSolution(tradeId, 1)
      ).to.be.revertedWith("trade is not frozen");
    });
  });
});
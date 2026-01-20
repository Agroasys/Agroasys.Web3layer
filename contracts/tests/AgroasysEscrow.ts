import { expect } from "chai";
import { ethers } from "hardhat";
import { AgroasysEscrow, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("AgroasysEscrow: creation trade", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury:SignerWithAddress;
  let oracle:SignerWithAddress;

  beforeEach(async function () {
    [buyer, supplier, treasury, oracle] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address);
    await escrow.waitForDeployment();

    // console.log("usdc address:", await usdc.getAddress());
    // console.log("escrow address:", await escrow.getAddress());
    // console.log("buyer address:", ethers.formatUnits(await usdc.balanceOf(buyer.address), 6), "USDC");
  });


  describe("Success:", function () {
    it("Should create a trade successfully", async function () {
      const totalAmount = ethers.parseUnits("107000", 6);
      const logistics = ethers.parseUnits("5000", 6);
      const platformFee = ethers.parseUnits("2000", 6);
      const firstTranche = ethers.parseUnits("40000", 6);
      const secondTranche = ethers.parseUnits("60000", 6);
      const ricardianHash = ethers.id("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");

      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      const tx = await escrow.connect(buyer).createTrade(
        supplier.address,
        treasury.address,
        totalAmount,
        logistics,
        platformFee,
        firstTranche,
        secondTranche,
        ricardianHash
      );

      await expect(tx)
        .to.emit(escrow, "TradeLocked")
        .withArgs(0, buyer.address, supplier.address, totalAmount, ricardianHash);


      const trade = await escrow.trades(0);
      expect(trade.tradeId).to.equal(0);
      expect(trade.ricardianHash).to.equal(ricardianHash);
      expect(trade.status).to.equal(0);
      expect(trade.buyerAddress).to.equal(buyer.address);
      expect(trade.supplierAddress).to.equal(supplier.address);
      expect(trade.treasuryAddress).to.equal(treasury.address);
      expect(trade.totalAmountLocked).to.equal(totalAmount);
      expect(trade.logisticsAmount).to.equal(logistics);
      expect(trade.platformFeesAmount).to.equal(platformFee);
      expect(trade.supplierFirstTranche).to.equal(firstTranche);
      expect(trade.supplierSecondTranche).to.equal(secondTranche);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(totalAmount);
      expect(await usdc.balanceOf(buyer.address)).to.equal(
        ethers.parseUnits("893000", 6)
      );

      expect(await escrow.tradeCounter()).to.equal(1);

      // console.log("trade id:", trade.tradeId);
    });

    it("Should create multiple trades", async function () {
      const amount = ethers.parseUnits("50000", 6);
      await usdc.connect(buyer).approve(await escrow.getAddress(), amount * 2n);

      await escrow.connect(buyer).createTrade(
        supplier.address,
        treasury.address,
        amount,
        ethers.parseUnits("2000", 6),
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("20000", 6),
        ethers.parseUnits("27000", 6),
        ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014")
      );

      await escrow.connect(buyer).createTrade(
        supplier.address,
        treasury.address,
        amount,
        ethers.parseUnits("2000", 6),
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("20000", 6),
        ethers.parseUnits("27000", 6),
        ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752")
      );

      expect(await escrow.tradeCounter()).to.equal(2);
      
      const trade0 = await escrow.trades(0);
      const trade1 = await escrow.trades(1);
      
      expect(trade0.ricardianHash).to.equal(ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014"));
      expect(trade1.ricardianHash).to.equal(ethers.id("60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752"));
    });
  });


  describe("Failure:", function () {
    it("Should reject invalid ricardian hash", async function () {
      await usdc.connect(buyer).approve(await escrow.getAddress(), ethers.parseUnits("100000", 6));

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address,
          treasury.address,
          ethers.parseUnits("100000", 6),
          ethers.parseUnits("5000", 6),
          ethers.parseUnits("2000", 6),
          ethers.parseUnits("40000", 6),
          ethers.parseUnits("53000", 6),
          ethers.ZeroHash
        )
      ).to.be.revertedWith("valid ricardian hash is required");
    });

    it("Should reject invalid supplier address", async function () {
      await usdc.connect(buyer).approve(await escrow.getAddress(), ethers.parseUnits("100000", 6));

      await expect(
        escrow.connect(buyer).createTrade(
          ethers.ZeroAddress,
          treasury.address,
          ethers.parseUnits("100000", 6),
          ethers.parseUnits("5000", 6),
          ethers.parseUnits("2000", 6),
          ethers.parseUnits("40000", 6),
          ethers.parseUnits("53000", 6),
          ethers.id("hash")
        )
      ).to.be.revertedWith("valid supplier address is required");
    });

    it("Should reject invalid treasury address", async function () {
      await usdc.connect(buyer).approve(await escrow.getAddress(), ethers.parseUnits("100000", 6));

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address,
          ethers.ZeroAddress,
          ethers.parseUnits("100000", 6),
          ethers.parseUnits("5000", 6),
          ethers.parseUnits("2000", 6),
          ethers.parseUnits("40000", 6),
          ethers.parseUnits("53000", 6),
          ethers.id("hash")
        )
      ).to.be.revertedWith("valid treasury address is required");
    });

    it("Should reject mismatched amounts", async function () {
      const totalAmount = ethers.parseUnits("100000", 6);
      await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);

      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address,
          treasury.address,
          totalAmount,
          ethers.parseUnits("5000", 6),
          ethers.parseUnits("2000", 6),
          ethers.parseUnits("40000", 6),
          ethers.parseUnits("50000", 6),
          ethers.id("hash")
        )
      ).to.be.revertedWith("total amount and payement breakdown are different");
    });

    it("Should reject without approval", async function () {
      await expect(
        escrow.connect(buyer).createTrade(
          supplier.address,
          treasury.address,
          ethers.parseUnits("107000", 6),
          ethers.parseUnits("5000", 6),
          ethers.parseUnits("2000", 6),
          ethers.parseUnits("40000", 6),
          ethers.parseUnits("60000", 6),
          ethers.id("hash")
        )
      ).to.be.reverted;
    });
  });

});


describe("AgroasysEscrow: releaseFunds", function () {
  let escrow: AgroasysEscrow;
  let usdc: MockUSDC;
  let buyer: SignerWithAddress;
  let supplier: SignerWithAddress;
  let treasury: SignerWithAddress;
  let oracle: SignerWithAddress;
  let tradeId: bigint;

  beforeEach(async function () {
    [buyer, supplier, treasury, oracle] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address);
    await escrow.waitForDeployment();

    const totalAmount = ethers.parseUnits("107000", 6);
    await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);
    
    const tx = await escrow.connect(buyer).createTrade(
      supplier.address,
      treasury.address,
      totalAmount,
      ethers.parseUnits("5000", 6),  // logistics
      ethers.parseUnits("2000", 6),  // platform fees
      ethers.parseUnits("40000", 6), // first tranche
      ethers.parseUnits("60000", 6), // second tranche
      ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014")
    );
    
    tradeId = 0n;
  });

  describe("Success:", function () {
    it("Should release stage 1 funds (IN_TRANSIT)", async function () {
      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);
      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);

      const tx = await escrow.connect(oracle).releaseFunds(tradeId, 1); // 1 = IN_TRANSIT

      await expect(tx)
        .to.emit(escrow, "FundsReleased")
        .withArgs(
          tradeId,
          treasury.address,
          supplier.address,
          1, // IN_TRANSIT
          ethers.parseUnits("5000", 6),  // logistics
          ethers.parseUnits("2000", 6),  // platform fees
          ethers.parseUnits("40000", 6), // first tranche
          0,                              // second tranche (not released yet)
          ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014")
        );

      // check balances
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + ethers.parseUnits("7000", 6) // logistics + fees
      );
      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + ethers.parseUnits("40000", 6)
      );

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(1); // IN_TRANSIT
    });


    it("Sould release stage 2 funds (CLOSED)",async function () {
      await escrow.connect(oracle).releaseFunds(tradeId,1);

      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);

      const tx = await escrow.connect(oracle).releaseFunds(tradeId,2);

      await expect(tx)
        .to.emit(escrow,"FundsReleased")
        .withArgs(
            tradeId,
            treasury.address,
            supplier.address,
            2, // CLOSED
            0, // logistics (already released)
            0, // platform fees (already released)
            0, // first tranche (already released)
            ethers.parseUnits("60000", 6), // second tranche
            ethers.id("1b4f0e9851971998e732078544c96b36c3d01cedf7caa332359d6f1d83567014")
        );

      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + ethers.parseUnits("60000", 6)
      );

      const trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(2); // CLOSED
    });
  });
});

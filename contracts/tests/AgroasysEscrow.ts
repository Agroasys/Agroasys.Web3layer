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
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address,admins,2);
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
  let admin1: SignerWithAddress;
  let admin2: SignerWithAddress;
  let admin3: SignerWithAddress;
  let tradeId: bigint;

  beforeEach(async function () {
    [buyer, supplier, treasury, oracle, admin1, admin2, admin3] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    await usdc.mint(buyer.address, ethers.parseUnits("1000000", 6));

    const EscrowFactory = await ethers.getContractFactory("AgroasysEscrow");
    const admins = [admin1.address, admin2.address, admin3.address];
    escrow = await EscrowFactory.deploy(await usdc.getAddress(), oracle.address,admins,2);
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

    it("Sould execute the full lifecycle: from LOCKED to CLOSED", async function() {
      // stage 0 (LOCKED)
      let trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(0);

      // stage 1 (IN_TRANSIT)
      await escrow.connect(oracle).releaseFunds(tradeId, 1);
      trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(1);

      // stage 2 (CLOSED)
      await escrow.connect(oracle).releaseFunds(tradeId, 2);
      trade = await escrow.trades(tradeId);
      expect(trade.status).to.equal(2);

      // escrow should have released all the funds
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("Should correctly track updatedAt after releases", async function () {
      const tradeBefore = await escrow.trades(tradeId);
      const timestampBefore = tradeBefore.updatedAt;

      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(oracle).releaseFunds(tradeId, 1);

      const tradeAfter = await escrow.trades(tradeId);
      expect(tradeAfter.updatedAt).to.be.greaterThan(timestampBefore);
    });
  });

  describe("Failure:", function () {
    it("Should reject someone else than oracle calls releaseFunds",async function () {
      await expect(escrow.connect(buyer).releaseFunds(tradeId, 1)).to.be.revertedWith("Only oracle can call");
    });

    it("Should reject if the trade doesn't exist", async function (){
      await expect(escrow.connect(oracle).releaseFunds(999,1)).to.be.revertedWith("trade doesn't exist");
    });

    it("Should reject stage 1 if status is not LOCKED", async function () {
      await escrow.connect(oracle).releaseFunds(tradeId, 1);
      await expect(escrow.connect(oracle).releaseFunds(tradeId, 1)).to.be.revertedWith("actual status must be LOCKED to release stage 1");
    });

    it("Should reject stage 2 if status is not IN_TRANSIT", async function () {
      await expect(escrow.connect(oracle).releaseFunds(tradeId, 2)).to.be.revertedWith("actual status  must be IN_TRANSIT to release stage 2");
    });

    it("Should reject if called with CLOSED new_status", async function () {
      await expect(escrow.connect(oracle).releaseFunds(tradeId, 0)).to.be.revertedWith("new status not valid");
    });

    it("Should reject if trade is already CLOSED", async function () {
      await escrow.connect(oracle).releaseFunds(tradeId, 1);
      await escrow.connect(oracle).releaseFunds(tradeId, 2);
      await expect(escrow.connect(oracle).releaseFunds(tradeId, 1)).to.be.revertedWith("trade not modifiable by the oracle");
    });
  });
});


describe("AgroasysEscrow: dispute", function () {
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
    await usdc.connect(buyer).approve(await escrow.getAddress(), totalAmount);
    
    await escrow.connect(buyer).createTrade(
      supplier.address,
      treasury.address,
      totalAmount,
      ethers.parseUnits("5000", 6), // logistics
      ethers.parseUnits("2000", 6), // fees
      ethers.parseUnits("40000", 6), // first tranche
      ethers.parseUnits("60000", 6), // second tranche 
      ethers.id("b1dbabc1b20bcb287cb323adff5c87e12c314046a74faa84faa6341f68cdc067") // ricardian hash SHA 256
    );
    
    tradeId = 0n;
  });

  describe("Success:", function () {
    it("Should raise a dispute (REFUND) (propose+approve) while trade is LOCKED", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      // the first admin propose (appoves automatically)
      const tx = await escrow.connect(admin1).proposeDispute(tradeId,0) // REFUND
      await expect(tx).to.emit(escrow, "DisputeProposed");

      const proposalId = 0;

      const buyerBalanceBefore = await usdc.balanceOf(buyer.address);

      // second admin approve too (2 admins approved so dispute is called)
      await expect(escrow.connect(admin2).approveDispute(proposalId))
        .to.emit(escrow, "DisputeApproved")
        .to.emit(escrow, "DisputeRaised");

      // buyer should be refunded
      expect(await usdc.balanceOf(buyer.address)).to.equal(
        buyerBalanceBefore + ethers.parseUnits("107000", 6)
      );
    });

    it("Should raise a dispute (RESOLVE) (propose+approve) while trade is LOCKED", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      // the first admin propose (appoves automatically)
      const tx = await escrow.connect(admin1).proposeDispute(tradeId,1) // RESOLVE
      await expect(tx).to.emit(escrow, "DisputeProposed");

      const proposalId = 0;

      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);
      const treasuryrBalanceBefore = await usdc.balanceOf(treasury.address);

      // second admin approve too (2 admins approved so dispute is called)
      await expect(escrow.connect(admin2).approveDispute(proposalId))
        .to.emit(escrow, "DisputeApproved")
        .to.emit(escrow, "DisputeRaised");

      
      // supplier should be paid
      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + ethers.parseUnits("40000", 6) + ethers.parseUnits("60000", 6)
      );

      // treasury should be paid
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryrBalanceBefore + ethers.parseUnits("5000", 6) + ethers.parseUnits("2000", 6)
      );
    });

    it("Should raise a dispute (PARTICULAR_ISSUE) while trade is LOCKED", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(admin1).proposeDispute(tradeId, 2); // PARTICULAR_ISSUE
      
      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);

      await expect(escrow.connect(admin2).approveDispute(0))
        .to.emit(escrow, "DisputeRaised");

      // treasury receives all funds for the particular issue that need more complex solution than just refund or pay
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + ethers.parseUnits("107000", 6)
      );
    });

    it("Should raise a dispute (REFUND) while trade is IN_TRANSIT", async function () {
      // release stage 1 so the trade sttatus is IN_TRANSIT
      await escrow.connect(oracle).releaseFunds(tradeId, 1);

      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(admin1).proposeDispute(tradeId, 0); // REFUND
      
      const buyerBalanceBefore = await usdc.balanceOf(buyer.address);

      await escrow.connect(admin2).approveDispute(0);

      // buyer only gets second tranche back
      expect(await usdc.balanceOf(buyer.address)).to.equal(
        buyerBalanceBefore + ethers.parseUnits("60000", 6)
      );
    });

    it("Should raise a dispute (RESOLVE) while trade is IN_TRANSIT", async function () {
      // release stage 1 so the trade status is IN_TRANSIT
      await escrow.connect(oracle).releaseFunds(tradeId, 1);

      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(admin1).proposeDispute(tradeId, 1); // RESOLVE
      
      const supplierBalanceBefore = await usdc.balanceOf(supplier.address);

      await escrow.connect(admin2).approveDispute(0);

      // supplier gets the second tranche
      expect(await usdc.balanceOf(supplier.address)).to.equal(
        supplierBalanceBefore + ethers.parseUnits("60000", 6)
      );
    });

    it("Should raise a dispute (PARTICULAR_ISSUE) while trade is IN_TRANSIT", async function () {
      await escrow.connect(oracle).releaseFunds(tradeId, 1);

      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(admin1).proposeDispute(tradeId, 2); // PARTICULAR_ISSUE
      
      const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);

      await escrow.connect(admin2).approveDispute(0);

      // treasury gets the second tranche to slove the issue
      expect(await usdc.balanceOf(treasury.address)).to.equal(
        treasuryBalanceBefore + ethers.parseUnits("60000", 6)
      );
    });
  });
  describe("Failure:", function () {
    it("Should reject if caller is not admin", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        escrow.connect(buyer).proposeDispute(tradeId, 0)
      ).to.be.revertedWith("Only admin can call");
    });

    it("Should reject if trade doesn't exist", async function () {
      await expect(
        escrow.connect(admin1).proposeDispute(999, 0)
      ).to.be.revertedWith("trade doesn't exist");
    });

    it("Should reject if trade is CLOSED", async function () {
      // release stage 1
      await escrow.connect(oracle).releaseFunds(tradeId, 1);
      // release stage 2
      await escrow.connect(oracle).releaseFunds(tradeId, 2);
      // trade status is now CLOSED

      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        escrow.connect(admin1).proposeDispute(tradeId, 0)
      ).to.be.revertedWith("trade already closed or disputed");
    });

    it("Should reject if trade is DISPUTED", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      // the first admin propose (appoves automatically)
      const tx = await escrow.connect(admin1).proposeDispute(tradeId,0) // REFUND
      await expect(tx).to.emit(escrow, "DisputeProposed");

      const proposalId = 0;

      const buyerBalanceBefore = await usdc.balanceOf(buyer.address);

      // second admin approve too (2 admins approved so dispute is called)
      await expect(escrow.connect(admin2).approveDispute(proposalId))
        .to.emit(escrow, "DisputeApproved")
        .to.emit(escrow, "DisputeRaised");

      // buyer should be refunded
      expect(await usdc.balanceOf(buyer.address)).to.equal(
        buyerBalanceBefore + ethers.parseUnits("107000", 6)
      );

      // propose dispute shouldn't be authorized if the status is DISPUTED (already solved)
      await expect(
        escrow.connect(admin1).proposeDispute(tradeId, 0)
      ).to.be.revertedWith("trade already closed or disputed");
    });

    it("Should reject if proposeDispute is called before 7 days of inactivity", async function () {
      await expect(
        escrow.connect(admin1).proposeDispute(tradeId, 0)
      ).to.be.revertedWith("must wait 7 days since last oracle update");

      const sixDaysInSeconds = 6*24*60*60;
      await ethers.provider.send("evm_increaseTime",[sixDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        escrow.connect(admin1).proposeDispute(tradeId, 0)
      ).to.be.revertedWith("must wait 7 days since last oracle update");
    });

    it("Should reject approval of non-existent proposal", async function () {
      await expect(
        escrow.connect(admin1).approveDispute(999)
      ).to.be.revertedWith("dispute not created");
    });

    it("Should reject double approval from same admin", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(admin1).proposeDispute(tradeId, 0);

      await expect(
        escrow.connect(admin1).approveDispute(0)
      ).to.be.revertedWith("already approved by this admin");
    });

    it("Should reject approval if the proposal has already been executed", async function () {
      const weekInSeconds = 7*24*60*60;
      await ethers.provider.send("evm_increaseTime",[weekInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await escrow.connect(admin1).proposeDispute(tradeId, 0);
      await escrow.connect(admin2).approveDispute(0);

      await expect(
        escrow.connect(admin3).approveDispute(0)
      ).to.be.revertedWith("proposal already executed");
    });
  });
});
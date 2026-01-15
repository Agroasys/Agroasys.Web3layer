import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgroasysEscrow", function () {
  it("Should compile", async function () {
    const Escrow = await ethers.getContractFactory("AgroasysEscrow");
    expect(Escrow).to.exist;
  });
});
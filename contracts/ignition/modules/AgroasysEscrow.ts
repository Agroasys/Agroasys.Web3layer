import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgroasysEscrowModule", (m) => {
    const usdcAddress = "";
    const oracleAddress = "";
    const treasuryAddress = "";
    const admin1 = "";
    const admin2 = "";
    const admin3 = "";
    const admins = [admin1,admin2,admin3];
    const requiredApprovals = 2;

    const agroasysEscrow = m.contract("AgroasysEscrow", [
        usdcAddress,
        oracleAddress,
        treasuryAddress,
        admins,
        requiredApprovals
    ]);

    return { agroasysEscrow };
});
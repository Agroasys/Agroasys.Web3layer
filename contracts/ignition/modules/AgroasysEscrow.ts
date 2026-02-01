import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AgroasysEscrowModule", (m) => {
    const usdcAddress = "0xb763eDEc531649a7cC8897E5daa0454681581418";
    const oracleAddress = "0xA737049F011946215bE174575d3dDa922653095D";
    const treasuryAddress = "0xA737049F011946215bE174575d3dDa922653095D";
    const admin1 = "0xA737049F011946215bE174575d3dDa922653095D";
    const admin2 = "0xA62152F0Ef6e34367A113B6BfF1003Ea472Fb3cD";
    const admin3 = "0x462e08670C229913Eaf5493179f7Ad15B7fdeE46";
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
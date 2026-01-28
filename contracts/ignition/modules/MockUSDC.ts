import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockUSDCModule", (m) => {
    const mockUSDC = m.contract("MockUSDC");

    return { mockUSDC };
});
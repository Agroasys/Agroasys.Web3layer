import { Interface } from "ethers";

const abiJson = [
  "event TradeLocked(uint256 indexed tradeId, address indexed buyer, address indexed supplier, uint256 totalAmount, uint256 logisticsAmount, uint256 platformFeesAmount, uint256 supplierFirstTranche, uint256 supplierSecondTranche, bytes32 ricardianHash)",
  "event FundsReleasedStage1(uint256 indexed tradeId, address indexed supplier, uint256 supplierFirstTranche, address indexed treasury, uint256 logisticsAmount)"
];

export const contractInterface = new Interface(abiJson);
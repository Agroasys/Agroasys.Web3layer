// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract AgroasysEscrow is ReentrancyGuard{

    enum TradeStatus {
        LOCKED,  // initial deposit
        IN_TRANSIT, // BOL verified -> Stage1 released
        CLOSED, // Inspection passed -> Stage 2 released
        DISPUTED, // Dispute raised
        REFUNDED // Buyer refunded if needed (admin decides when DISPUTED)
    }

    struct Trade {
        uint256 tradeId;  // unique id to identify a trade
        bytes32 ricardianHash; // immutable proof of agreement
        TradeStatus status;
        address buyerAddress;
        address supplierAddress;
        address treasuryAddress; // to receive logistics+platform fees
        uint256 totalAmountLocked;
        uint256 logisticsAmount;
        uint256 platformFeesAmount;
        uint256 supplierFirstTranche; // 40% (configurable amount at trade creation)
        uint256 supplierSecondTranche; // 60% (configurable amount at trade creation)
        uint256 createdAt;
        uint256 updatedAt; // necessary to allow an admin to call dispute (If the Oracle goes offline for >7 days)
    }

    mapping(uint256 => Trade) public trades;

    uint256 public tradeCounter;

    address public oracleAddress;

    IERC20 public usdcToken;

    mapping(address => bool) public admins;

    event TradeLocked(
        uint256 tradeId,
        address buyer,
        address supplier,
        uint256 totalAmount,
        bytes32 ricardianHash
    );

    // new status, example: if the status was LOCKED and became IN_TRANSIT, the event status is gonna be IN_TRANSIT
    // tracking each amount to know exactly how many funds were released for each releaseFunds call
    event FundsReleased(
        uint256 tradeId,
        address treasury,
        address supplier,
        TradeStatus status, 
        uint256 logisticsAmountReleased,
        uint256 platformFeesAmountReleased,
        uint256 supplierFirstTrancheReleased,
        uint256 supplierSecondTrancheReleased,
        bytes32 ricardianHash
    );

    constructor(address _usdcToken,address _oracleAddress){
        usdcToken = IERC20(_usdcToken);
        oracleAddress = _oracleAddress;
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender],"Only admin can call");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender==oracleAddress,"Only oracle can call");
        _;
    }

    function createTrade(
        address _supplier,
        address _treasury,
        uint256 _totalAmount,
        uint256 _logisticsAmount,
        uint256 _platformFeesAmount,
        uint256 _supplierFirstTranche,
        uint256 _supplierSecondTranche,
        bytes32 _ricardianHash
    ) external nonReentrant returns (uint256) {
        // check all args before creating the trade
        require(_ricardianHash!=bytes32(0),"valid ricardian hash is required");
        require(_supplier != address(0),"valid supplier address is required");
        require(_treasury != address(0),"valid treasury address is required");
        uint256 totalAmountExpected = _logisticsAmount + _platformFeesAmount + _supplierFirstTranche + _supplierSecondTranche;
        require(_totalAmount==totalAmountExpected,"total amount and payement breakdown are different");

        // then create the trade and store it within the contract
        uint256 newTradeId = tradeCounter++;

        trades[newTradeId] = Trade({
            tradeId: newTradeId,
            ricardianHash: _ricardianHash,
            status: TradeStatus.LOCKED,
            buyerAddress: msg.sender,
            supplierAddress: _supplier,
            treasuryAddress: _treasury,
            totalAmountLocked: _totalAmount,
            logisticsAmount: _logisticsAmount,
            platformFeesAmount: _platformFeesAmount,
            supplierFirstTranche: _supplierFirstTranche,
            supplierSecondTranche: _supplierSecondTranche,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // then create the transfer
        bool transferSuccess = usdcToken.transferFrom(msg.sender, address(this),_totalAmount);

        require(transferSuccess,"Transfer failed");

        // emit the event TradeLocked
        emit TradeLocked(newTradeId, msg.sender, _supplier, _totalAmount, _ricardianHash);

        return newTradeId;
    }



    function releaseFunds(
        uint256 _tradeId,
        TradeStatus _newStatus // new status, so one step after the current contract trade status
    ) external onlyOracle nonReentrant{
        require(_tradeId<tradeCounter,"trade doesn't exist");
        // use storage the make the changes permanent
        Trade storage trade = trades[_tradeId];

        require(
            trade.status != TradeStatus.CLOSED && 
            trade.status != TradeStatus.DISPUTED && 
            trade.status != TradeStatus.REFUNDED,
            "trade not modifiable by the oracle"
        );

        if (_newStatus == TradeStatus.IN_TRANSIT) {
            require(trade.status == TradeStatus.LOCKED, "actual status must be LOCKED to release stage 1");
        } else if (_newStatus == TradeStatus.CLOSED) {
            require(trade.status == TradeStatus.IN_TRANSIT, "actual status  must be IN_TRANSIT to release stage 2");
        } else {
            revert("new status not valid");
        }

        // track for the FundsReleased event
        uint256 logisticsReleased = 0;
        uint256 platformFeesReleased = 0;
        uint256 supplierFirstTrancheReleased = 0;
        uint256 supplierSecondTrancheReleased = 0;

        if (_newStatus==TradeStatus.IN_TRANSIT){
            trade.status = TradeStatus.IN_TRANSIT;
            trade.updatedAt = block.timestamp;
            logisticsReleased = trade.logisticsAmount;
            platformFeesReleased = trade.platformFeesAmount;
            supplierFirstTrancheReleased = trade.supplierFirstTranche;

            // first payement to treasury to pay logistics and fees
            uint256 treasuryTotal = trade.platformFeesAmount + trade.logisticsAmount;
            bool treasuryTransferSuccess = usdcToken.transfer(trade.treasuryAddress, treasuryTotal);
            require(treasuryTransferSuccess,"Transfer failed");

            // second payement to pay the first tranche to the supplier
            bool supplierTransferSuccess = usdcToken.transfer(trade.supplierAddress, trade.supplierFirstTranche);
            require(supplierTransferSuccess,"Transfer failed");
        }
        else if (_newStatus==TradeStatus.CLOSED){
            trade.status = TradeStatus.CLOSED;
            trade.updatedAt = block.timestamp;
            supplierSecondTrancheReleased = trade.supplierSecondTranche;
            // third payement to pay the second tranche to the supplier
            bool supplierTransferSuccess = usdcToken.transfer(trade.supplierAddress, trade.supplierSecondTranche);
            require(supplierTransferSuccess,"Transfer failed");
        }


        emit FundsReleased(
            _tradeId,
            trade.treasuryAddress,
            trade.supplierAddress,
            trade.status,
            logisticsReleased,
            platformFeesReleased,
            supplierFirstTrancheReleased,
            supplierSecondTrancheReleased,
            trade.ricardianHash
        );
    }
}

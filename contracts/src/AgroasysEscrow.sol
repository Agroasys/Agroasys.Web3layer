// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;


contract AgroasysEscrow {

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
        uint256 updatedAt; // when status is updated
        uint256 diputeDeadline; // updatedAt + 7 days (If the Oracle goes offline for >7 days)
    }
}

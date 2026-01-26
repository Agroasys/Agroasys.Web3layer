// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzepplin/coontracts/utils/ECDSA.sol";

contract AgroasysEscrow is ReentrancyGuard{

    enum TradeStatus {
        LOCKED,  // initial deposit
        IN_TRANSIT, // BOL verified -> Stage1 released
        CLOSED, // Inspection passed -> Stage 2 released
        DISPUTED // if admins solved manually an issue
    }

    enum DisputeStatus {
        REFUND, // refund the buyer if an issue occured 
        RESOLVE, // pay the supplier if the funds got stuck or the if there is an issue with the oracle
        PARTICULAR_ISSUE // send the funds to the treasury wallet if a particular issue needs a complex solutiuon
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

    struct DisputeProposal {
        uint256 tradeId;
        DisputeStatus disputeStatus;
        uint256 approvalCount;
        mapping(address=>bool) hasApproved;
        bool executed;
        uint256 createdAt;
    }

    mapping(uint256 => Trade) public trades;

    uint256 public tradeCounter;

    address public oracleAddress;

    IERC20 public usdcToken;

    address[] public admins;
    mapping(address => bool) public isAdmin;
    uint256 public requiredApprovals;
    mapping(uint256 => DisputeProposal) public disputeProposals;
    uint256 public disputeCounter;

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

    event DisputeRaised(
        uint256 tradeId,
        DisputeStatus status,
        address buyer,
        address supplier,
        address treasury,
        bytes32 ricardianHash
    );

    event DisputeProposed(
        uint256 proposalId,
        uint256 tradeId,
        DisputeStatus disputeStatus,
        address proposer
    );

    event DisputeApproved(
        uint256 proposalId,
        address approver,
        uint256 approvalCount,
        uint256 requiredApprovals
    );


    constructor(address _usdcToken,address _oracleAddress,address[] memory _admins,uint256 _requiredApprovals){
        require(_admins.length >= _requiredApprovals, "not enough admins");
        require(_requiredApprovals > 0, "required approvals must be greater than 0");
        
        usdcToken = IERC20(_usdcToken);
        oracleAddress = _oracleAddress;
        requiredApprovals = _requiredApprovals;
        
        for (uint256 i = 0; i < _admins.length; i++) {
            require(_admins[i]!=address(0), "incorrect address");
            require(!isAdmin[_admins[i]],"admin already known");

            admins.push(_admins[i]);
            isAdmin[_admins[i]] = true;
        }
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender],"Only admin can call");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender==oracleAddress,"Only oracle can call");
        _;
    }


    function verifySignature(
        uint256 _tradeId,
        address _supplier,
        address _treasury,
        uint256 _totalAmount,
        bytes32 _ricardianHash,
        bytes memory _signature
    ) internal returns (address) {
        bytes32 messageHashRecreated = keccak256(abi.encodePacked(_tradeId,_supplier,_treasury,_totalAmount,_ricardianHash));
        bytes32 hash_signed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHashRecreated));
        return ECDSA.recover(hash_signed,_signature);
    }


    function createTrade(
        address _supplier,
        address _treasury,
        uint256 _totalAmount,
        uint256 _logisticsAmount,
        uint256 _platformFeesAmount,
        uint256 _supplierFirstTranche,
        uint256 _supplierSecondTranche,
        bytes32 _ricardianHash,
        bytes memory _signature
    ) external nonReentrant returns (uint256) {
        // check all args before creating the trade
        require(_ricardianHash!=bytes32(0),"valid ricardian hash is required");
        require(_supplier != address(0),"valid supplier address is required");
        require(_treasury != address(0),"valid treasury address is required");
        uint256 totalAmountExpected = _logisticsAmount + _platformFeesAmount + _supplierFirstTranche + _supplierSecondTranche;
        require(_totalAmount==totalAmountExpected,"total amount and payement breakdown are different");

        // then create the trade and store it within the contract
        uint256 newTradeId = tradeCounter++;

        require(verifySignature(newTradeId,_supplier,_treasury,_totalAmount,_ricardianHash,_signature)==msg.sender,"incorrect signature");

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
            trade.status != TradeStatus.DISPUTED,
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

    // function callable only in the contract by the functions approveDispute
    function _dispute(uint256 _proposalId) internal {
        DisputeProposal storage proposal = disputeProposals[_proposalId];
        
        require(proposal.approvalCount >= requiredApprovals, "not enough approvals");
        
        proposal.executed = true;
        
        uint256 _tradeId = proposal.tradeId;
        DisputeStatus _disputeStatus = proposal.disputeStatus;
        
        Trade storage trade = trades[_tradeId];
        
        uint256 availableAmount = 0;
        
        if (trade.status == TradeStatus.LOCKED) {
            // nothing was paid so buyer can be entierly refunded
            availableAmount = trade.totalAmountLocked;
        } else if (trade.status == TradeStatus.IN_TRANSIT) {
            // only the second tranche payement is avalaible
            availableAmount = trade.supplierSecondTranche;
        }
        
        require(availableAmount > 0, "no funds available for dispute");

        TradeStatus oldStatus = trade.status;
        
        trade.status = TradeStatus.DISPUTED;
        trade.updatedAt = block.timestamp;
        
        
        if (_disputeStatus == DisputeStatus.REFUND) {
            // if an issue occured -> refund the buyer
            bool refundSuccess = usdcToken.transfer(trade.buyerAddress, availableAmount);
            require(refundSuccess, "refund transfer failed");
        }
        else if (_disputeStatus == DisputeStatus.RESOLVE) {
            // if everything went right but somehow the oracle failed to call releaseFunds
            if (oldStatus == TradeStatus.LOCKED) {
                // pay treasury fees + logistics and supplier full amount
                uint256 treasuryTotal = trade.logisticsAmount + trade.platformFeesAmount;
                bool treasurySuccess = usdcToken.transfer(trade.treasuryAddress, treasuryTotal);
                require(treasurySuccess, "transfer to treasury  failed");
                
                uint256 supplierTotal = trade.supplierFirstTranche + trade.supplierSecondTranche;
                bool supplierSuccess = usdcToken.transfer(trade.supplierAddress, supplierTotal);
                require(supplierSuccess, "transfer to supplier failed");
            } 
            else if (oldStatus == TradeStatus.IN_TRANSIT) {
                // treasury already paid so pay only remaining supplier tranche
                bool resolveSuccess = usdcToken.transfer(trade.supplierAddress, availableAmount);
                require(resolveSuccess, "transfer to supplier failed");
            }
        } 
        else if (_disputeStatus == DisputeStatus.PARTICULAR_ISSUE){
            // let the company solve the particular issue
            bool treasuryTransferSuccess = usdcToken.transfer(trade.treasuryAddress, availableAmount);
            require(treasuryTransferSuccess, "transfer to treasury failed");
        }
        else {
            revert("invalid dispute status");
        }
        
        emit DisputeRaised(
            _tradeId,
            _disputeStatus,
            trade.buyerAddress,
            trade.supplierAddress,
            trade.treasuryAddress,
            trade.ricardianHash
        );
    }

    function proposeDispute(uint256 _tradeId, DisputeStatus _disputeStatus) external onlyAdmin() returns (uint256) {
        require(_tradeId<tradeCounter,"trade doesn't exist");

        Trade storage trade = trades[_tradeId];

        require(trade.status != TradeStatus.CLOSED && trade.status != TradeStatus.DISPUTED, "trade already closed or disputed");
        // admin can solve if oracle was inactive for 7 days
        require(block.timestamp >= trade.updatedAt + 7 days,"must wait 7 days since last oracle update");

        uint256 proposalId = disputeCounter;
        disputeCounter++;
        DisputeProposal storage proposal = disputeProposals[proposalId];

        proposal.tradeId = _tradeId;
        proposal.disputeStatus = _disputeStatus;
        proposal.approvalCount = 1;
        proposal.hasApproved[msg.sender] = true;
        proposal.executed = false;
        proposal.createdAt = block.timestamp;
        
        emit DisputeProposed(proposalId, _tradeId, _disputeStatus, msg.sender);
        
        return proposalId;
    }

    // automically call dispute function
    function approveDispute(uint256 _proposalId) external onlyAdmin nonReentrant{
        require(disputeCounter>_proposalId,"dispute not created");
        DisputeProposal storage proposal = disputeProposals[_proposalId];

        require(!proposal.executed, "proposal already executed");

        uint256 _tradeId = proposal.tradeId;
        Trade memory trade = trades[_tradeId];
        require(trade.status != TradeStatus.DISPUTED,"trade already disputed");

        require(!proposal.hasApproved[msg.sender], "already approved by this admin");

        proposal.hasApproved[msg.sender] = true;
        proposal.approvalCount++;

        emit DisputeApproved(_proposalId, msg.sender, proposal.approvalCount, requiredApprovals);

        if (proposal.approvalCount>=requiredApprovals) {
            _dispute(_proposalId);
        }
    }
}

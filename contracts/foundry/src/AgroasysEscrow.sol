// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


contract AgroasysEscrow is ReentrancyGuard{

    enum TradeStatus {
        LOCKED,  // initial deposit
        IN_TRANSIT, // BOL verified -> Stage1 released
        ARRIVAL_CONFIRMED, // oracle triggers (24 hours dispute window starts)
        FROZEN, // if buyer raise dispute within the 24hours windows -> funds froze in the escrow
        CLOSED // trade closed
    }

    enum DisputeStatus {
        REFUND, // refund the buyer if an issue occured 
        RESOLVE // pay the supplier if the funds got stuck or the if there is an issue with the oracle
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
        uint256 arrivalTimestamp;
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
        address treasury,
        uint256 totalAmount,
        bytes32 ricardianHash
    );

    event FundsReleasedStage1(
        uint256 tradeId
    );

    event ArrivalConfirmed(
        uint256 tradeId
    );

    event FundsReleasedStage2(
        uint256 tradeId
    );

    event DisputeOpenedByBuyer(
        uint256 tradeId
    );

    event DisputeSolution(
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

    event DisputeFinalized(
        uint256 proposalId
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
        uint256 _logisticAmount,
        uint256 _platformFeesAmount,
        uint256 _supplierFirstTranche,
        uint256 _supplierSecondTranche,
        bytes32 _ricardianHash,
        bytes memory _signature
    ) internal pure returns (address) {
        bytes32 messageHashRecreated = keccak256(abi.encodePacked(
            _tradeId,
            _supplier,
            _treasury,
            _totalAmount,
            _logisticAmount,
            _platformFeesAmount,
            _supplierFirstTranche,
            _supplierSecondTranche,
            _ricardianHash
        ));
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
        uint256 newTradeId = tradeCounter;
        require(verifySignature(newTradeId,_supplier,_treasury,_totalAmount,_logisticsAmount,_platformFeesAmount,_supplierFirstTranche,_supplierSecondTranche,_ricardianHash,_signature)==msg.sender,"incorrect signature");
 
        // then create the trade and store it within the contract
        tradeCounter++;

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
            arrivalTimestamp: 0
        });

        // then create the transfer
        bool transferSuccess = usdcToken.transferFrom(msg.sender, address(this),_totalAmount);

        require(transferSuccess,"Transfer failed");

        // emit the event TradeLocked
        emit TradeLocked(newTradeId, msg.sender, _supplier,_treasury, _totalAmount, _ricardianHash);

        return newTradeId;
    }

    // bol verified: release first tranche and logistics
    function releaseFundsStage1(uint256 _tradeId) external onlyOracle nonReentrant {
        require(_tradeId<tradeCounter,"trade doesn't exist");
        // use storage the make the changes permanent
        Trade storage trade = trades[_tradeId];

        require(trade.status == TradeStatus.LOCKED,"trade status should be LOCKED");

        trade.status = TradeStatus.IN_TRANSIT;

        bool supplierTransferSuccess = usdcToken.transfer(trade.supplierAddress, trade.supplierFirstTranche);
        require(supplierTransferSuccess,"Transfer failed");

        // pay logistcis to treasury
        bool treasuryTransferSuccess = usdcToken.transfer(trade.treasuryAddress, trade.logisticsAmount);
        require(treasuryTransferSuccess,"Transfer failed");

        emit FundsReleasedStage1(_tradeId);
    }

    // order arrived and buyer havne't raised a dispute within the 24 winbdow
    function releaseFundsStage2(uint256 _tradeId) external onlyOracle nonReentrant {
        require(_tradeId<tradeCounter,"trade doesn't exist");
        // use storage the make the changes permanent
        Trade storage trade = trades[_tradeId];
        require(block.timestamp>trade.arrivalTimestamp + 24 hours,"called within the 24h window");

        require(trade.status == TradeStatus.ARRIVAL_CONFIRMED,"trade status should be ARRIVAL_CONFIRMED");

        trade.status = TradeStatus.CLOSED;

        bool supplierTransferSuccess = usdcToken.transfer(trade.supplierAddress, trade.supplierSecondTranche);
        require(supplierTransferSuccess,"Transfer failed");

        // pay fees to treasury
        bool treasuryTransferSuccess = usdcToken.transfer(trade.treasuryAddress, trade.platformFeesAmount);
        require(treasuryTransferSuccess,"Transfer failed");

        emit FundsReleasedStage2(_tradeId);
    }

    // function callable only in the contract by the functions approveDispute
    function _dispute(uint256 _proposalId) internal {
        DisputeProposal storage proposal = disputeProposals[_proposalId];
        
        require(proposal.approvalCount >= requiredApprovals, "not enough approvals");
        
        proposal.executed = true;
        
        uint256 _tradeId = proposal.tradeId;
        DisputeStatus _disputeStatus = proposal.disputeStatus;
        
        Trade storage trade = trades[_tradeId];
        
        trade.status = TradeStatus.CLOSED;

        if (_disputeStatus == DisputeStatus.REFUND) {
            // if an issue occured -> refund the buyer (tranhche 2 + treasury fees)
            bool refundBuyerSuccess = usdcToken.transfer(trade.buyerAddress, trade.supplierSecondTranche+trade.platformFeesAmount);
            require(refundBuyerSuccess, "refund transfer failed");
        }
        else if (_disputeStatus == DisputeStatus.RESOLVE) {
            // treasury already paid so pay only remaining supplier tranche
            bool resolveSuccess = usdcToken.transfer(trade.supplierAddress, trade.supplierSecondTranche);
            require(resolveSuccess, "transfer to supplier failed");

            bool payTreasurySuccess = usdcToken.transfer(trade.treasuryAddress, trade.platformFeesAmount);
            require(payTreasurySuccess, "refund transfer failed");
        } 
        else {
            revert("invalid dispute status");
        }
        emit DisputeFinalized(_proposalId);
    }

    function proposeDisputeSolution(uint256 _tradeId, DisputeStatus _disputeStatus) external onlyAdmin() returns (uint256) {
        require(_tradeId<tradeCounter,"trade doesn't exist");

        Trade storage trade = trades[_tradeId];

        require(trade.status==TradeStatus.FROZEN, "trade is not frozen");

        uint256 proposalId = disputeCounter;
        disputeCounter++;
        DisputeProposal storage proposal = disputeProposals[proposalId];

        proposal.tradeId = _tradeId;
        proposal.disputeStatus = _disputeStatus;
        proposal.approvalCount = 1;
        proposal.hasApproved[msg.sender] = true;
        proposal.executed = false;
        
        emit DisputeSolution(proposalId, _tradeId, _disputeStatus, msg.sender);
        
        return proposalId;
    }

    // automically call dispute function
    function approveDisputeSolution(uint256 _proposalId) external onlyAdmin nonReentrant{
        require(disputeCounter>_proposalId,"dispute not created");
        DisputeProposal storage proposal = disputeProposals[_proposalId];

        require(!proposal.executed, "proposal already executed");

        uint256 _tradeId = proposal.tradeId;
        Trade memory trade = trades[_tradeId];
        require(trade.status == TradeStatus.FROZEN,"trade is not frozen");

        require(!proposal.hasApproved[msg.sender], "already approved by this admin");

        proposal.hasApproved[msg.sender] = true;
        proposal.approvalCount++;

        emit DisputeApproved(_proposalId, msg.sender, proposal.approvalCount, requiredApprovals);

        if (proposal.approvalCount>=requiredApprovals) {
            _dispute(_proposalId);
        }
    }

    // buyer can open dispute within the window
    function openDispute(uint256 _tradeId) external {
        require(_tradeId<tradeCounter,"trade doesn't exist");
        Trade storage trade = trades[_tradeId];
        require(trade.status==TradeStatus.ARRIVAL_CONFIRMED,"order should be received to call the function");
        require(block.timestamp<trade.arrivalTimestamp + 24 hours, "the function can be called only in the 24 hours window");
        require(trade.buyerAddress==msg.sender,"only buyer can open a dispute");
        trade.status = TradeStatus.FROZEN;
        emit DisputeOpenedByBuyer(_tradeId);
    }

    // called by oracle when order arrived: open 24 hour window
    function confirmArrival(uint256 _tradeId) external onlyOracle {
        require(_tradeId<tradeCounter,"trade doesn't exist");
        Trade storage trade = trades[_tradeId];
        require(trade.status==TradeStatus.IN_TRANSIT,"order status should be IN_TRANSIT");
        trade.status = TradeStatus.ARRIVAL_CONFIRMED;
        trade.arrivalTimestamp = block.timestamp;
        emit ArrivalConfirmed(_tradeId);
    }

    function getNextTradeId() external view returns (uint256) {
        return tradeCounter;
    }
}

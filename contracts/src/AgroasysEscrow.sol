// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * AgroasysEscrow
 * - Milestone escrow (Stage 1 + Stage 2)
 * - Arrival confirmation starts a 24h buyer dispute window
 * - Buyer can freeze during window; admins resolve with 4-eyes approval
 * - Treasury ONLY receives explicit fees (logistics + platform fees) at Stage 1; buyer principal never routes to treasury
 * - Signature uses buyer-scoped nonce (no global tradeId pre-query race) + deadline + domain separation
 *
 * Business rule enforced:
 * - Stage 1 payout (40% milestone) includes: supplierFirstTranche (principal) + logisticsAmount (fee) + platformFeesAmount (fee)
 * - Stage 2 payout (finalization) includes: supplierSecondTranche (principal) ONLY
 */
contract AgroasysEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -----------------------------
    // Constants
    // -----------------------------
    uint256 public constant DISPUTE_WINDOW = 24 hours;

    // -----------------------------
    // Enums / Structs
    // -----------------------------
    enum TradeStatus {
        LOCKED,            // initial deposit
        IN_TRANSIT,        // stage1 released (supplier first tranche + logistics fee + platform fee paid)
        ARRIVAL_CONFIRMED, // oracle confirms arrival; 24h dispute window starts
        FROZEN,            // buyer opened dispute within window
        CLOSED             // finalized or resolved
    }

    enum DisputeStatus {
        REFUND,  // admin resolution: refund buyer remaining escrowed principal (typically supplierSecondTranche)
        RESOLVE  // admin resolution: release remaining escrowed principal to supplier (typically supplierSecondTranche)
    }

    struct Trade {
        uint256 tradeId;
        bytes32 ricardianHash;
        TradeStatus status;
        address buyerAddress;
        address supplierAddress;
        uint256 totalAmountLocked;

        uint256 logisticsAmount;     // paid to treasury at stage1
        uint256 platformFeesAmount;  // paid to treasury at stage1

        uint256 supplierFirstTranche;  // typically 40% (principal component released at stage1)
        uint256 supplierSecondTranche; // typically 60% (principal component released at stage2/finalization)

        uint256 createdAt;
        uint256 arrivalTimestamp; // set on confirmArrival
    }

    struct DisputeProposal {
        uint256 tradeId;
        DisputeStatus disputeStatus;
        uint256 approvalCount;
        bool executed;
        uint256 createdAt;
        address proposer;
    }

    // -----------------------------
    // Storage
    // -----------------------------
    mapping(uint256 => Trade) public trades;
    uint256 public tradeCounter;

    // buyer-scoped nonce to prevent signature replay and global counter races
    mapping(address => uint256) public nonces;

    // dispute proposals
    mapping(uint256 => DisputeProposal) public disputeProposals;
    mapping(uint256 => mapping(address => bool)) public disputeHasApproved;
    mapping(uint256 => bool) public tradeHasActiveDisputeProposal;
    uint256 public disputeCounter;

    // roles
    address public oracleAddress;
    address public treasuryAddress;

    IERC20 public usdcToken;

    address[] public admins;
    mapping(address => bool) public isAdmin;
    uint256 public requiredApprovals;

    // -----------------------------
    // Events
    // -----------------------------
    event TradeLocked(
        uint256 indexed tradeId,
        address indexed buyer,
        address indexed supplier,
        uint256 totalAmount,
        uint256 logisticsAmount,
        uint256 platformFeesAmount,
        uint256 supplierFirstTranche,
        uint256 supplierSecondTranche,
        bytes32 ricardianHash
    );

    event FundsReleasedStage1(
        uint256 indexed tradeId,
        address indexed supplier,
        uint256 supplierFirstTranche,
        address indexed treasury,
        uint256 logisticsAmount
    );

    // Added: explicit event for platform fee payout in Stage 1 (so indexers/auditors see it)
    event PlatformFeesPaidStage1(
        uint256 indexed tradeId,
        address indexed treasury,
        uint256 platformFeesAmount
    );

    event ArrivalConfirmed(uint256 indexed tradeId, uint256 arrivalTimestamp);

    // NOTE: Stage 2 now pays supplierSecondTranche ONLY (no treasury payment).
    // This event is kept as-is for backward compatibility, but is no longer emitted.
    event FundsReleasedStage2(
        uint256 indexed tradeId,
        address indexed supplier,
        uint256 supplierSecondTranche,
        address indexed treasury,
        uint256 platformFeesAmount
    );

    // Added: explicit final tranche event for Stage 2/finalization
    event FinalTrancheReleased(
        uint256 indexed tradeId,
        address indexed supplier,
        uint256 supplierSecondTranche
    );

    event DisputeOpenedByBuyer(uint256 indexed tradeId);

    event DisputeSolutionProposed(
        uint256 indexed proposalId,
        uint256 indexed tradeId,
        DisputeStatus disputeStatus,
        address indexed proposer
    );

    event DisputeApproved(
        uint256 indexed proposalId,
        address indexed approver,
        uint256 approvalCount,
        uint256 requiredApprovals
    );

    event DisputeFinalized(
        uint256 indexed proposalId,
        uint256 indexed tradeId,
        DisputeStatus disputeStatus
    );

    // -----------------------------
    // Constructor / Modifiers
    // -----------------------------
    constructor(
        address _usdcToken,
        address _oracleAddress,
        address _treasuryAddress,
        address[] memory _admins,
        uint256 _requiredApprovals
    ) {
        require(_usdcToken != address(0), "invalid token");
        require(_oracleAddress != address(0), "invalid oracle");
        require(_treasuryAddress != address(0), "invalid treasury");
        require(_requiredApprovals > 0, "required approvals must be > 0");
        require(_admins.length >= _requiredApprovals, "not enough admins");

        usdcToken = IERC20(_usdcToken);
        oracleAddress = _oracleAddress;
        treasuryAddress = _treasuryAddress;
        requiredApprovals = _requiredApprovals;

        for (uint256 i = 0; i < _admins.length; i++) {
            address admin = _admins[i];
            require(admin != address(0), "bad admin");
            require(!isAdmin[admin], "duplicate admin");
            admins.push(admin);
            isAdmin[admin] = true;
        }
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "only admin");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "only oracle");
        _;
    }

    // -----------------------------
    // Signature Verification (buyer nonce + deadline)
    // -----------------------------
    function _verifySignature(
        address buyer,
        address supplier,
        uint256 totalAmount,
        uint256 logisticsAmount,
        uint256 platformFeesAmount,
        uint256 supplierFirstTranche,
        uint256 supplierSecondTranche,
        bytes32 ricardianHash,
        uint256 buyerNonce,
        uint256 deadline,
        bytes memory signature
    ) internal view returns (address) {
        require(block.timestamp <= deadline, "signature expired");

        // Domain separation: chain + contract address
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                buyer,
                supplier,
                treasuryAddress,
                totalAmount,
                logisticsAmount,
                platformFeesAmount,
                supplierFirstTranche,
                supplierSecondTranche,
                ricardianHash,
                buyerNonce,
                deadline
            )
        );

        // EIP-191 personal_sign style
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return ECDSA.recover(ethSignedHash, signature);
    }

    // -----------------------------
    // Trade Creation
    // -----------------------------
    function createTrade(
        address _supplier,
        uint256 _totalAmount,
        uint256 _logisticsAmount,
        uint256 _platformFeesAmount,
        uint256 _supplierFirstTranche,
        uint256 _supplierSecondTranche,
        bytes32 _ricardianHash,
        uint256 _buyerNonce,
        uint256 _deadline,
        bytes memory _signature
    ) external nonReentrant returns (uint256) {
        require(_ricardianHash != bytes32(0), "ricardian hash required");
        require(_supplier != address(0), "supplier required");

        uint256 totalExpected = _logisticsAmount
            + _platformFeesAmount
            + _supplierFirstTranche
            + _supplierSecondTranche;

        require(_totalAmount == totalExpected, "breakdown mismatch");
        require(_supplierFirstTranche > 0 && _supplierSecondTranche > 0, "tranches must be > 0");

        // Nonce must match current buyer nonce
        require(_buyerNonce == nonces[msg.sender], "bad nonce");

        // Verify signature binds all critical fields + nonce + deadline + domain separation
        address signer = _verifySignature(
            msg.sender,
            _supplier,
            _totalAmount,
            _logisticsAmount,
            _platformFeesAmount,
            _supplierFirstTranche,
            _supplierSecondTranche,
            _ricardianHash,
            _buyerNonce,
            _deadline,
            _signature
        );
        require(signer == msg.sender, "bad signature");

        // Effects (increment nonce & create trade id) before external calls
        nonces[msg.sender] = _buyerNonce + 1;
        uint256 newTradeId = tradeCounter;
        tradeCounter++;

        trades[newTradeId] = Trade({
            tradeId: newTradeId,
            ricardianHash: _ricardianHash,
            status: TradeStatus.LOCKED,
            buyerAddress: msg.sender,
            supplierAddress: _supplier,
            totalAmountLocked: _totalAmount,
            logisticsAmount: _logisticsAmount,
            platformFeesAmount: _platformFeesAmount,
            supplierFirstTranche: _supplierFirstTranche,
            supplierSecondTranche: _supplierSecondTranche,
            createdAt: block.timestamp,
            arrivalTimestamp: 0
        });

        // Interactions (transfer funds into escrow)
        usdcToken.safeTransferFrom(msg.sender, address(this), _totalAmount);

        emit TradeLocked(
            newTradeId,
            msg.sender,
            _supplier,
            _totalAmount,
            _logisticsAmount,
            _platformFeesAmount,
            _supplierFirstTranche,
            _supplierSecondTranche,
            _ricardianHash
        );

        return newTradeId;
    }

    // -----------------------------
    // Milestones
    // -----------------------------

    /**
     * Stage 1 release:
     * - Only oracle
     * - LOCKED -> IN_TRANSIT
     * - Pay supplier first tranche (principal)
     * - Pay logistics fee to treasury
     * - Pay platform fee to treasury
     */
    function releaseFundsStage1(uint256 _tradeId) external onlyOracle nonReentrant {
        require(_tradeId < tradeCounter, "trade not found");
        Trade storage trade = trades[_tradeId];

        require(trade.status == TradeStatus.LOCKED, "status must be LOCKED");

        trade.status = TradeStatus.IN_TRANSIT;

        usdcToken.safeTransfer(trade.supplierAddress, trade.supplierFirstTranche);
        usdcToken.safeTransfer(treasuryAddress, trade.logisticsAmount);
        usdcToken.safeTransfer(treasuryAddress, trade.platformFeesAmount);

        emit FundsReleasedStage1(
            _tradeId,
            trade.supplierAddress,
            trade.supplierFirstTranche,
            treasuryAddress,
            trade.logisticsAmount
        );

        emit PlatformFeesPaidStage1(_tradeId, treasuryAddress, trade.platformFeesAmount);
    }

    /**
     * Arrival confirmation starts dispute window.
     * Only oracle can confirm arrival.
     */
    function confirmArrival(uint256 _tradeId) external onlyOracle nonReentrant {
        require(_tradeId < tradeCounter, "trade not found");
        Trade storage trade = trades[_tradeId];

        require(trade.status == TradeStatus.IN_TRANSIT, "status must be IN_TRANSIT");

        trade.status = TradeStatus.ARRIVAL_CONFIRMED;
        trade.arrivalTimestamp = block.timestamp;

        emit ArrivalConfirmed(_tradeId, trade.arrivalTimestamp);
    }

    /**
     * Buyer can open a dispute within 24h after arrival confirmation.
     * This freezes remaining funds until admin resolution.
     */
    function openDispute(uint256 _tradeId) external nonReentrant {
        require(_tradeId < tradeCounter, "trade not found");
        Trade storage trade = trades[_tradeId];

        require(trade.buyerAddress == msg.sender, "only buyer");
        require(trade.status == TradeStatus.ARRIVAL_CONFIRMED, "must be ARRIVAL_CONFIRMED");
        require(trade.arrivalTimestamp > 0, "arrival not set");
        require(block.timestamp <= trade.arrivalTimestamp + DISPUTE_WINDOW, "window closed");

        trade.status = TradeStatus.FROZEN;

        emit DisputeOpenedByBuyer(_tradeId);
    }

    /**
     * Final settlement after dispute window if no dispute was opened.
     * Permissionless (anyone can call) to avoid funds getting stuck if oracle is down.
     *
     * Business rule: Stage 2 releases ONLY remaining supplier principal (supplierSecondTranche).
     * Treasury fees were already collected at Stage 1.
     */
    function finalizeAfterDisputeWindow(uint256 _tradeId) external nonReentrant {
        require(_tradeId < tradeCounter, "trade not found");
        Trade storage trade = trades[_tradeId];

        require(trade.status == TradeStatus.ARRIVAL_CONFIRMED, "must be ARRIVAL_CONFIRMED");
        require(trade.arrivalTimestamp > 0, "arrival not set");
        require(block.timestamp > trade.arrivalTimestamp + DISPUTE_WINDOW, "window not elapsed");

        trade.status = TradeStatus.CLOSED;

        usdcToken.safeTransfer(trade.supplierAddress, trade.supplierSecondTranche);

        emit FinalTrancheReleased(_tradeId, trade.supplierAddress, trade.supplierSecondTranche);
    }

    // -----------------------------
    // Dispute Resolution (Admins, 4-eyes)
    // -----------------------------
    function proposeDisputeSolution(uint256 _tradeId, DisputeStatus _disputeStatus)
        external
        onlyAdmin
        returns (uint256)
    {
        require(_tradeId < tradeCounter, "trade not found");
        Trade storage trade = trades[_tradeId];

        require(trade.status == TradeStatus.FROZEN, "trade not frozen");
        require(!tradeHasActiveDisputeProposal[_tradeId], "active proposal exists");

        uint256 proposalId = disputeCounter;
        disputeCounter++;

        disputeProposals[proposalId] = DisputeProposal({
            tradeId: _tradeId,
            disputeStatus: _disputeStatus,
            approvalCount: 1,
            executed: false,
            createdAt: block.timestamp,
            proposer: msg.sender
        });

        disputeHasApproved[proposalId][msg.sender] = true;
        tradeHasActiveDisputeProposal[_tradeId] = true;

        emit DisputeSolutionProposed(proposalId, _tradeId, _disputeStatus, msg.sender);

        // auto-execute if requiredApprovals == 1 (rare, but supported)
        if (requiredApprovals == 1) {
            _executeDispute(proposalId);
        }

        return proposalId;
    }

    function approveDisputeSolution(uint256 _proposalId) external onlyAdmin nonReentrant {
        require(_proposalId < disputeCounter, "proposal not found");

        DisputeProposal storage proposal = disputeProposals[_proposalId];
        require(proposal.createdAt > 0, "proposal not initialized");
        require(!proposal.executed, "already executed");

        Trade storage trade = trades[proposal.tradeId];
        require(trade.status == TradeStatus.FROZEN, "trade not frozen");

        require(!disputeHasApproved[_proposalId][msg.sender], "already approved");

        disputeHasApproved[_proposalId][msg.sender] = true;
        proposal.approvalCount++;

        emit DisputeApproved(_proposalId, msg.sender, proposal.approvalCount, requiredApprovals);

        if (proposal.approvalCount >= requiredApprovals) {
            _executeDispute(_proposalId);
        }
    }

    function _executeDispute(uint256 _proposalId) internal {
        DisputeProposal storage proposal = disputeProposals[_proposalId];

        require(!proposal.executed, "already executed");
        require(proposal.approvalCount >= requiredApprovals, "not enough approvals");

        Trade storage trade = trades[proposal.tradeId];
        require(trade.status == TradeStatus.FROZEN, "trade must be FROZEN");

        proposal.executed = true;
        trade.status = TradeStatus.CLOSED;
        tradeHasActiveDisputeProposal[proposal.tradeId] = false;

        // NOTE: Platform/logistics fees were already paid at Stage 1 and are not refunded via escrow.
        if (proposal.disputeStatus == DisputeStatus.REFUND) {
            // Refund buyer remaining escrowed principal (supplierSecondTranche)
            usdcToken.safeTransfer(trade.buyerAddress, trade.supplierSecondTranche);
        } else if (proposal.disputeStatus == DisputeStatus.RESOLVE) {
            // Release remaining escrowed principal to supplier (supplierSecondTranche)
            usdcToken.safeTransfer(trade.supplierAddress, trade.supplierSecondTranche);
        } else {
            revert("invalid dispute status");
        }

        emit DisputeFinalized(_proposalId, proposal.tradeId, proposal.disputeStatus);
    }

    // -----------------------------
    // View helpers
    // -----------------------------
    function getNextTradeId() external view returns (uint256) {
        return tradeCounter;
    }

    function getBuyerNonce(address buyer) external view returns (uint256) {
        return nonces[buyer];
    }
}

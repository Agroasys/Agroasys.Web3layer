// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {AgroasysEscrow} from "../src/AgroasysEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";


contract Handler is Test {
    AgroasysEscrow public escrow;
    MockUSDC public usdc;

    address public treasury;
    address public oracle;
    address public admin1;
    address public admin2;


    // variable to track in invariable tests
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public tradesCreated;
    uint256 public releaseStage1Triggered;
    uint256 public releaseStage2Triggered;
    uint256 public disputedRaised;
    uint256 public disputeSolved;

    constructor(AgroasysEscrow _escrow, MockUSDC _usdc, address _treasury, address _oracle, address _admin1, address _admin2){
        escrow = _escrow;
        usdc = _usdc;
        treasury = _treasury;
        oracle = _oracle;
        admin1 = _admin1;
        admin2 = _admin2;
    }

    function createTrade(uint96 logistics, uint96 fees, uint96 tranche1, uint96 tranche2,bytes32 ricardianHash, address buyer, address supplier) public {
        vm.assume(ricardianHash != bytes32(0));
        vm.assume(buyer != address(0));
        vm.assume(supplier != address(0));
        
        logistics = uint96(bound(logistics, 1000e6, 10_000e6));
        fees = uint96(bound(fees, 500e6, 5_000e6));
        tranche1 = uint96(bound(tranche1, 10_000e6, 100_000e6));
        tranche2 = uint96(bound(tranche2, 10_000e6, 100_000e6));
        
        uint256 total = logistics + fees + tranche1 + tranche2;

        usdc.mint(buyer, total);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), total);
        escrow.createTrade(supplier,treasury,total,logistics,fees,tranche1,tranche2,ricardianHash);
        vm.stopPrank();

        totalDeposited += total;
        tradesCreated++;
    }

    // add condition to test only valid calls
    function releaseFundsStage1(uint96 random_tradeId) public {
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            return;
        }

        uint256 tradeId = random_tradeId % tradeCount;

        (,,AgroasysEscrow.TradeStatus status,,,,,,,,,,) = escrow.trades(tradeId);

        if (status != AgroasysEscrow.TradeStatus.LOCKED) {
            return;
        }

        vm.prank(oracle);
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);
        (,,,,,,, uint256 logistics, uint256 fees, uint256 tranche1,,,) = escrow.trades(tradeId);
        totalWithdrawn += logistics + fees + tranche1;
        releaseStage1Triggered++;
    }

    // add condition to test only valid calls
    function releaseFundsStage2(uint96 random_tradeId) public {
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            return;
        }

        uint256 tradeId = random_tradeId % tradeCount;

        (,,AgroasysEscrow.TradeStatus status,,,,,,,,,,) = escrow.trades(tradeId);

        if (status != AgroasysEscrow.TradeStatus.IN_TRANSIT) {
            return;
        }

        vm.prank(oracle);
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.CLOSED);
        (,,,,,,,,,,uint256 tranche2,,) = escrow.trades(tradeId);
        totalWithdrawn += tranche2;
        releaseStage2Triggered++;
    }

    // add condition to test only valid calls
    function proposeDispute(uint96 random_tradeId, uint8 _disputeStatus) public {
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            return;
        }

        uint256 tradeId = random_tradeId % tradeCount;

        (,,AgroasysEscrow.TradeStatus status,,,,,,,,,,uint256 updatedAt) = escrow.trades(tradeId);
        if (status==AgroasysEscrow.TradeStatus.CLOSED||status==AgroasysEscrow.TradeStatus.DISPUTED){
            return;
        }

        // we just have 3 possibilities
        _disputeStatus = _disputeStatus% 3;

        vm.warp(updatedAt + 7 days);

        vm.prank(admin1);
        escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus(_disputeStatus));
        disputedRaised++;
    }

    // add condition to test only valid calls
    function approveDispute(uint96 random_proposalId) public {
        uint256 disputeCount = escrow.disputeCounter();

        if (disputeCount==0){
            return;
        }

        uint256 proposalId = random_proposalId%disputeCount;

        (uint256 tradeId,,,,) = escrow.disputeProposals(proposalId);


        (,,AgroasysEscrow.TradeStatus statusOld,,,,,,,,,,) = escrow.trades(tradeId);

        if (statusOld==AgroasysEscrow.TradeStatus.DISPUTED||statusOld==AgroasysEscrow.TradeStatus.CLOSED){
            return;
        }

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        (,,AgroasysEscrow.TradeStatus statusNew,,,,uint256 total,,,,uint256 tranche2,,) = escrow.trades(tradeId);

        if (statusNew==AgroasysEscrow.TradeStatus.DISPUTED){
            disputeSolved++;
            if (statusOld==AgroasysEscrow.TradeStatus.LOCKED){
                totalWithdrawn+=total;
            }
            else if (statusOld==AgroasysEscrow.TradeStatus.IN_TRANSIT){
                totalWithdrawn+=tranche2;
            }
        }
    }


    // let the contract to be called with invalid inputs to check if it doesn't break
    function releaseFundsStage1AllowRevert(uint96 random_tradeId) public {
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            return;
        }

        uint256 tradeId = random_tradeId % tradeCount;

        vm.prank(oracle);
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);
        (,,,,,,, uint256 logistics, uint256 fees, uint256 tranche1,,,) = escrow.trades(tradeId);
        totalWithdrawn += logistics + fees + tranche1;
        releaseStage1Triggered++;
    }

    // let the contract to be called with invalid inputs to check if it doesn't break
    function releaseFundsStage2AllowRevert(uint96 random_tradeId) public {
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            return;
        }

        uint256 tradeId = random_tradeId % tradeCount;

        vm.prank(oracle);
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.CLOSED);
        (,,,,,,,,,,uint256 tranche2,,) = escrow.trades(tradeId);
        totalWithdrawn += tranche2;
        releaseStage2Triggered++;
    }

    // let the contract to be called with invalid inputs to check if it doesn't break
    function proposeDisputeAllowRevert(uint96 random_tradeId, uint8 _disputeStatus) public {
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            return;
        }

        uint256 tradeId = random_tradeId % tradeCount;

        (,,,,,,,,,,,,uint256 updatedAt) = escrow.trades(tradeId);

        // we just have 3 possibilities
        _disputeStatus = _disputeStatus% 3;

        // call the propose dispute between 1 and 14 days to let the function revert if it's too early
        uint8 daysAfter = uint8(bound(1,14,random_tradeId));

        vm.warp(updatedAt + daysAfter * 1 days);

        vm.prank(admin1);
        escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus(_disputeStatus));
        disputedRaised++;
    }

    // let the contract to be called with invalid inputs to check if it doesn't break
    function approveDisputeAllowRevert(uint96 random_proposalId) public {
        uint256 disputeCount = escrow.disputeCounter();

        if (disputeCount==0){
            return;
        }

        uint256 proposalId = random_proposalId%disputeCount;

        (uint256 tradeId,,,,) = escrow.disputeProposals(proposalId);


        (,,AgroasysEscrow.TradeStatus statusOld,,,,,,,,,,) = escrow.trades(tradeId);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        (,,AgroasysEscrow.TradeStatus statusNew,,,,uint256 total,,,,uint256 tranche2,,) = escrow.trades(tradeId);

        if (statusNew==AgroasysEscrow.TradeStatus.DISPUTED){
            disputeSolved++;
            if (statusOld==AgroasysEscrow.TradeStatus.LOCKED){
                totalWithdrawn+=total;
            }
            else if (statusOld==AgroasysEscrow.TradeStatus.IN_TRANSIT){
                totalWithdrawn+=tranche2;
            }
        }
    }


    function releaseFundsStage1RandomAddress(uint96 random_tradeId, address random_oracle) public {
        vm.assume(random_oracle!=address(0));
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            revert();
        }

        uint256 tradeId = random_tradeId % tradeCount;

        (,,AgroasysEscrow.TradeStatus status,,,,,,,,,,) = escrow.trades(tradeId);

        if (status != AgroasysEscrow.TradeStatus.LOCKED) {
            revert();
        }

        vm.prank(random_oracle);
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);
        (,,,,,,, uint256 logistics, uint256 fees, uint256 tranche1,,,) = escrow.trades(tradeId);
        totalWithdrawn += logistics + fees + tranche1;
        releaseStage1Triggered++;
    }

    function releaseFundsStage2RandomAddress(uint96 random_tradeId, address random_oracle) public {
        vm.assume(random_oracle!=address(0));
        uint256 tradeCount = escrow.tradeCounter();
        if (tradeCount==0){
            revert();
        }

        uint256 tradeId = random_tradeId % tradeCount;

        (,,AgroasysEscrow.TradeStatus status,,,,,,,,,,) = escrow.trades(tradeId);

        if (status != AgroasysEscrow.TradeStatus.IN_TRANSIT) {
            revert();
        }

        vm.prank(random_oracle);
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.CLOSED);
        (,,,,,,,,,,uint256 tranche2,,) = escrow.trades(tradeId);
        totalWithdrawn += tranche2;
        releaseStage2Triggered++;
    }
}



contract InvariantTest is Test {
    AgroasysEscrow public escrow;
    MockUSDC public usdc;
    Handler public handler;

    address buyer;
    address supplier;
    address treasury;
    address oracle;
    address admin1;
    address admin2;
    address admin3;


    function setUp() public {
        treasury = makeAddr("treasury");
        oracle = makeAddr("oracle");
        admin1 = makeAddr("admin1");
        admin2 = makeAddr("admin2");
        admin3 = makeAddr("admin3");

        usdc = new MockUSDC();

        address[] memory admins = new address[](3);
        admins[0] = admin1;
        admins[1] = admin2;
        admins[2] = admin3;

        escrow = new AgroasysEscrow(address(usdc), oracle, admins, 2);

        handler = new Handler(escrow,usdc,treasury,oracle,admin1,admin2);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](11);
        selectors[0] = Handler.createTrade.selector;
        selectors[1] = Handler.releaseFundsStage1.selector;
        selectors[2] = Handler.releaseFundsStage2.selector;
        selectors[3] = Handler.proposeDispute.selector;
        selectors[4] = Handler.approveDispute.selector;
        selectors[5] = Handler.releaseFundsStage1AllowRevert.selector;
        selectors[6] = Handler.releaseFundsStage2AllowRevert.selector;
        selectors[7] = Handler.proposeDisputeAllowRevert.selector;
        selectors[8] = Handler.approveDisputeAllowRevert.selector;
        selectors[9] = Handler.releaseFundsStage1RandomAddress.selector;
        selectors[10] = Handler.releaseFundsStage2RandomAddress.selector;
        
        targetSelector(
            FuzzSelector({addr: address(handler),selectors: selectors})
        );
    }

    function _Summary() internal view {
        console2.log("Total trades:", uint256(handler.tradesCreated()));
        console2.log("Total locked in the escrow (USDC):", uint256(usdc.balanceOf(address(escrow))/1e6));
        console2.log("Total deposited (USDC):", uint256(handler.totalDeposited()/1e6));
        console2.log("Total withdrawn (USDC):", uint256(handler.totalWithdrawn()/1e6));
        console2.log("Total triger stage 1:", uint256(handler.releaseStage1Triggered()));
        console2.log("Total triger stage 2:", uint256(handler.releaseStage2Triggered()));
        console2.log("Total dispute raised:", uint256(handler.disputedRaised()));
        console2.log("Total dispute solved:", uint256(handler.disputeSolved()));
    }


    function invariant_EscrowBalanceMatchesLockedFunds() public view {
        uint256 totalLocked = 0;
        
        for (uint256 i = 0; i < escrow.tradeCounter(); i++) {
            (,,AgroasysEscrow.TradeStatus status,,,,uint256 total,,,,uint256 tranche2,,) = escrow.trades(i);
            
            if (status == AgroasysEscrow.TradeStatus.LOCKED) {
                totalLocked += total;
            } else if (status == AgroasysEscrow.TradeStatus.IN_TRANSIT) {
                totalLocked += tranche2;
            }
        }
        assertEq(usdc.balanceOf(address(escrow)),totalLocked,"Escrow balance doesn't match locked funds");
        _Summary();
    }

    function invariant_EscrowFundsConservation() public view {
        uint256 amountRemaining = handler.totalDeposited()-handler.totalWithdrawn();
        uint256 escrowBalance = usdc.balanceOf(address(escrow));
        assertEq(escrowBalance,amountRemaining,"Escrow balance doesn't match 'deposited-withdrawn'");
        _Summary();
    }

    function invariant_TotalWithdrawnNeverExceedsDeposited() public view {
        assertGe(handler.totalDeposited(),handler.totalWithdrawn(),"Withdrawn > deposited");
        _Summary();
    }

    function invariant_TradeCreationNumber() public view {
        assertEq(handler.tradesCreated(),escrow.tradeCounter(),"create trade calls don't match the number of trade created");
        _Summary();
    }

    function invariant_DisputesSolvedMatches() public view {
        uint256 disputedCount = 0;
        for (uint256 i = 0; i < escrow.tradeCounter(); i++) {
            (,,AgroasysEscrow.TradeStatus status,,,,,,,,,,) = escrow.trades(i);
            
            if (status == AgroasysEscrow.TradeStatus.DISPUTED) {
                disputedCount ++;
            }
        }
        assertEq(disputedCount,handler.disputeSolved(),"Dispute solved in the contract doesn't match the number of dispute() calls");
        _Summary();
    }

    function invariant_TriggerStage1GreaterThanTriggerStage2() public view {
        assertGe(handler.releaseStage1Triggered(),handler.releaseStage2Triggered(),"stage 1 should be more triggered or equal than stage 2");
        _Summary();
    }

    function invariant_DisputeRaisedGreaterThanDisputeSolved() public view {
        assertGe(handler.disputedRaised(),handler.disputeSolved(),"dispute raised should be more called or equal than dispute solved");
        _Summary();
    }

    function invariant_TranchesSumEqualsTotal() public view {
        for (uint256 i = 0; i < escrow.tradeCounter(); i++) {
            (,,,,,,uint256 total, uint256 logistics, uint256 fees, uint256 tranche1, uint256 tranche2,,) = escrow.trades(i);
            assertEq(logistics + fees + tranche1 + tranche2,total,"tranches sum doesn't match total");
        }
        _Summary();
    }
}
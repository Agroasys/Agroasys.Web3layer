// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {AgroasysEscrow} from "../src/AgroasysEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract FuzzTest is Test {
    AgroasysEscrow public escrow;
    MockUSDC public usdc;
    address buyer = makeAddr("buyer");
    address supplier = makeAddr("supplier");
    address treasury = makeAddr("treasury");
    address oracle = makeAddr("oracle");
    address admin1 = makeAddr("admin1");
    address admin2 = makeAddr("admin2");
    address admin3 = makeAddr("admin3");

    bytes32 ricardianHash = bytes32(bytes("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"));
    
    function setUp() public {
        usdc = new MockUSDC();
        usdc.mint(buyer, 10_000_000e6);
        
        address[] memory admins = new address[](3);
        admins[0] = admin1;
        admins[1] = admin2;
        admins[2] = admin3;
        
        escrow = new AgroasysEscrow(address(usdc), oracle, admins, 2);
    }

    // helper function
    function _create_trade(uint256 logistics, uint256 fees, uint256 tranche1, uint256 tranche2) internal returns (uint256){
        uint256 total = logistics + fees + tranche1 + tranche2;

        vm.startPrank(buyer);
        usdc.approve(address(escrow), total); // aprove usdc contract
        uint256 tradeId = escrow.createTrade(supplier, treasury, total, logistics, fees, tranche1, tranche2, ricardianHash);
        vm.stopPrank();
        return tradeId;
    }
    
    function test_Setup() public view {
        assertEq(escrow.oracleAddress(), oracle);
        assertEq(usdc.balanceOf(buyer), 10_000_000e6);
    }
    
    function testFuzz_CreateTrade(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 0 && logistics < 1_000_000e6);
        vm.assume(fees > 0 && fees < 1_000_000e6);
        vm.assume(tranche1 > 0 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 0 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);

        uint256 buyerBeforeBalance = usdc.balanceOf(buyer);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        uint256 tradeId = _create_trade(logistics,fees,tranche1,tranche2);
        
        (uint256 _tradeId,,AgroasysEscrow.TradeStatus _status,address _buyer,address _supplier,address _treasury,uint256 _total,uint256 _logistics,uint256 _fees,uint256 _tranche1,uint256 _tranche2,,) = escrow.trades(tradeId);

        // check that trades values are stored correctly
        assertEq(_tradeId, tradeId, "trade id mismatch");
        assertEq(_buyer,buyer,"buyer mismatch");
        assertEq(_supplier, supplier, "supplier mismatch");
        assertEq(_treasury, treasury, "treasury mismatch");
        assertEq(uint8(_status), uint8(AgroasysEscrow.TradeStatus.LOCKED), "status should be LOCKED");
        assertEq(_total, total, "total mismatch");
        assertEq(_logistics, logistics, "logistics mismatch");
        assertEq(_fees, fees, "fees mismatch");
        assertEq(_tranche1, tranche1, "tranche1 mismatch");
        assertEq(_tranche2, tranche2, "tranche2 mismatch");
        assertEq(_total, _logistics + _fees + _tranche1 + _tranche2, "total mismatch sum of logistic+fees+tranche1&2");
        
        // check that balances are correct
        assertEq(usdc.balanceOf(buyer),buyerBeforeBalance-total,"buyer balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)),escrowBeforeBalance+total,"escrow balance mismatch");
    }


    function testFuzz_ReleaseFunds(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public{
        vm.assume(logistics > 0 && logistics < 1_000_000e6);
        vm.assume(fees > 0 && fees < 1_000_000e6);
        vm.assume(tranche1 > 0 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 0 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);

        uint256 tradeId = _create_trade(logistics,fees,tranche1,tranche2);

        uint256 buyerBeforeBalance = usdc.balanceOf(buyer);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));

        vm.prank(oracle);
        // release stage 1
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);

        // check if balance of buyer, supplier, treasury is correct after the first release
        assertEq(usdc.balanceOf(buyer),buyerBeforeBalance,"buyer balance mismatch");
        assertEq(usdc.balanceOf(treasury),logistics+fees,"treasury balance amount");
        assertEq(usdc.balanceOf(supplier),tranche1,"supplier balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)),escrowBeforeBalance-tranche1-logistics-fees,"escrow balance mismatch");

        vm.prank(oracle);
        // release stage 2
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.CLOSED);

        // check if balance of buyer, supplier, treasury is correct after the second release
        assertEq(usdc.balanceOf(buyer),buyerBeforeBalance,"buyer balance mismatch");
        assertEq(usdc.balanceOf(treasury),logistics+fees,"treasury balance amount");
        assertEq(usdc.balanceOf(supplier),tranche1+tranche2,"supplier balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)),escrowBeforeBalance-tranche1-logistics-fees-tranche2,"escrow balance mismatch");
    }


    function testFuzz_Dispute_REFUND_funds_LOCKED(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 100 && logistics < 100_000e6);
        vm.assume(fees > 100 && fees < 100_000e6);
        vm.assume(tranche1 > 100 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 100 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        uint256 tradeId = _create_trade(logistics, fees, tranche1, tranche2);

        uint256 buyerBeforeBalance = usdc.balanceOf(buyer);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        // increase 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(admin1);
        uint256 proposalId = escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus.REFUND);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        assertEq(usdc.balanceOf(buyer),buyerBeforeBalance+total,"buyer balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)),escrowBeforeBalance-total,"escrow balance mismatch");
    }


    function testFuzz_Dispute_REFUND_funds_IN_TRANSIT(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 100 && logistics < 100_000e6);
        vm.assume(fees > 100 && fees < 100_000e6);
        vm.assume(tranche1 > 100 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 100 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        uint256 tradeId = _create_trade(logistics, fees, tranche1, tranche2);

        vm.prank(oracle);
        // release stage 1
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);


        uint256 buyerBeforeBalance = usdc.balanceOf(buyer);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        // increase 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(admin1);
        uint256 proposalId = escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus.REFUND);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        assertEq(usdc.balanceOf(buyer),buyerBeforeBalance+tranche2,"buyer balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)),escrowBeforeBalance-tranche2,"escrow balance mismatch");
    }

    function testFuzz_Dispute_RESOLVE_funds_LOCKED(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 100 && logistics < 100_000e6);
        vm.assume(fees > 100 && fees < 100_000e6);
        vm.assume(tranche1 > 100 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 100 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        uint256 tradeId = _create_trade(logistics, fees, tranche1, tranche2);

        uint256 treasuryBeforeBalance = usdc.balanceOf(treasury);
        uint256 supplierBeforeBalance = usdc.balanceOf(supplier);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        // increase 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(admin1);
        uint256 proposalId = escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus.RESOLVE);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        assertEq(usdc.balanceOf(treasury), treasuryBeforeBalance + logistics + fees, "treasury balance mismatch");
        assertEq(usdc.balanceOf(supplier), supplierBeforeBalance + tranche1 + tranche2, "supplier balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)), escrowBeforeBalance - total, "escrow balance mismatch");
    }


    function testFuzz_Dispute_RESOLVE_funds_IN_TRANSIT(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 100 && logistics < 100_000e6);
        vm.assume(fees > 100 && fees < 100_000e6);
        vm.assume(tranche1 > 100 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 100 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        uint256 tradeId = _create_trade(logistics, fees, tranche1, tranche2);

        vm.prank(oracle);
        // release stage 1
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);

        uint256 supplierBeforeBalance = usdc.balanceOf(supplier);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        // increase 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(admin1);
        uint256 proposalId = escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus.RESOLVE);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        assertEq(usdc.balanceOf(supplier), supplierBeforeBalance + tranche2, "supplier balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)), escrowBeforeBalance - tranche2, "escrow balance mismatch");
    }


    function testFuzz_Dispute_PARTICULAR_ISSUE_funds_LOCKED(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 100 && logistics < 100_000e6);
        vm.assume(fees > 100 && fees < 100_000e6);
        vm.assume(tranche1 > 100 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 100 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        uint256 tradeId = _create_trade(logistics, fees, tranche1, tranche2);

        uint256 treasuryBeforeBalance = usdc.balanceOf(treasury);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        // increase 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(admin1);
        uint256 proposalId = escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus.PARTICULAR_ISSUE);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        assertEq(usdc.balanceOf(treasury), treasuryBeforeBalance + total, "treasury balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)), escrowBeforeBalance - total, "escrow balance mismatch");
    }


    function testFuzz_Dispute_PARTICULAR_ISSUE_funds_IN_TRANSIT(uint96 logistics,uint96 fees,uint96 tranche1,uint96 tranche2) public {
        vm.assume(logistics > 100 && logistics < 100_000e6);
        vm.assume(fees > 100 && fees < 100_000e6);
        vm.assume(tranche1 > 100 && tranche1 < 1_000_000e6);
        vm.assume(tranche2 > 100 && tranche2 < 1_000_000e6);
        
        uint256 total = logistics + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        uint256 tradeId = _create_trade(logistics, fees, tranche1, tranche2);

        vm.prank(oracle);
        // release stage 1
        escrow.releaseFunds(tradeId, AgroasysEscrow.TradeStatus.IN_TRANSIT);

        uint256 treasuryBeforeBalance = usdc.balanceOf(treasury);
        uint256 escrowBeforeBalance = usdc.balanceOf(address(escrow));
        
        // increase 7 days
        vm.warp(block.timestamp + 7 days);

        vm.prank(admin1);
        uint256 proposalId = escrow.proposeDispute(tradeId, AgroasysEscrow.DisputeStatus.PARTICULAR_ISSUE);

        vm.prank(admin2);
        escrow.approveDispute(proposalId);

        assertEq(usdc.balanceOf(treasury), treasuryBeforeBalance + tranche2, "treasury balance mismatch");
        assertEq(usdc.balanceOf(address(escrow)), escrowBeforeBalance - tranche2, "escrow balance mismatch");
    }
}
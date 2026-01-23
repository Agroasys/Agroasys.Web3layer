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
    
    function setUp() public {
        usdc = new MockUSDC();
        usdc.mint(buyer, 10_000_000e6);
        
        address[] memory admins = new address[](3);
        admins[0] = admin1;
        admins[1] = admin2;
        admins[2] = admin3;
        
        escrow = new AgroasysEscrow(address(usdc), oracle, admins, 2);
        
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
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
        
        uint256 total = uint256(logistics) + fees + tranche1 + tranche2;
        vm.assume(total <= 10_000_000e6);
        
        vm.prank(buyer);
        uint256 tradeId = escrow.createTrade(supplier,treasury,total,logistics,fees,tranche1,tranche2,bytes32(bytes("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")));
        
        (,,,,,, uint256 locked,,,,,,) = escrow.trades(tradeId);
        assertEq(locked, total, "locked amount mismatch");
        assertEq(usdc.balanceOf(address(escrow)), total, "escrow balance mismatch");
    }

}
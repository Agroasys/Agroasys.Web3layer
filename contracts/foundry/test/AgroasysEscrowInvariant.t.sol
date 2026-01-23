// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {AgroasysEscrow} from "../src/AgroasysEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";


contract Handler is Test {
    AgroasysEscrow public escrow;
    MockUSDC public usdc;

    address public buyer;
    address public supplier;
    address public treasury;
    address public oracle;
    address public admin1;
    address public admin2;

    bytes32 constant ricardianHash = bytes32(bytes("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"));

    // variable to track in invariable tests
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public tradesCreated;
    uint256 public disputedRaised;

    constructor(AgroasysEscrow _escrow, MockUSDC _usdc, address _buyer, address _supplier, address _treasury, address _oracle, address _admin1, address _admin2){
        escrow = _escrow;
        usdc = _usdc;
        buyer = _buyer;
        supplier = _supplier;
        treasury = _treasury;
        oracle = _oracle;
        admin1 = _admin1;
        admin2 = _admin2;
    }

    function createTrade(uint96 logistics, uint96 fees, uint96 tranche1, uint96 tranche2) public {
        logistics = uint96(bound(logistics, 1000e6, 10_000e6));
        fees = uint96(bound(fees, 500e6, 5_000e6));
        tranche1 = uint96(bound(tranche1, 10_000e6, 100_000e6));
        tranche2 = uint96(bound(tranche2, 10_000e6, 100_000e6));
        
        uint256 total = logistics + fees + tranche1 + tranche2;

        if (10_000_000e6 < total) {
            return;
        }
        usdc.mint(buyer, total);

        vm.startPrank(buyer);
        usdc.approve(address(escrow), total);
        escrow.createTrade(supplier,treasury,total,logistics,fees,tranche1,tranche2,ricardianHash);
        vm.stopPrank();

        totalDeposited += total;
        tradesCreated++;
    }

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
    }

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

    uint256 initial_buyer_balance = 10_000_000e6;

    function setUp() public {
        buyer = makeAddr("buyer");
        supplier = makeAddr("supplier");
        treasury = makeAddr("treasury");
        oracle = makeAddr("oracle");
        admin1 = makeAddr("admin1");
        admin2 = makeAddr("admin2");
        admin3 = makeAddr("admin3");

        usdc = new MockUSDC();
        usdc.mint(buyer, initial_buyer_balance);

        address[] memory admins = new address[](3);
        admins[0] = admin1;
        admins[1] = admin2;
        admins[2] = admin3;

        escrow = new AgroasysEscrow(address(usdc), oracle, admins, 2);

        handler = new Handler(escrow,usdc,buyer,supplier,treasury,oracle,admin1,admin2);

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = Handler.createTrade.selector;
        selectors[1] = Handler.releaseFundsStage1.selector;
        selectors[2] = Handler.releaseFundsStage2.selector;
        
        targetSelector(FuzzSelector({
            addr: address(handler),
            selectors: selectors
        }));
    }



    function invariant_EscrowBalanceMatchesLockedFunds() public view{
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
    }


    function invariant_callSummary() public view {
        console2.log("Total trades:", uint256(handler.tradesCreated()));
        console2.log("Total deposited (USDC):", uint256(handler.totalDeposited() / 1e6));
        console2.log("Total withdrawn (USDC):", uint256(handler.totalWithdrawn() / 1e6));
    }
}
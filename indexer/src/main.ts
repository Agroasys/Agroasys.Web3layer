import { TypeormDatabase } from '@subsquid/typeorm-store'
import { processor, ESCROW_ADDRESS } from './processor'
import { Trade, TradeEvent, TradeStatus,DisputeProposal,DisputeEvent,DisputeStatus,OracleUpdateProposal,OracleEvent,AdminAddProposal,AdminEvent} from './model'
import { contractInterface } from './abi'

processor.run(new TypeormDatabase(), async (ctx) => {
    const trades: Map<string, Trade> = new Map();
    const tradeEvents: TradeEvent[] = [];
    const disputeProposals: Map<string, DisputeProposal> = new Map();
    const disputeEvents: DisputeEvent[] = [];
    const oracleUpdateProposals: Map<string, OracleUpdateProposal> = new Map();
    const oracleEvents: OracleEvent[] = [];
    const adminAddProposals: Map<string, AdminAddProposal> = new Map();
    const adminEvents: AdminEvent[] = [];

    for (let block of ctx.blocks) {
        for (let event of block.events) {
            // console.log(event);
            if (event.name !== 'Revive.ContractEmitted'){
                continue;
            } 
            try {
                const { contract, data, topics } = event.args;

                if (contract.toLowerCase() !== ESCROW_ADDRESS){
                    continue;
                } 

                const decoded = contractInterface.parseLog({ topics, data });

                if (!decoded) {
                    continue;
                }
                const eventId = event.id;
                const timestamp = new Date(block.header.timestamp || 0);
                const extrinsic = block.extrinsics.find(e=>e.index===event.extrinsicIndex);
                const txHash = extrinsic?.hash || 'unknown';
                const extrinsicIndex = event.extrinsicIndex || 0;

                // console.log(eventId);

                switch (decoded.name) {
                    case 'TradeLocked':
                        handleTradeLocked(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'FundsReleasedStage1':
                        handleFundsReleasedStage1(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'PlatformFeesPaidStage1':
                        handlePlatformFeesPaidStage1(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'ArrivalConfirmed':
                        handleArrivalConfirmed(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'FinalTrancheReleased':
                        handleFinalTrancheReleased(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'DisputeOpenedByBuyer':
                        handleDisputeOpenedByBuyer(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'DisputeSolutionProposed':
                        handleDisputeSolutionProposed(decoded, trades, disputeProposals, disputeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'DisputeApproved':
                        handleDisputeApproved(decoded, disputeProposals, disputeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'DisputeFinalized':
                        handleDisputeFinalized(decoded, disputeProposals, disputeEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'OracleUpdateProposed':
                        handleOracleUpdateProposed(decoded, oracleUpdateProposals, oracleEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'OracleUpdateApproved':
                        handleOracleUpdateApproved(decoded, oracleUpdateProposals, oracleEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'OracleUpdated':
                        handleOracleUpdated(decoded, oracleEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'AdminAddProposed':
                        handleAdminAddProposed(decoded, adminAddProposals, adminEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'AdminAddApproved':
                        handleAdminAddApproved(decoded, adminAddProposals, adminEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    case 'AdminAdded':
                        handleAdminAdded(decoded, adminEvents, eventId, block, timestamp, txHash, extrinsicIndex);
                        break;
                    default:
                        ctx.log.debug(`Unhandled event: ${decoded.name}`);
                }
            } catch (e) {
                ctx.log.error(`Error at block ${block.header.height}: ${e}`);
            }
        }
    }

    // save to db
    await ctx.store.upsert([...trades.values()]);
    await ctx.store.insert(tradeEvents);
    await ctx.store.upsert([...disputeProposals.values()]);
    await ctx.store.insert(disputeEvents);
    await ctx.store.upsert([...oracleUpdateProposals.values()]);
    await ctx.store.insert(oracleEvents);
    await ctx.store.upsert([...adminAddProposals.values()]);
    await ctx.store.insert(adminEvents);

    ctx.log.info(`Processed ${trades.size} trades, ${tradeEvents.length} trade events, ${disputeProposals.size} dispute proposals, ${disputeEvents.length} dispute events, ${oracleUpdateProposals.size} oracle proposals, ${oracleEvents.length} oracle events, ${adminAddProposals.size} admin proposals, ${adminEvents.length} admin events`);
});


// ######################### trade event handlers #########################
function handleTradeLocked(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number
) {
    const [
        tradeId,
        buyer,
        supplier,
        totalAmount,
        logisticsAmount,
        platformFeesAmount,
        supplierFirstTranche,
        supplierSecondTranche,
        ricardianHash
    ] = log.args;

    const trade = new Trade({
        id: tradeId.toString(),
        tradeId: tradeId.toString(),
        buyer: buyer.toLowerCase(),
        supplier: supplier.toLowerCase(),
        status: TradeStatus.LOCKED,
        totalAmountLocked: totalAmount,
        logisticsAmount: logisticsAmount,
        platformFeesAmount: platformFeesAmount,
        supplierFirstTranche: supplierFirstTranche,
        supplierSecondTranche: supplierSecondTranche,
        ricardianHash: ricardianHash,
        createdAt: timestamp
    });

    trades.set(tradeId.toString(), trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'TradeLocked',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        totalAmount: totalAmount,
        logisticsAmount: logisticsAmount,
        platformFeesAmount: platformFeesAmount,
        supplierFirstTranche: supplierFirstTranche,
        supplierSecondTranche: supplierSecondTranche
    }));

    console.log(`Trade ${tradeId} locked by ${buyer}`);
}

import { TypeormDatabase } from '@subsquid/typeorm-store'
import { processor, ESCROW_ADDRESS } from './processor'
import { Trade, TradeEvent, TradeStatus } from './model'
import { contractInterface } from './abi'

processor.run(new TypeormDatabase(), async (ctx) => {
    const trades: Map<string, Trade> = new Map();
    const events: TradeEvent[] = [];

    for (let block of ctx.blocks) {
        for (let event of block.events) {
            if (event.name !== 'Revive.ContractEmitted') continue;

            try {
                const { contract, data, topics } = event.args;

                if (contract.toLowerCase() !== ESCROW_ADDRESS) continue;

                const decoded = contractInterface.parseLog({ topics, data });
                if (!decoded) continue;

                const eventId = `${block.header.height}-${event.index}`;
                const timestamp = new Date(block.header.timestamp || 0);
                const txHash = event.extrinsic?.hash || 'unknown';

                switch (decoded.name) {
                    case 'TradeLocked':
                        handleTradeLocked(decoded, trades, events, eventId, block, timestamp, txHash);
                        break;
                    case 'FundsReleasedStage1':
                        handleFundsReleasedStage1(decoded, trades, events, eventId, block, timestamp, txHash);
                        break;
                    default:
                        ctx.log.debug(`Unhandled event: ${decoded.name}`);
                }
            } catch (e) {
                ctx.log.error(`Error at block ${block.header.height}: ${e}`);
            }
        }
    }

    await ctx.store.upsert([...trades.values()]);
    await ctx.store.insert(events);

    ctx.log.info(`Processed ${trades.size} trades, ${events.length} events`);
});

function handleTradeLocked(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string
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
        txHash
    }));

    console.log(`Trade ${tradeId} locked by ${buyer}`);
}

function handleFundsReleasedStage1(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string
) {
    const [tradeId, supplier, supplierFirstTranche, treasury, logisticsAmount] = log.args;

    let trade = trades.get(tradeId.toString());
    if (!trade) {
        trade = new Trade({
            id: tradeId.toString(),
            tradeId: tradeId.toString(),
            buyer: 'unknown',
            supplier: supplier.toLowerCase(),
            status: TradeStatus.IN_TRANSIT,
            totalAmountLocked: 0n,
            ricardianHash: '',
            createdAt: timestamp
        });
    } else {
        trade.status = TradeStatus.IN_TRANSIT;
    }

    trades.set(tradeId.toString(), trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'FundsReleasedStage1',
        blockNumber: block.header.height,
        timestamp,
        txHash
    }));

    console.log(`Trade ${tradeId} -> IN_TRANSIT`);
}
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
                const { contract, data } = extractContractEvent(event);

                if (contract.toLowerCase() !== ESCROW_ADDRESS) continue;

                const decoded = decodeEvent(data, event);
                if (!decoded) continue;

                const eventId = `${block.header.height}-${event.index}`;
                const timestamp = new Date(block.header.timestamp || 0);
                const txHash = event.extrinsic?.id || 'unknown';

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

function extractContractEvent(event: any): { contract: string; data: string } {
    const args = event.args;
    return {
        contract: args.contract || args[0] || '',
        data: args.data || args[1] || ''
    };
}

function decodeEvent(data: string, event: any): any {
    try {
        const topics = event.topics || [];
        return contractInterface.parseLog({ topics, data });
    } catch {
        return null;
    }
}

function handleTradeLocked(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string
) {
    const args = log.args;
    const tradeId = args.tradeId.toString();

    const trade = new Trade({
        id: tradeId,
        tradeId,
        buyer: args.buyer.toLowerCase(),
        supplier: args.supplier.toLowerCase(),
        status: TradeStatus.LOCKED,
        totalAmountLocked: args.totalAmount.toBigInt(),
        ricardianHash: args.ricardianHash,
        createdAt: timestamp
    });

    trades.set(tradeId, trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'TradeLocked',
        blockNumber: block.header.height,
        timestamp,
        txHash
    }));

    console.log(`Trade ${tradeId} locked by ${trade.buyer}`);
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
    const args = log.args;
    const tradeId = args.tradeId.toString();

    let trade = trades.get(tradeId);
    if (!trade) {
        trade = new Trade({
            id: tradeId,
            tradeId,
            buyer: 'unknown',
            supplier: args.supplier.toLowerCase(),
            status: TradeStatus.IN_TRANSIT,
            totalAmountLocked: 0n,
            ricardianHash: '',
            createdAt: timestamp
        });
    } else {
        trade.status = TradeStatus.IN_TRANSIT;
    }

    trades.set(tradeId, trade);

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
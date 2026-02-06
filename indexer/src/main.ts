import { TypeormDatabase } from '@subsquid/typeorm-store'
import { processor, ESCROW_ADDRESS } from './processor'
import { Trade, TradeEvent, TradeStatus, DisputeProposal, DisputeEvent, DisputeStatus, OracleUpdateProposal, OracleEvent, AdminAddProposal, AdminEvent } from './model'
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
            if (event.name !== 'Revive.ContractEmitted') {
                continue;
            }
            try {
                const { contract, data, topics } = event.args;

                if (contract.toLowerCase() !== ESCROW_ADDRESS) {
                    continue;
                }

                const decoded = contractInterface.parseLog({ topics, data });

                if (!decoded) {
                    ctx.log.warn(`Failed to decode event at block ${block.header.height}`);
                    continue;
                }
                const eventId = event.id;
                const timestamp = new Date(block.header.timestamp || 0);
                const extrinsic = block.extrinsics.find(e => e.index === event.extrinsicIndex);
                const txHash = extrinsic?.hash || 'unknown';
                const extrinsicIndex = event.extrinsicIndex || 0;

                switch (decoded.name) {
                    case 'TradeLocked':
                        await handleTradeLocked(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'FundsReleasedStage1':
                        await handleFundsReleasedStage1(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'PlatformFeesPaidStage1':
                        await handlePlatformFeesPaidStage1(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'ArrivalConfirmed':
                        await handleArrivalConfirmed(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'FinalTrancheReleased':
                        await handleFinalTrancheReleased(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'DisputeOpenedByBuyer':
                        await handleDisputeOpenedByBuyer(decoded, trades, tradeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'DisputeSolutionProposed':
                        await handleDisputeSolutionProposed(decoded, trades, disputeProposals, disputeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'DisputeApproved':
                        await handleDisputeApproved(decoded, disputeProposals, disputeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'DisputeFinalized':
                        await handleDisputeFinalized(decoded, disputeProposals, disputeEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'OracleUpdateProposed':
                        await handleOracleUpdateProposed(decoded, oracleUpdateProposals, oracleEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'OracleUpdateApproved':
                        await handleOracleUpdateApproved(decoded, oracleUpdateProposals, oracleEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'OracleUpdated':
                        await handleOracleUpdated(decoded, oracleEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'AdminAddProposed':
                        await handleAdminAddProposed(decoded, adminAddProposals, adminEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'AdminAddApproved':
                        await handleAdminAddApproved(decoded, adminAddProposals, adminEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
                        break;
                    case 'AdminAdded':
                        await handleAdminAdded(decoded, adminEvents, eventId, block, timestamp, txHash, extrinsicIndex, ctx);
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

// helper
async function getOrLoadTrade(tradeId: string,trades: Map<string, Trade>,ctx: any): Promise<Trade | null> {
    let trade = trades.get(tradeId);
    if (trade) {
        return trade;
    }

    trade = await ctx.store.get(Trade, tradeId);
    if (trade) {
        trades.set(tradeId, trade);
        return trade;
    }

    return null;
}

// ########################### trade events ##########################

async function handleTradeLocked(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
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

    ctx.log.info(`Trade ${tradeId} locked by ${buyer}`);
}

async function handleFundsReleasedStage1(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [tradeId, supplier, supplierFirstTranche, treasury, logisticsAmount] = log.args;

    const trade = await getOrLoadTrade(tradeId.toString(), trades, ctx);
    
    if (!trade) {
        ctx.log.error(`Trade ${tradeId} not found for FundsReleasedStage1 event`);
        return;
    }

    trade.status = TradeStatus.IN_TRANSIT;
    trades.set(tradeId.toString(), trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'FundsReleasedStage1',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        releasedFirstTranche: supplierFirstTranche,
        releasedLogisticsAmount: logisticsAmount,
        treasuryAddress: treasury.toLowerCase()
    }));

    ctx.log.info(`Trade ${tradeId} -> IN_TRANSIT`);
}

async function handlePlatformFeesPaidStage1(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [tradeId, treasury, platformFeesAmount] = log.args;

    const trade = await getOrLoadTrade(tradeId.toString(), trades, ctx);
    
    if (!trade) {
        ctx.log.error(`Trade ${tradeId} not found for PlatformFeesPaidStage1 event`);
        return;
    }

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'PlatformFeesPaidStage1',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        paidPlatformFees: platformFeesAmount,
        treasuryAddress: treasury.toLowerCase()
    }));

    ctx.log.info(`Trade ${tradeId} platform fees paid: ${platformFeesAmount}`);
}

async function handleArrivalConfirmed(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [tradeId, arrivalTimestamp] = log.args;

    const trade = await getOrLoadTrade(tradeId.toString(), trades, ctx);
    
    if (!trade) {
        ctx.log.error(`Trade ${tradeId} not found for ArrivalConfirmed event`);
        return;
    }

    trade.status = TradeStatus.ARRIVAL_CONFIRMED;
    trade.arrivalTimestamp = new Date(Number(arrivalTimestamp) * 1000);
    trades.set(tradeId.toString(), trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'ArrivalConfirmed',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        arrivalTimestamp: arrivalTimestamp
    }));

    ctx.log.info(`Trade ${tradeId} arrival confirmed at ${arrivalTimestamp}`);
}

async function handleFinalTrancheReleased(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [tradeId, supplier, supplierSecondTranche] = log.args;

    const trade = await getOrLoadTrade(tradeId.toString(), trades, ctx);
    
    if (!trade) {
        ctx.log.error(`Trade ${tradeId} not found for FinalTrancheReleased event`);
        return;
    }

    trade.status = TradeStatus.CLOSED;
    trades.set(tradeId.toString(), trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'FinalTrancheReleased',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        finalTranche: supplierSecondTranche,
        finalRecipient: supplier.toLowerCase()
    }));

    ctx.log.info(`Trade ${tradeId} finalized - final tranche released to ${supplier}`);
}

async function handleDisputeOpenedByBuyer(
    log: any,
    trades: Map<string, Trade>,
    events: TradeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [tradeId] = log.args;

    const trade = await getOrLoadTrade(tradeId.toString(), trades, ctx);
    
    if (!trade) {
        ctx.log.error(`Trade ${tradeId} not found for DisputeOpenedByBuyer event`);
        return;
    }

    trade.status = TradeStatus.FROZEN;
    trades.set(tradeId.toString(), trade);

    events.push(new TradeEvent({
        id: eventId,
        trade,
        eventName: 'DisputeOpenedByBuyer',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex
    }));

    ctx.log.info(`Trade ${tradeId} frozen - dispute opened by buyer`);
}

// ########################### dispute events ##########################

async function handleDisputeSolutionProposed(
    log: any,
    trades: Map<string, Trade>,
    disputeProposals: Map<string, DisputeProposal>,
    events: DisputeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, tradeId, disputeStatus, proposer] = log.args;

    const trade = await getOrLoadTrade(tradeId.toString(), trades, ctx);
    
    if (!trade) {
        ctx.log.error(`Trade ${tradeId} not found for DisputeSolutionProposed event`);
        return;
    }

    const disputeStatusEnum = disputeStatus === 0 ? DisputeStatus.REFUND : DisputeStatus.RESOLVE;

    const proposal = new DisputeProposal({
        id: proposalId.toString(),
        proposalId: proposalId.toString(),
        trade,
        disputeStatus: disputeStatusEnum,
        approvalCount: 1,
        executed: false,
        createdAt: timestamp,
        proposer: proposer.toLowerCase()
    });

    disputeProposals.set(proposalId.toString(), proposal);

    events.push(new DisputeEvent({
        id: eventId,
        dispute: proposal,
        eventName: 'DisputeSolutionProposed',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        proposedDisputeStatus: disputeStatusEnum,
        proposer: proposer.toLowerCase()
    }));

    ctx.log.info(`Dispute solution proposed: proposal ${proposalId} for trade ${tradeId} with status ${disputeStatusEnum}`);
}

async function handleDisputeApproved(
    log: any,
    disputeProposals: Map<string, DisputeProposal>,
    events: DisputeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, approver, approvalCount, requiredApprovals] = log.args;

    let proposal = disputeProposals.get(proposalId.toString());
    if (!proposal) {
        proposal = await ctx.store.get(DisputeProposal, proposalId.toString());
        if (!proposal) {
            ctx.log.error(`Dispute proposal ${proposalId} not found for DisputeApproved event`);
            return;
        }
        disputeProposals.set(proposalId.toString(), proposal);
    }

    proposal.approvalCount = Number(approvalCount);
    disputeProposals.set(proposalId.toString(), proposal);

    events.push(new DisputeEvent({
        id: eventId,
        dispute: proposal,
        eventName: 'DisputeApproved',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        approver: approver.toLowerCase(),
        approvalCount: Number(approvalCount),
        requiredApprovals: Number(requiredApprovals)
    }));

    ctx.log.info(`Dispute proposal ${proposalId} approved by ${approver} - ${approvalCount}/${requiredApprovals}`);
}

async function handleDisputeFinalized(
    log: any,
    disputeProposals: Map<string, DisputeProposal>,
    events: DisputeEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, tradeId, disputeStatus] = log.args;

    let proposal = disputeProposals.get(proposalId.toString());
    if (!proposal) {
        proposal = await ctx.store.get(DisputeProposal, proposalId.toString());
        if (!proposal) {
            ctx.log.error(`Dispute proposal ${proposalId} not found for DisputeFinalized event`);
            return;
        }
        disputeProposals.set(proposalId.toString(), proposal);
    }

    proposal.executed = true;
    disputeProposals.set(proposalId.toString(), proposal);

    const disputeStatusEnum = disputeStatus === 0 ? DisputeStatus.REFUND : DisputeStatus.RESOLVE;

    events.push(new DisputeEvent({
        id: eventId,
        dispute: proposal,
        eventName: 'DisputeFinalized',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        finalDisputeStatus: disputeStatusEnum
    }));

    ctx.log.info(`Dispute ${proposalId} finalized for trade ${tradeId} with status ${disputeStatusEnum}`);
}

// ########################### update oracle events ##########################

async function handleOracleUpdateProposed(
    log: any,
    proposals: Map<string, OracleUpdateProposal>,
    events: OracleEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, proposer, newOracle, eta] = log.args;

    const proposal = new OracleUpdateProposal({
        id: proposalId.toString(),
        proposalId: proposalId.toString(),
        newOracle: newOracle.toLowerCase(),
        approvalCount: 1,
        executed: false,
        createdAt: timestamp,
        eta: eta,
        proposer: proposer.toLowerCase()
    });

    proposals.set(proposalId.toString(), proposal);

    events.push(new OracleEvent({
        id: eventId,
        oracleUpdate: proposal,
        eventName: 'OracleUpdateProposed',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        proposedOracle: newOracle.toLowerCase(),
        eta: eta,
        proposer: proposer.toLowerCase()
    }));

    ctx.log.info(`Oracle update proposed: ${proposalId} to ${newOracle} by ${proposer}`);
}

async function handleOracleUpdateApproved(
    log: any,
    proposals: Map<string, OracleUpdateProposal>,
    events: OracleEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, approver, approvalCount, requiredApprovals] = log.args;

    let proposal = proposals.get(proposalId.toString());
    if (!proposal) {
        proposal = await ctx.store.get(OracleUpdateProposal, proposalId.toString());
        if (!proposal) {
            ctx.log.error(`Oracle update proposal ${proposalId} not found`);
            return;
        }
        proposals.set(proposalId.toString(), proposal);
    }

    proposal.approvalCount = Number(approvalCount);
    proposals.set(proposalId.toString(), proposal);

    events.push(new OracleEvent({
        id: eventId,
        oracleUpdate: proposal,
        eventName: 'OracleUpdateApproved',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        approver: approver.toLowerCase(),
        approvalCount: Number(approvalCount),
        requiredApprovals: Number(requiredApprovals)
    }));

    ctx.log.info(`Oracle update ${proposalId} approved by ${approver}`);
}

async function handleOracleUpdated(
    log: any,
    events: OracleEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [oldOracle, newOracle] = log.args;

    events.push(new OracleEvent({
        id: eventId,
        oracleUpdate: null as any,
        eventName: 'OracleUpdated',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        oldOracle: oldOracle.toLowerCase(),
        newOracle: newOracle.toLowerCase()
    }));

    ctx.log.info(`Oracle updated from ${oldOracle} to ${newOracle}`);
}

// ########################### admin updates events ##########################

async function handleAdminAddProposed(
    log: any,
    proposals: Map<string, AdminAddProposal>,
    events: AdminEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, proposer, newAdmin, eta] = log.args;

    const proposal = new AdminAddProposal({
        id: proposalId.toString(),
        proposalId: proposalId.toString(),
        newAdmin: newAdmin.toLowerCase(),
        approvalCount: 1,
        executed: false,
        createdAt: timestamp,
        eta: eta,
        proposer: proposer.toLowerCase()
    });

    proposals.set(proposalId.toString(), proposal);

    events.push(new AdminEvent({
        id: eventId,
        adminAddProposal: proposal,
        eventName: 'AdminAddProposed',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        proposedAdmin: newAdmin.toLowerCase(),
        eta: eta,
        proposer: proposer.toLowerCase()
    }));

    ctx.log.info(`Admin add proposed: ${proposalId} to add ${newAdmin}`);
}

async function handleAdminAddApproved(
    log: any,
    proposals: Map<string, AdminAddProposal>,
    events: AdminEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [proposalId, approver, approvalCount, requiredApprovals] = log.args;

    let proposal = proposals.get(proposalId.toString());
    if (!proposal) {
        proposal = await ctx.store.get(AdminAddProposal, proposalId.toString());
        if (!proposal) {
            ctx.log.error(`Admin add proposal ${proposalId} not found`);
            return;
        }
        proposals.set(proposalId.toString(), proposal);
    }

    proposal.approvalCount = Number(approvalCount);
    proposals.set(proposalId.toString(), proposal);

    events.push(new AdminEvent({
        id: eventId,
        adminAddProposal: proposal,
        eventName: 'AdminAddApproved',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        approver: approver.toLowerCase(),
        approvalCount: Number(approvalCount),
        requiredApprovals: Number(requiredApprovals)
    }));

    ctx.log.info(`Admin add ${proposalId} approved by ${approver}`);
}

async function handleAdminAdded(
    log: any,
    events: AdminEvent[],
    eventId: string,
    block: any,
    timestamp: Date,
    txHash: string,
    extrinsicIndex: number,
    ctx: any
) {
    const [newAdmin] = log.args;

    events.push(new AdminEvent({
        id: eventId,
        adminAddProposal: null as any,
        eventName: 'AdminAdded',
        blockNumber: block.header.height,
        timestamp,
        txHash,
        extrinsicIndex,
        addedAdmin: newAdmin.toLowerCase()
    }));

    ctx.log.info(`Admin added: ${newAdmin}`);
}
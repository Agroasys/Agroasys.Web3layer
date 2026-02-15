import { SubstrateBatchProcessor, SubstrateBatchProcessorFields} from "@subsquid/substrate-processor"
import {loadConfig} from "./config"

const config = loadConfig();

export const ESCROW_ADDRESS = config.contractAddress;

export const processor = new SubstrateBatchProcessor()
    .setGateway(config.gatewayUrl)
    .setRpcEndpoint({
        url: config.rpcEndpoint,
        rateLimit: config.rateLimit
    })
    .setBlockRange({ 
        from: config.startBlock
    })
    .addEvent({
        name: ['Revive.ContractEmitted'],
        extrinsic: true,
        call: true
    })
    .setFields({
        event: {
            args: true
        },
        block: {
            timestamp: true
        },
        extrinsic: {
            hash: true
        }
    });

type Fields = SubstrateBatchProcessorFields<typeof processor>
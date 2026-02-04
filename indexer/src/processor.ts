import { SubstrateBatchProcessor, SubstrateBatchProcessorFields} from "@subsquid/substrate-processor"
import { TypeormDatabase } from "@subsquid/typeorm-store"


export const ESCROW_ADDRESS = "0x53A51E24503f48aeEA0dBc3808E28faf5E4861E9".toLowerCase();

export const processor = new SubstrateBatchProcessor()
    .setGateway("https://v2.archive.subsquid.io/network/asset-hub-paseo")
    .setRpcEndpoint({
        url: "https://sys.ibp.network/asset-hub-paseo",
        rateLimit: 10
    })
    .setBlockRange({ 
        from: 4872426
    })
    .addEvent({
        name: ['Revive.ContractEmitted'],
        extrinsic: true
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
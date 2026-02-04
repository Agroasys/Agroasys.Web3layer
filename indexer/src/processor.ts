import { SubstrateBatchProcessor, SubstrateBatchProcessorFields} from "@subsquid/substrate-processor"


export const ESCROW_ADDRESS = "0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a".toLowerCase();

export const processor = new SubstrateBatchProcessor()
    .setGateway("https://v2.archive.subsquid.io/network/asset-hub-paseo")
    .setRpcEndpoint({
        url: "https://sys.ibp.network/asset-hub-paseo",
        rateLimit: 10
    })
    .setBlockRange({ 
        from: 4955340
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
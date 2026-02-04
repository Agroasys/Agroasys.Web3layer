import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, IntColumn as IntColumn_, DateTimeColumn as DateTimeColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Trade} from "./trade.model"

@Entity_()
export class TradeEvent {
    constructor(props?: Partial<TradeEvent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Trade, {nullable: true})
    trade!: Trade

    @Index_()
    @StringColumn_({nullable: false})
    eventName!: string

    @Index_()
    @IntColumn_({nullable: false})
    blockNumber!: number

    @Index_()
    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @Index_()
    @StringColumn_({nullable: false})
    txHash!: string

    @IntColumn_({nullable: false})
    extrinsicIndex!: number

    @BigIntColumn_({nullable: true})
    totalAmount!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    logisticsAmount!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    platformFeesAmount!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    supplierFirstTranche!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    supplierSecondTranche!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    releasedFirstTranche!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    releasedLogisticsAmount!: bigint | undefined | null

    @StringColumn_({nullable: true})
    treasuryAddress!: string | undefined | null

    @BigIntColumn_({nullable: true})
    paidPlatformFees!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    arrivalTimestamp!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    finalTranche!: bigint | undefined | null

    @StringColumn_({nullable: true})
    finalRecipient!: string | undefined | null
}

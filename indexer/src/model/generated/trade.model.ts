import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {TradeStatus} from "./_tradeStatus"
import {TradeEvent} from "./tradeEvent.model"

@Entity_()
export class Trade {
    constructor(props?: Partial<Trade>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    tradeId!: string

    @Index_()
    @StringColumn_({nullable: false})
    buyer!: string

    @Index_()
    @StringColumn_({nullable: false})
    supplier!: string

    @Column_("varchar", {length: 17, nullable: false})
    status!: TradeStatus

    @BigIntColumn_({nullable: false})
    totalAmountLocked!: bigint

    @StringColumn_({nullable: false})
    ricardianHash!: string

    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @OneToMany_(() => TradeEvent, e => e.trade)
    events!: TradeEvent[]
}

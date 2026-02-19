import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, IntColumn as IntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"
import {DisputeProposal} from "./disputeProposal.model"
import {DisputeStatus} from "./_disputeStatus"

@Entity_()
export class DisputeEvent {
    constructor(props?: Partial<DisputeEvent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => DisputeProposal, {nullable: true})
    dispute!: DisputeProposal

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
    @StringColumn_({nullable: true})
    txHash!: string | undefined | null

    @Index_()
    @StringColumn_({nullable: true})
    extrinsicHash!: string | undefined | null

    @IntColumn_({nullable: false})
    extrinsicIndex!: number

    @Column_("varchar", {length: 7, nullable: true})
    proposedDisputeStatus!: DisputeStatus | undefined | null

    @StringColumn_({nullable: true})
    proposer!: string | undefined | null

    @StringColumn_({nullable: true})
    approver!: string | undefined | null

    @IntColumn_({nullable: true})
    approvalCount!: number | undefined | null

    @IntColumn_({nullable: true})
    requiredApprovals!: number | undefined | null

    @Column_("varchar", {length: 7, nullable: true})
    finalDisputeStatus!: DisputeStatus | undefined | null

    @StringColumn_({nullable: true})
    cancelledBy!: string | undefined | null
}

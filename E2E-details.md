# E2E Tests:

- buyer address: 0xc7fFC27f58117f13BEE926dF9821C7da5826ce23
- supplier: 0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c
- treasury address: 0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D
- oracle address: 0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D
- admin1 address: 0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D
- admin2 address: 0x229C75F0cD13D6ab7621403Bd951a9e43ba53b1e
- admin3 address: 0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c


## Trade 1: user-flow without dispute (24h)

### 1 Trade creation (from buyer sdk)
- Trade created:
  - supplier: 0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c
  - totalAmount: 10_000
  - logisticsAmount: 1_000
  - platformFeesAmount: 500
  - supplierFirstTranche: 4_000
  - supplierSecondTranche: 4_500


- tx hash: 0x320eed34edbcb4ef13164828ff3a2e77aba3d24f79563d79b7ff6487029164cc
- block number: 5323117
- trade id: 0

event emitted: TradeLocked


### 2 Release Funds Stage1 (from oracle module via api request)


tx hash: 0xa076f864e89b8613ba507c5fa6a49f3c1265f4cf6b4bbed286a87963b76dddd7
block number: 5323488
trade id: 0

event emitted: FundsReleasedStage1, PlatformFeesPaidStage1



## Trade 2: user-flow with dispute -> resolve resolution (no delay)



## Trade 3: user-flow with dispute -> refund resolution (no delay)



## Trade 4: cancel after timeout (7 days)



## Trade 5: refund in transit after timeout (14 days)



## add admin/change oracle (24h)



## pause/disableOracle/unpause (no delay)



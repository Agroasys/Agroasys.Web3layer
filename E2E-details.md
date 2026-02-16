# E2E Tests:


## Contract infos

- escrow address: 0x8425B6C434469801B04544B8c9cbBAaeEE931fF9
- usdc address: 0xEea5766E43D0c7032463134Afc121e63C9f9C260
- indexer start block: 5361048


## Trade infos

- buyer address: 0xc7fFC27f58117f13BEE926dF9821C7da5826ce23
- supplier: 0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c
- treasury address: 0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D
- admin1 address: 0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D
- admin2 address: 0x229C75F0cD13D6ab7621403Bd951a9e43ba53b1e
- admin3 address: 0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c


## Trade 1: user-flow without dispute (24h)

### 1 Trade creation (from buyer sdk)
- Trade created:
  - totalAmount: 10_000
  - logisticsAmount: 1_000
  - platformFeesAmount: 500
  - supplierFirstTranche: 4_000
  - supplierSecondTranche: 4_500


- tx hash: 0x4481481c521db0663b8304cef41109f6b918224b2c0e6c4735995e97f4a6a00c
- block number: 5361420
- trade id: 0

event emitted: TradeLocked


### 2 Release Funds Stage1 (from oracle module via api request)


- tx hash: 0x7135b55d4a39863b39ec33174fe94791dd3f628a04961341f89db902f9fa8c91
- block number: 5361597
- trade id: 0

- event emitted: FundsReleasedStage1, PlatformFeesPaidStage1


### 3 Confirm arrival (from oracle module via api request)


- tx hash: 0x5d9316650641e80cec381e97a9c55d6b54006f75e8c48ee8f8669f2d5b206fdb
- block number: 5361650
- trade id: 0

- event emitted: ArrivalConfirmed


### 4 Finalize trade (from oracle module via api request)


- tx hash: 
- block number: 
- trade id: 0

- event emitted: 


## Trade 2: user-flow with dispute -> resolve resolution (no delay)

### 1 Trade creation (from buyer sdk)
- Trade created:
  - totalAmount: 10_000
  - logisticsAmount: 1_000
  - platformFeesAmount: 500
  - supplierFirstTranche: 4_000
  - supplierSecondTranche: 4_500


- tx hash: 0x9b5f4c4bafe05e155b0ccf0afb5fccf9cbf6ce026127a036cea245a0e563c826
- block number: 5361927
- trade id: 1

event emitted: TradeLocked


### 2 Release Funds Stage1 (from oracle module via api request)


- tx hash: 0x1b831a9e027400dc48e633a105c582054a5fdb057406e42d943b2ff6fcc60997
- block number: 5361971
- trade id: 1

- event emitted: FundsReleasedStage1, PlatformFeesPaidStage1


### 3 Confirm arrival (from oracle module via api request)


- tx hash: 0x47a20b8b5a495c02f8f9d9f3d8440e82e620e5f7c15abbabe346c21b6d6d431b
- block number: 5362125
- trade id: 1

- event emitted: ArrivalConfirmed


### 4 Open dispute (from buyer sdk)


- tx hash: 0xa63d2ec7178276487b3572c7ea5611df2b17580494c9009e8ae4ff1fe3c0cf64
- block number: 5362199
- trade id: 1

- event emitted: DisputeOpenedByBuyer

### 4 Propose solution (from admin sdk)


- tx hash: 
- block number: 
- trade id: 1

- event emitted: 


### 4 Approve/execute dispute (from admin sdk)


- tx hash: 
- block number: 
- trade id: 1

- event emitted: 

## Trade 3: user-flow with dispute -> refund resolution (no delay)

### 1 Trade creation (from buyer sdk)
- Trade created:
  - totalAmount: 10_000
  - logisticsAmount: 1_000
  - platformFeesAmount: 500
  - supplierFirstTranche: 4_000
  - supplierSecondTranche: 4_500


- tx hash: 
- block number: 
- trade id: 1

event emitted: TradeLocked


### 2 Release Funds Stage1 (from oracle module via api request)


- tx hash: 
- block number: 
- trade id: 1

- event emitted: FundsReleasedStage1, PlatformFeesPaidStage1


### 3 Confirm arrival (from oracle module via api request)


- tx hash: 
- block number: 
- trade id: 1

- event emitted: ArrivalConfirmed


### 4 Open dispute (from buyer sdk)


- tx hash: 
- block number: 
- trade id: 0

- event emitted: 

### 4 Propose solution (from admin sdk)


- tx hash: 
- block number: 
- trade id: 0

- event emitted: 


### 4 Approve/execute dispute (from admin sdk)


- tx hash: 
- block number: 
- trade id: 0

- event emitted: 


## Trade 4: cancel after timeout (7 days)



## Trade 5: refund in transit after timeout (14 days)



## add admin/change oracle (24h)



## pause/disableOracle/unpause (no delay)



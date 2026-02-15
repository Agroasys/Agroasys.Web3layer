import { BuyerSDK } from '../src/modules/buyerSDK';
import {
  TEST_CONFIG,
  assertRequiredEnv,
  getBuyerSigner,
  hasRequiredEnv,
} from './setup';

const describeIntegration = hasRequiredEnv ? describe : describe.skip;

const UNIT_CONFIG = {
  rpc: "http://127.0.0.1:8545",
  chainId: 31337,
  escrowAddress: "0x1000000000000000000000000000000000000001",
  usdcAddress: "0x2000000000000000000000000000000000000002",
};

const RECEIPT = {
  hash: `0x${'2'.repeat(64)}`,
  blockNumber: 456,
};

type MockContractWithSigner = {
  openDispute: jest.Mock;
  cancelLockedTradeAfterTimeout: jest.Mock;
  refundInTransitAfterTimeout: jest.Mock;
};

function makeBuyerSigner(address = '0x2222222222222222222222222222222222222222'): any {
  return {
    getAddress: jest.fn().mockResolvedValue(address),
  };
}

function makeSdkUnit() {
  const sdk = new BuyerSDK(UNIT_CONFIG);

  const contractWithSigner: MockContractWithSigner = {
    openDispute: jest.fn(),
    cancelLockedTradeAfterTimeout: jest.fn(),
    refundInTransitAfterTimeout: jest.fn(),
  };

  const connect = jest.fn().mockReturnValue(contractWithSigner);
  (sdk as any).contract = { connect };

  return { sdk, contractWithSigner, connect };
}

function mockSuccessCall(mock: jest.Mock) {
  const tx = {
    wait: jest.fn().mockResolvedValue(RECEIPT),
  };
  mock.mockResolvedValue(tx);
  return tx;
}

describe('BuyerSDK unit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('openDispute should call contract and return tx result', async () => {
    const { sdk, contractWithSigner, connect } = makeSdkUnit();
    const signer = makeBuyerSigner();
    const tx = mockSuccessCall(contractWithSigner.openDispute);

    const result = await sdk.openDispute(10n, signer);

    expect(connect).toHaveBeenCalledWith(signer);
    expect(contractWithSigner.openDispute).toHaveBeenCalledWith(10n);
    expect(tx.wait).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ txHash: RECEIPT.hash, blockNumber: RECEIPT.blockNumber });
  });

  test('cancelLockedTradeAfterTimeout should call contract and return tx result', async () => {
    const { sdk, contractWithSigner } = makeSdkUnit();
    const signer = makeBuyerSigner();
    const tx = mockSuccessCall(contractWithSigner.cancelLockedTradeAfterTimeout);

    const result = await sdk.cancelLockedTradeAfterTimeout(11n, signer);

    expect(contractWithSigner.cancelLockedTradeAfterTimeout).toHaveBeenCalledWith(11n);
    expect(tx.wait).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ txHash: RECEIPT.hash, blockNumber: RECEIPT.blockNumber });
  });

  test('refundInTransitAfterTimeout should call contract and return tx result', async () => {
    const { sdk, contractWithSigner } = makeSdkUnit();
    const signer = makeBuyerSigner();
    const tx = mockSuccessCall(contractWithSigner.refundInTransitAfterTimeout);

    const result = await sdk.refundInTransitAfterTimeout(12n, signer);

    expect(contractWithSigner.refundInTransitAfterTimeout).toHaveBeenCalledWith(12n);
    expect(tx.wait).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ txHash: RECEIPT.hash, blockNumber: RECEIPT.blockNumber });
  });
});

describeIntegration('BuyerSDK integration smoke', () => {
  let buyerSDK: BuyerSDK;
  let buyerSigner: any;

  beforeAll(() => {
    assertRequiredEnv();
    buyerSDK = new BuyerSDK(TEST_CONFIG);
    buyerSigner = getBuyerSigner();
  });

  test('should get buyer nonce', async () => {
    const buyerAddress = await buyerSigner.getAddress();
    const nonce = await buyerSDK.getBuyerNonce(buyerAddress);

    expect(typeof nonce).toBe('bigint');
    expect(nonce).toBeGreaterThanOrEqual(0n);
  });

  test('should check USDC balance and allowance', async () => {
    const buyerAddress = await buyerSigner.getAddress();

    const balance = await buyerSDK.getUSDCBalance(buyerAddress);
    const allowance = await buyerSDK.getUSDCAllowance(buyerAddress);

    expect(typeof balance).toBe('bigint');
    expect(typeof allowance).toBe('bigint');
  });
});

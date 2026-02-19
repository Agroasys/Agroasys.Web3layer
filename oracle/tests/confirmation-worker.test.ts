import { ConfirmationWorker } from '../src/worker/confirmation-worker';
import { TriggerStatus, TriggerType } from '../src/types/trigger';

const mockGetTriggersByStatus = jest.fn();
const mockUpdateTrigger = jest.fn();
const TRADE_STATUS_LOCKED = 0;
const TRADE_STATUS_IN_TRANSIT = 1;

jest.mock('../src/database/queries', () => ({
  getTriggersByStatus: (...args: unknown[]) => mockGetTriggersByStatus(...args),
  updateTrigger: (...args: unknown[]) => mockUpdateTrigger(...args),
}));

type TriggerLike = {
  idempotency_key: string;
  action_key: string;
  request_id: string;
  tx_hash: string;
  trade_id: string;
  trigger_type: TriggerType;
  submitted_at: Date;
};

function makeTrigger(overrides: Partial<TriggerLike> = {}): TriggerLike {
  return {
    idempotency_key: 'idem-1234567890abcdef1234567890abcdef',
    action_key: 'RELEASE_STAGE_1:1',
    request_id: 'req-1',
    tx_hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    trade_id: '1',
    trigger_type: TriggerType.RELEASE_STAGE_1,
    submitted_at: new Date(Date.now() - 25 * 60 * 1000),
    ...overrides,
  };
}

describe('ConfirmationWorker on-chain fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks trigger confirmed when indexer is unavailable but chain state has advanced', async () => {
    const indexerClient = {
      findConfirmationEvent: jest.fn().mockResolvedValue(null),
    } as any;

    const sdkClient = {
      getTrade: jest.fn().mockResolvedValue({ status: TRADE_STATUS_IN_TRANSIT }),
    } as any;

    const worker = new ConfirmationWorker(indexerClient, sdkClient);
    const checkConfirmation = (worker as any).checkConfirmation.bind(worker);

    await checkConfirmation(makeTrigger());

    expect(sdkClient.getTrade).toHaveBeenCalledWith('1');
    expect(mockUpdateTrigger).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: TriggerStatus.CONFIRMED,
        on_chain_verified: true,
      }),
    );
  });

  it('does not mark confirmed when chain state is still pending', async () => {
    const indexerClient = {
      findConfirmationEvent: jest.fn().mockResolvedValue(null),
    } as any;

    const sdkClient = {
      getTrade: jest.fn().mockResolvedValue({ status: TRADE_STATUS_LOCKED }),
    } as any;

    const worker = new ConfirmationWorker(indexerClient, sdkClient);
    const checkConfirmation = (worker as any).checkConfirmation.bind(worker);

    await checkConfirmation(makeTrigger());

    expect(sdkClient.getTrade).toHaveBeenCalledWith('1');
    expect(mockUpdateTrigger).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: TriggerStatus.CONFIRMED }),
    );
  });

  it('rate-limits on-chain fallback checks per tradeId', async () => {
    const indexerClient = {
      findConfirmationEvent: jest.fn().mockResolvedValue(null),
    } as any;

    const sdkClient = {
      getTrade: jest.fn().mockResolvedValue({ status: TRADE_STATUS_LOCKED }),
    } as any;

    const worker = new ConfirmationWorker(indexerClient, sdkClient);
    const checkConfirmation = (worker as any).checkConfirmation.bind(worker);
    const trigger = makeTrigger();

    await checkConfirmation(trigger);
    await checkConfirmation(trigger);

    expect(sdkClient.getTrade).toHaveBeenCalledTimes(1);
  });

  it('prefers on-chain confirmation before moving to exhausted on hard timeout', async () => {
    const indexerClient = {
      findConfirmationEvent: jest.fn().mockResolvedValue(null),
    } as any;

    const sdkClient = {
      getTrade: jest.fn().mockResolvedValue({ status: TRADE_STATUS_IN_TRANSIT }),
    } as any;

    const worker = new ConfirmationWorker(indexerClient, sdkClient);
    const checkConfirmation = (worker as any).checkConfirmation.bind(worker);

    await checkConfirmation(
      makeTrigger({ submitted_at: new Date(Date.now() - 35 * 60 * 1000) })
    );

    expect(mockUpdateTrigger).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: TriggerStatus.CONFIRMED,
        on_chain_verified: true,
      }),
    );
    expect(mockUpdateTrigger).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: TriggerStatus.EXHAUSTED_NEEDS_REDRIVE }),
    );
  });
});

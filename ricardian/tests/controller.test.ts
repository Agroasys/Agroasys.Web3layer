import type { Request, Response } from 'express';
import { RicardianController } from '../src/api/controller';
import { buildRicardianHash } from '../src/utils/hash';
import { createRicardianHash } from '../src/database/queries';

jest.mock('../src/utils/hash', () => ({
  buildRicardianHash: jest.fn(),
}));

jest.mock('../src/database/queries', () => ({
  createRicardianHash: jest.fn(),
  getRicardianHash: jest.fn(),
}));

type MockedResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

function createMockResponse(): MockedResponse {
  const res = {} as MockedResponse;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('RicardianController.createHash', () => {
  const controller = new RicardianController();
  const mockedBuildRicardianHash = buildRicardianHash as jest.MockedFunction<typeof buildRicardianHash>;
  const mockedCreateRicardianHash = createRicardianHash as jest.MockedFunction<typeof createRicardianHash>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('returns 400 for payload validation failures', async () => {
    mockedBuildRicardianHash.mockImplementation(() => {
      throw new Error('documentRef is required');
    });

    const req = {
      body: {},
    } as Request;
    const res = createMockResponse();

    await controller.createHash(req as Request<{}, {}, any>, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'documentRef is required',
      })
    );
  });

  test('returns 500 for persistence failures after valid payload', async () => {
    mockedBuildRicardianHash.mockReturnValue({
      requestId: 'req-1',
      documentRef: 'doc://ok',
      canonicalJson: '{"ok":true}',
      hash: 'a'.repeat(64),
      rulesVersion: 'RICARDIAN_CANONICAL_V1',
      metadata: {},
    });

    mockedCreateRicardianHash.mockRejectedValue(new Error('db unavailable'));

    const req = {
      body: { documentRef: 'doc://ok', terms: { ok: true } },
    } as Request;
    const res = createMockResponse();

    await controller.createHash(req as Request<{}, {}, any>, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'db unavailable',
      })
    );
  });
});

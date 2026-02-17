import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import {
  buildServiceAuthCanonicalString,
  createServiceAuthMiddleware,
  parseServiceApiKeys,
  signServiceAuthCanonicalString,
} from '../src/auth/serviceAuth';

interface MockResponse extends Response {
  status: jest.Mock;
  json: jest.Mock;
}

function createMockResponse(): MockResponse {
  const response = {} as MockResponse;
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
}

function createSignedRequest(options?: {
  method?: string;
  path?: string;
  query?: string;
  body?: Buffer;
  apiKey?: string;
  timestamp?: string;
  nonce?: string;
  secret?: string;
  signatureOverride?: string;
}) {
  const method = options?.method || 'POST';
  const path = options?.path || '/api/treasury/v1/ingest';
  const query = options?.query || '';
  const body = options?.body || Buffer.from('{"ingest":true}');
  const timestamp = options?.timestamp || '1700000000';
  const nonce = options?.nonce || 'nonce-1';
  const apiKey = options?.apiKey || 'svc-a';
  const secret = options?.secret || 'secret-a';

  const bodySha256 = crypto.createHash('sha256').update(body).digest('hex');
  const canonical = buildServiceAuthCanonicalString({
    method,
    path,
    query,
    bodySha256,
    timestamp,
    nonce,
  });

  const signature = options?.signatureOverride || signServiceAuthCanonicalString(secret, canonical);
  const originalUrl = query ? `${path}?${query}` : path;

  const headers = new Map<string, string>([
    ['x-api-key', apiKey],
    ['x-timestamp', timestamp],
    ['x-nonce', nonce],
    ['x-signature', signature],
  ]);

  const request = {
    method,
    originalUrl,
    rawBody: body,
    header(name: string) {
      return headers.get(name.toLowerCase());
    },
  } as unknown as Request;

  return { request, headers };
}

describe('service auth middleware (treasury)', () => {
  const lookupApiKey = (apiKey: string) => {
    if (apiKey === 'svc-a') {
      return {
        id: 'svc-a',
        secret: 'secret-a',
        active: true,
      };
    }

    if (apiKey === 'svc-inactive') {
      return {
        id: 'svc-inactive',
        secret: 'secret-inactive',
        active: false,
      };
    }

    return undefined;
  };

  const nowSeconds = () => 1700000000;

  test('valid signature passes', async () => {
    const consumeNonce = jest.fn().mockResolvedValue(true);
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce,
      nowSeconds,
    });

    const { request } = createSignedRequest();
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(consumeNonce).toHaveBeenCalledWith('svc-a', 'nonce-1', 600);
  });

  test('invalid signature fails', async () => {
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce: jest.fn().mockResolvedValue(true),
      nowSeconds,
    });

    const { request } = createSignedRequest({
      signatureOverride: 'f'.repeat(64),
    });
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid signature', code: 'AUTH_INVALID_SIGNATURE' })
    );
  });

  test('expired timestamp fails', async () => {
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce: jest.fn().mockResolvedValue(true),
      nowSeconds,
    });

    const { request } = createSignedRequest({
      timestamp: '1699999000',
    });
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Timestamp outside allowed skew window', code: 'AUTH_TIMESTAMP_SKEW' })
    );
  });

  test('replayed nonce fails', async () => {
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce: jest.fn().mockResolvedValue(false),
      nowSeconds,
    });

    const { request } = createSignedRequest();
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Replay detected for nonce', code: 'AUTH_NONCE_REPLAY' })
    );
  });

  test('missing header fails', async () => {
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce: jest.fn().mockResolvedValue(true),
      nowSeconds,
    });

    const { request, headers } = createSignedRequest();
    headers.delete('x-signature');

    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Missing authentication headers', code: 'AUTH_MISSING_HEADERS' })
    );
  });

  test('invalid nonce format fails', async () => {
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce: jest.fn().mockResolvedValue(true),
      nowSeconds,
    });

    const { request } = createSignedRequest({ nonce: '   ' });
    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid nonce format', code: 'AUTH_INVALID_NONCE' })
    );
  });

  test('inactive key returns forbidden', async () => {
    const middleware = createServiceAuthMiddleware({
      enabled: true,
      maxSkewSeconds: 300,
      nonceTtlSeconds: 600,
      lookupApiKey,
      consumeNonce: jest.fn().mockResolvedValue(true),
      nowSeconds,
    });

    const { request } = createSignedRequest({
      apiKey: 'svc-inactive',
      secret: 'secret-inactive',
    });

    const response = createMockResponse();
    const next = jest.fn() as NextFunction;

    await middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'API key is inactive', code: 'AUTH_FORBIDDEN' }));
  });

  test('parseServiceApiKeys rejects string active values', () => {
    expect(() =>
      parseServiceApiKeys(JSON.stringify([{ id: 'svc-string', secret: 'secret', active: 'false' }]))
    ).toThrow('API_KEYS_JSON[0].active must be a boolean true or false');
  });

  test('parseServiceApiKeys rejects missing active values', () => {
    expect(() => parseServiceApiKeys(JSON.stringify([{ id: 'svc-missing', secret: 'secret' }]))).toThrow(
      'API_KEYS_JSON[0].active must be a boolean true or false'
    );
  });

  test('parseServiceApiKeys rejects API key ids over max length', () => {
    const oversizedId = 'a'.repeat(129);
    expect(() =>
      parseServiceApiKeys(JSON.stringify([{ id: oversizedId, secret: 'secret', active: true }]))
    ).toThrow('API_KEYS_JSON[0].id must be <= 128 characters');
  });
});

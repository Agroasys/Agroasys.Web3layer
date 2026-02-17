import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { incrementAuthFailure, incrementReplayReject } from '../metrics/counters';

const SIGNATURE_HEX_REGEX = /^[a-f0-9]{64}$/i;

export interface ServiceApiKey {
  id: string;
  secret: string;
  active: boolean;
}

export interface ServiceAuthMiddlewareOptions {
  enabled: boolean;
  maxSkewSeconds: number;
  nonceTtlSeconds: number;
  nowSeconds?: () => number;
  lookupApiKey: (apiKey: string) => ServiceApiKey | undefined;
  consumeNonce: (apiKey: string, nonce: string, ttlSeconds: number) => Promise<boolean>;
}

interface CanonicalRequestParts {
  method: string;
  path: string;
  query: string;
  bodySha256: string;
  timestamp: string;
  nonce: string;
}

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function bodyHash(rawBody: Buffer | undefined): string {
  return crypto.createHash('sha256').update(rawBody ?? Buffer.alloc(0)).digest('hex');
}

function timingSafeHexEquals(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();

  if (!SIGNATURE_HEX_REGEX.test(normalizedA) || !SIGNATURE_HEX_REGEX.test(normalizedB)) {
    return false;
  }

  const aBuffer = Buffer.from(normalizedA, 'hex');
  const bBuffer = Buffer.from(normalizedB, 'hex');

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function unauthorized(res: Response, message: string): void {
  incrementAuthFailure(message);
  res.status(401).json({
    success: false,
    error: message,
  });
}

function forbidden(res: Response, message: string): void {
  incrementAuthFailure(message);
  res.status(403).json({
    success: false,
    error: message,
  });
}

function unavailable(res: Response): void {
  incrementAuthFailure('auth_service_unavailable');
  res.status(503).json({
    success: false,
    error: 'Authentication service unavailable',
  });
}

function requestPathAndQuery(req: Request): { path: string; query: string } {
  const url = req.originalUrl;
  const separatorIndex = url.indexOf('?');

  if (separatorIndex === -1) {
    return { path: url, query: '' };
  }

  return {
    path: url.slice(0, separatorIndex),
    query: url.slice(separatorIndex + 1),
  };
}

export function buildServiceAuthCanonicalString(parts: CanonicalRequestParts): string {
  return [parts.method, parts.path, parts.query, parts.bodySha256, parts.timestamp, parts.nonce].join('\n');
}

export function signServiceAuthCanonicalString(secret: string, canonicalString: string): string {
  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

function parseActiveFlag(rawActive: unknown, index: number): boolean {
  if (rawActive === undefined) {
    return true;
  }

  if (typeof rawActive === 'boolean') {
    return rawActive;
  }

  if (typeof rawActive === 'string') {
    const normalized = rawActive.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  throw new Error(`API_KEYS_JSON[${index}].active must be a boolean`);
}

export function parseServiceApiKeys(raw: string | undefined): ServiceApiKey[] {
  if (!raw || !raw.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('API_KEYS_JSON must be valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('API_KEYS_JSON must be an array');
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`API_KEYS_JSON[${index}] must be an object`);
    }

    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const secret = typeof candidate.secret === 'string' ? candidate.secret.trim() : '';
    const active = parseActiveFlag(candidate.active, index);

    if (!id) {
      throw new Error(`API_KEYS_JSON[${index}].id is required`);
    }

    if (!secret) {
      throw new Error(`API_KEYS_JSON[${index}].secret is required`);
    }

    return {
      id,
      secret,
      active,
    };
  });
}

export function createServiceAuthMiddleware(options: ServiceAuthMiddlewareOptions) {
  const nowSeconds = options.nowSeconds || (() => Math.floor(Date.now() / 1000));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!options.enabled) {
      next();
      return;
    }

    const apiKey = req.header('X-Api-Key');
    const timestamp = req.header('X-Timestamp');
    const nonce = req.header('X-Nonce');
    const signature = req.header('X-Signature');

    if (!apiKey || !timestamp || !nonce || !signature) {
      unauthorized(res, 'Missing authentication headers');
      return;
    }

    if (!/^\d+$/.test(timestamp)) {
      unauthorized(res, 'Invalid timestamp format');
      return;
    }

    const timestampSeconds = Number.parseInt(timestamp, 10);
    const skew = Math.abs(nowSeconds() - timestampSeconds);
    if (skew > options.maxSkewSeconds) {
      unauthorized(res, 'Timestamp outside allowed skew window');
      return;
    }

    const apiKeyRecord = options.lookupApiKey(apiKey);
    if (!apiKeyRecord) {
      unauthorized(res, 'Unknown API key');
      return;
    }

    if (!apiKeyRecord.active) {
      forbidden(res, 'API key is inactive');
      return;
    }

    const { path, query } = requestPathAndQuery(req);
    const canonicalString = buildServiceAuthCanonicalString({
      method: req.method.toUpperCase(),
      path,
      query,
      bodySha256: bodyHash((req as RawBodyRequest).rawBody),
      timestamp,
      nonce,
    });

    const expectedSignature = signServiceAuthCanonicalString(apiKeyRecord.secret, canonicalString);
    if (!timingSafeHexEquals(signature, expectedSignature)) {
      unauthorized(res, 'Invalid signature');
      return;
    }

    try {
      const accepted = await options.consumeNonce(apiKey, nonce, options.nonceTtlSeconds);
      if (!accepted) {
        incrementReplayReject();
        unauthorized(res, 'Replay detected for nonce');
        return;
      }
    } catch {
      unavailable(res);
      return;
    }

    next();
  };
}

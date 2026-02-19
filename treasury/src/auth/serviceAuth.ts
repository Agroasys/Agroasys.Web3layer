import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { incrementAuthFailure, incrementReplayReject } from '../metrics/counters';

const SIGNATURE_HEX_REGEX = /^[a-f0-9]{64}$/i;
const API_KEY_MAX_LENGTH = 128;
const NONCE_MAX_LENGTH = 255;
const SHARED_HMAC_KEY_ID = '__shared_hmac__';

export interface ServiceApiKey {
  id: string;
  secret: string;
  active: boolean;
}

export interface ServiceAuthContext {
  apiKeyId: string;
  scheme: 'api_key' | 'shared_secret';
}

export interface ServiceAuthMiddlewareOptions {
  enabled: boolean;
  maxSkewSeconds: number;
  nonceTtlSeconds: number;
  sharedSecret?: string;
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
  serviceAuth?: ServiceAuthContext;
}

interface ServiceAuthPrincipal {
  id: string;
  secret: string;
  active: boolean;
  scheme: 'api_key' | 'shared_secret';
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

function authError(res: Response, statusCode: 401 | 403 | 503, code: string, message: string): void {
  incrementAuthFailure(code);
  res.status(statusCode).json({
    success: false,
    code,
    error: message,
  });
}

function unauthorized(res: Response, code: string, message: string): void {
  authError(res, 401, code, message);
}

function forbidden(res: Response, message: string): void {
  authError(res, 403, 'AUTH_FORBIDDEN', message);
}

function unavailable(res: Response): void {
  authError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication service unavailable');
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

function parseActiveFlag(rawActive: unknown, index: number): boolean {
  if (typeof rawActive === 'boolean') {
    return rawActive;
  }

  throw new Error(`API_KEYS_JSON[${index}].active must be a boolean true or false`);
}

function firstHeader(req: Request, headerNames: string[]): string | undefined {
  for (const headerName of headerNames) {
    const value = req.header(headerName);
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function resolvePrincipal(apiKey: string | undefined, options: ServiceAuthMiddlewareOptions): ServiceAuthPrincipal | null {
  if (apiKey) {
    if (apiKey.length > API_KEY_MAX_LENGTH) {
      return null;
    }

    const apiKeyRecord = options.lookupApiKey(apiKey);
    if (!apiKeyRecord) {
      return null;
    }

    return {
      id: apiKeyRecord.id,
      secret: apiKeyRecord.secret,
      active: apiKeyRecord.active,
      scheme: 'api_key',
    };
  }

  if (options.sharedSecret && options.sharedSecret.trim()) {
    return {
      id: SHARED_HMAC_KEY_ID,
      secret: options.sharedSecret.trim(),
      active: true,
      scheme: 'shared_secret',
    };
  }

  return null;
}

function deriveNonce(parts: Omit<CanonicalRequestParts, 'nonce'>): string {
  return crypto
    .createHash('sha256')
    .update([parts.method, parts.path, parts.query, parts.bodySha256, parts.timestamp].join('\n'))
    .digest('hex')
    .slice(0, NONCE_MAX_LENGTH);
}

export function buildServiceAuthCanonicalString(parts: CanonicalRequestParts): string {
  return [parts.method, parts.path, parts.query, parts.bodySha256, parts.timestamp, parts.nonce].join('\n');
}

export function signServiceAuthCanonicalString(secret: string, canonicalString: string): string {
  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
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
      throw new Error('API_KEYS_JSON[].id is required');
    }

    if (id.length > API_KEY_MAX_LENGTH) {
      throw new Error(`API_KEYS_JSON[${index}].id must be <= ${API_KEY_MAX_LENGTH} characters`);
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

    const apiKey = firstHeader(req, ['X-Api-Key']);
    const timestamp = firstHeader(req, ['x-agroasys-timestamp', 'X-Timestamp']);
    const nonceHeader = firstHeader(req, ['x-agroasys-nonce', 'X-Nonce']);
    const signature = firstHeader(req, ['x-agroasys-signature', 'X-Signature']);

    if (!timestamp || !signature) {
      unauthorized(res, 'AUTH_MISSING_HEADERS', 'Missing authentication headers');
      return;
    }

    if (!/^\d+$/.test(timestamp)) {
      unauthorized(res, 'AUTH_INVALID_TIMESTAMP', 'Invalid timestamp format');
      return;
    }

    const timestampSeconds = Number.parseInt(timestamp, 10);
    if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) {
      unauthorized(res, 'AUTH_INVALID_TIMESTAMP', 'Invalid timestamp format');
      return;
    }

    const skew = Math.abs(nowSeconds() - timestampSeconds);
    if (skew > options.maxSkewSeconds) {
      unauthorized(res, 'AUTH_TIMESTAMP_SKEW', 'Timestamp outside allowed skew window');
      return;
    }

    const principal = resolvePrincipal(apiKey, options);
    if (!principal) {
      unauthorized(res, 'AUTH_UNKNOWN_API_KEY', 'Unknown API key');
      return;
    }

    if (!principal.active) {
      forbidden(res, 'API key is inactive');
      return;
    }

    const { path, query } = requestPathAndQuery(req);
    const bodySha256 = bodyHash((req as RawBodyRequest).rawBody);
    const nonce = nonceHeader || deriveNonce({
      method: req.method.toUpperCase(),
      path,
      query,
      bodySha256,
      timestamp,
    });

    if (!nonce.trim() || nonce.length > NONCE_MAX_LENGTH) {
      unauthorized(res, 'AUTH_INVALID_NONCE', 'Invalid nonce format');
      return;
    }

    const canonicalString = buildServiceAuthCanonicalString({
      method: req.method.toUpperCase(),
      path,
      query,
      bodySha256,
      timestamp,
      nonce,
    });

    const expectedSignature = signServiceAuthCanonicalString(principal.secret, canonicalString);
    if (!timingSafeHexEquals(signature, expectedSignature)) {
      unauthorized(res, 'AUTH_INVALID_SIGNATURE', 'Invalid signature');
      return;
    }

    try {
      const accepted = await options.consumeNonce(principal.id, nonce, options.nonceTtlSeconds);
      if (!accepted) {
        incrementReplayReject();
        unauthorized(res, 'AUTH_NONCE_REPLAY', 'Replay detected for nonce');
        return;
      }
    } catch {
      unavailable(res);
      return;
    }

    (req as RawBodyRequest).serviceAuth = {
      apiKeyId: principal.id,
      scheme: principal.scheme,
    };

    next();
  };
}

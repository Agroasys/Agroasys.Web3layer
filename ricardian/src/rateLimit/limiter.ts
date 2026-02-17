import crypto from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';

export interface RateLimitWindowConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitRouteConfig {
  burst: RateLimitWindowConfig;
  sustained: RateLimitWindowConfig;
}

export interface RicardianRateLimitConfig {
  enabled: boolean;
  redisUrl?: string;
  nodeEnv: string;
  writeRoute: RateLimitRouteConfig;
  readRoute: RateLimitRouteConfig;
}

export interface RateLimiterLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface RateLimitStoreResult {
  count: number;
  resetSeconds: number;
}

interface RateLimitStore {
  incrementAndGet(key: string, windowSeconds: number, nowSeconds: number): Promise<RateLimitStoreResult>;
  close(): Promise<void>;
}

interface RateLimiterOptions {
  config: RicardianRateLimitConfig;
  logger?: RateLimiterLogger;
  nowSeconds?: () => number;
  store?: RateLimitStore;
}

interface CallerContext {
  key: string;
  keyType: 'ip';
  fingerprint: string;
}

interface WindowResult {
  name: 'burst' | 'sustained';
  limit: number;
  count: number;
  resetSeconds: number;
}

export interface RicardianRateLimiter {
  middleware: RequestHandler;
  close: () => Promise<void>;
  mode: 'disabled' | 'memory' | 'redis';
}

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async incrementAndGet(key: string, windowSeconds: number, nowSeconds: number): Promise<RateLimitStoreResult> {
    const bucketKey = `${key}:${windowSeconds}`;
    const existing = this.buckets.get(bucketKey);

    if (!existing || existing.expiresAt <= nowSeconds) {
      const expiresAt = nowSeconds + windowSeconds;
      this.buckets.set(bucketKey, { count: 1, expiresAt });
      return {
        count: 1,
        resetSeconds: windowSeconds,
      };
    }

    existing.count += 1;

    return {
      count: existing.count,
      resetSeconds: Math.max(0, existing.expiresAt - nowSeconds),
    };
  }

  async close(): Promise<void> {
    this.buckets.clear();
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  async incrementAndGet(key: string, windowSeconds: number, nowSeconds: number): Promise<RateLimitStoreResult> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    const bucket = Math.floor(nowSeconds / windowSeconds);
    const redisKey = `ricardian:rate-limit:${key}:${windowSeconds}:${bucket}`;

    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }

    const resetSeconds = windowSeconds - (nowSeconds % windowSeconds);

    return {
      count,
      resetSeconds,
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

function fallbackLogger(): RateLimiterLogger {
  return Logger;
}

function fingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function callerContext(req: Request): CallerContext {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return {
    key: `ip:${ip}`,
    keyType: 'ip',
    fingerprint: fingerprint(ip),
  };
}

function normalizeRoutePath(path: string): string {
  if (path.length <= 1) {
    return path;
  }

  const normalized = path.replace(/\/+$/, '');
  return normalized.length === 0 ? '/' : normalized;
}

function routeKind(req: Request): 'write' | 'read' | null {
  const path = normalizeRoutePath(req.path);

  if (path === '/health') {
    return null;
  }

  if (req.method.toUpperCase() === 'POST' && path === '/hash') {
    return 'write';
  }

  if (req.method.toUpperCase() === 'GET' && path.startsWith('/hash/')) {
    return 'read';
  }

  return null;
}

function setRateLimitHeaders(res: Response, routePolicy: RateLimitRouteConfig, currentWindow: WindowResult): void {
  const policyValue = `burst;w=${routePolicy.burst.windowSeconds}, sustained;w=${routePolicy.sustained.windowSeconds}`;

  res.setHeader('RateLimit-Limit', currentWindow.limit.toString());
  res.setHeader('RateLimit-Remaining', Math.max(0, currentWindow.limit - currentWindow.count).toString());
  res.setHeader('RateLimit-Reset', currentWindow.resetSeconds.toString());
  res.setHeader('RateLimit-Policy', policyValue);
}

function validateConfig(config: RicardianRateLimitConfig): void {
  const windows: RateLimitWindowConfig[] = [
    config.writeRoute.burst,
    config.writeRoute.sustained,
    config.readRoute.burst,
    config.readRoute.sustained,
  ];

  windows.forEach((window) => {
    if (window.limit <= 0) {
      throw new Error('Rate limit value must be > 0');
    }

    if (window.windowSeconds <= 0) {
      throw new Error('Rate limit window must be > 0');
    }
  });
}

async function chooseStore(options: RateLimiterOptions, logger: RateLimiterLogger): Promise<{ store: RateLimitStore; mode: 'memory' | 'redis' }> {
  if (options.store) {
    return {
      store: options.store,
      mode: 'memory',
    };
  }

  if (!options.config.redisUrl) {
    if (options.config.nodeEnv === 'production') {
      throw new Error('RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_ENABLED=true in production');
    }

    logger.warn('Rate limiter using in-memory store (local/dev fallback)');
    return {
      store: new InMemoryRateLimitStore(),
      mode: 'memory',
    };
  }

  const redisStore = new RedisRateLimitStore(options.config.redisUrl);

  try {
    await redisStore.incrementAndGet('bootstrap', 1, Math.floor(Date.now() / 1000));
    return {
      store: redisStore,
      mode: 'redis',
    };
  } catch (error: any) {
    await redisStore.close();

    if (options.config.nodeEnv === 'production') {
      throw new Error(`Failed to connect rate limiter to Redis: ${error?.message || error}`);
    }

    logger.warn('Rate limiter falling back to in-memory store after Redis connection failure', {
      error: error?.message || error,
    });

    return {
      store: new InMemoryRateLimitStore(),
      mode: 'memory',
    };
  }
}

async function evaluateRoute(
  store: RateLimitStore,
  routePolicy: RateLimitRouteConfig,
  key: string,
  nowSeconds: number
): Promise<{ limited: boolean; currentWindow: WindowResult; violatedWindow?: WindowResult }> {
  const burstResult = await store.incrementAndGet(`${key}:burst`, routePolicy.burst.windowSeconds, nowSeconds);
  const burstWindow: WindowResult = {
    name: 'burst',
    limit: routePolicy.burst.limit,
    count: burstResult.count,
    resetSeconds: burstResult.resetSeconds,
  };

  if (burstResult.count > routePolicy.burst.limit) {
    return {
      limited: true,
      currentWindow: burstWindow,
      violatedWindow: burstWindow,
    };
  }

  const sustainedResult = await store.incrementAndGet(`${key}:sustained`, routePolicy.sustained.windowSeconds, nowSeconds);
  const sustainedWindow: WindowResult = {
    name: 'sustained',
    limit: routePolicy.sustained.limit,
    count: sustainedResult.count,
    resetSeconds: sustainedResult.resetSeconds,
  };

  if (sustainedResult.count > routePolicy.sustained.limit) {
    return {
      limited: true,
      currentWindow: sustainedWindow,
      violatedWindow: sustainedWindow,
    };
  }

  return {
    limited: false,
    currentWindow: sustainedWindow,
  };
}

export async function createRicardianRateLimiter(options: RateLimiterOptions): Promise<RicardianRateLimiter> {
  if (!options.config.enabled) {
    return {
      mode: 'disabled',
      middleware: (_req, _res, next) => {
        next();
      },
      close: async () => {
        return;
      },
    };
  }

  validateConfig(options.config);

  const logger = options.logger || fallbackLogger();
  const nowSeconds = options.nowSeconds || (() => Math.floor(Date.now() / 1000));
  const { store, mode } = await chooseStore(options, logger);

  const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const kind = routeKind(req);
    if (!kind) {
      next();
      return;
    }

    const policy = kind === 'write' ? options.config.writeRoute : options.config.readRoute;
    const caller = callerContext(req);

    try {
      const evaluated = await evaluateRoute(store, policy, `${kind}:${caller.key}`, nowSeconds());
      setRateLimitHeaders(res, policy, evaluated.currentWindow);

      if (evaluated.limited && evaluated.violatedWindow) {
        res.setHeader('Retry-After', evaluated.violatedWindow.resetSeconds.toString());

        logger.warn('Ricardian rate limit exceeded', {
          routeKind: kind,
          method: req.method,
          path: req.path,
          keyType: caller.keyType,
          keyFingerprint: caller.fingerprint,
          window: evaluated.violatedWindow.name,
          limit: evaluated.violatedWindow.limit,
          count: evaluated.violatedWindow.count,
          retryAfterSeconds: evaluated.violatedWindow.resetSeconds,
        });

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Retry after the provided delay.',
          retryAfterSeconds: evaluated.violatedWindow.resetSeconds,
        });
        return;
      }

      next();
    } catch (error: any) {
      logger.error('Ricardian rate limiter failed', {
        error: error?.message || error,
        method: req.method,
        path: req.path,
      });

      res.status(503).json({
        success: false,
        error: 'Rate limiting unavailable',
      });
    }
  };

  return {
    middleware,
    mode,
    close: async () => {
      await store.close();
    },
  };
}

export interface NonceConsumeResultRow {
  accepted?: boolean;
}

export interface NonceStore {
  consume: (apiKey: string, nonce: string, ttlSeconds: number) => Promise<boolean>;
  close: () => Promise<void>;
}

export interface InMemoryNonceStoreOptions {
  maxEntries?: number;
  nowMs?: () => number;
}

export interface InMemoryNonceStore extends NonceStore {
  size: () => number;
}

export interface PostgresNonceStoreOptions {
  tableName: string;
  apiKeyColumn?: string;
  nonceColumn?: string;
  expiresAtColumn?: string;
  query: (sql: string, params: unknown[]) => Promise<{ rows?: NonceConsumeResultRow[] }>;
}

export interface RedisNonceStoreOptions {
  redisUrl: string;
  keyPrefix?: string;
  redisClient?: {
    status: string;
    connect: () => Promise<void>;
    set: (...args: unknown[]) => Promise<string | null>;
    quit: () => Promise<void>;
    disconnect: (reconnect?: boolean) => void;
  };
  Redis?: new (...args: unknown[]) => {
    status: string;
    connect: () => Promise<void>;
    set: (...args: unknown[]) => Promise<string | null>;
    quit: () => Promise<void>;
    disconnect: (reconnect?: boolean) => void;
  };
}

export function createInMemoryNonceStore(options?: InMemoryNonceStoreOptions): InMemoryNonceStore;
export function createPostgresNonceStore(options: PostgresNonceStoreOptions): NonceStore;
export function createRedisNonceStore(options: RedisNonceStoreOptions): NonceStore;

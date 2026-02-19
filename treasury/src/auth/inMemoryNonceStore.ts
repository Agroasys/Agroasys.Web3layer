export interface InMemoryNonceStoreOptions {
  maxEntries?: number;
  nowMs?: () => number;
}

export interface InMemoryNonceStore {
  consume: (apiKey: string, nonce: string, ttlSeconds: number) => Promise<boolean>;
  size: () => number;
}

export function createInMemoryNonceStore(options: InMemoryNonceStoreOptions = {}): InMemoryNonceStore {
  const maxEntries = options.maxEntries ?? 10000;
  const nowMs = options.nowMs ?? (() => Date.now());
  const store = new Map<string, number>();

  const pruneExpired = (currentTime: number): void => {
    for (const [key, expiresAt] of store) {
      if (expiresAt <= currentTime) {
        store.delete(key);
      }
    }
  };

  const capStoreSize = (): void => {
    while (store.size > maxEntries) {
      const firstKey = store.keys().next().value;
      if (!firstKey) {
        return;
      }
      store.delete(firstKey);
    }
  };

  return {
    consume: async (apiKey: string, nonce: string, ttlSeconds: number): Promise<boolean> => {
      if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
        throw new Error('nonce ttlSeconds must be a positive integer');
      }

      const currentTime = nowMs();
      pruneExpired(currentTime);

      const key = `${apiKey}:${nonce}`;
      const expiresAt = store.get(key);
      if (expiresAt && expiresAt > currentTime) {
        return false;
      }

      store.set(key, currentTime + ttlSeconds * 1000);
      capStoreSize();
      return true;
    },
    size: () => store.size,
  };
}

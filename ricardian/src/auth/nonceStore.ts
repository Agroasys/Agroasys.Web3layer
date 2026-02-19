import { createInMemoryNonceStore, createRedisNonceStore, type NonceStore } from '../../../shared/auth/nonceStore';
import { RicardianConfig } from '../config';
import { consumeServiceAuthNonce } from '../database/queries';
import { Logger } from '../utils/logger';

export interface RicardianNonceStore extends NonceStore {}

export function createRicardianNonceStore(config: RicardianConfig): RicardianNonceStore {
  if (config.nonceStore === 'postgres') {
    return {
      consume: consumeServiceAuthNonce,
      close: async () => undefined,
    };
  }

  if (config.nonceStore === 'redis') {
    return createRedisNonceStore({
      redisUrl: config.nonceRedisUrl!,
      keyPrefix: 'ricardian_auth_nonce',
    });
  }

  Logger.warn('Using in-memory nonce store for ricardian service', {
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  return createInMemoryNonceStore();
}

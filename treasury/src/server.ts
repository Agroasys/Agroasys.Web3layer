import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { createRouter } from './api/routes';
import { TreasuryController } from './api/controller';
import { closeConnection, testConnection } from './database/connection';
import { runMigrations } from './database/migrations';
import { Logger } from './utils/logger';
import { TreasuryIngestionService } from './core/ingestion';
import { consumeServiceAuthNonce } from './database/queries';
import { createServiceAuthMiddleware } from './auth/serviceAuth';

async function bootstrap(): Promise<void> {
  await testConnection();
  await runMigrations();

  const shouldIngestOnce = process.argv.includes('--ingest-once');

  if (shouldIngestOnce) {
    const ingestionService = new TreasuryIngestionService();
    await ingestionService.ingestOnce();
    await closeConnection();
    return;
  }

  const app = express();
  const controller = new TreasuryController();
  const apiKeysById = new Map(config.apiKeys.map((key) => [key.id, key]));

  const authMiddleware = createServiceAuthMiddleware({
    enabled: config.authEnabled,
    maxSkewSeconds: config.authMaxSkewSeconds,
    nonceTtlSeconds: config.authNonceTtlSeconds,
    lookupApiKey: (apiKey) => apiKeysById.get(apiKey),
    consumeNonce: consumeServiceAuthNonce,
  });

  app.use(helmet());
  app.use(cors());
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    })
  );

  app.use('/api/treasury/v1', createRouter(controller, authMiddleware));

  app.listen(config.port, () => {
    Logger.info('Treasury service started', {
      port: config.port,
      indexerGraphqlUrl: config.indexerGraphqlUrl,
      authEnabled: config.authEnabled,
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    Logger.info('Shutting down treasury service', { signal });
    await closeConnection();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch(async (error: any) => {
  Logger.error('Treasury bootstrap failed', {
    error: error?.message || error,
  });

  await closeConnection();
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { RicardianController } from './api/controller';
import { createRouter } from './api/routes';
import { closeConnection, testConnection } from './database/connection';
import { runMigrations } from './database/migrations';
import { consumeServiceAuthNonce } from './database/queries';
import { createServiceAuthMiddleware } from './auth/serviceAuth';

async function bootstrap(): Promise<void> {
  await testConnection();
  await runMigrations();

  const app = express();
  const controller = new RicardianController();
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

  app.use('/api/ricardian/v1', createRouter(controller, authMiddleware));

  app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Ricardian service started',
        port: config.port,
        timestamp: new Date().toISOString(),
      })
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(JSON.stringify({ level: 'info', message: 'Shutting down Ricardian service', signal }));
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
  console.error(JSON.stringify({ level: 'error', message: 'Ricardian bootstrap failed', error: error?.message || error }));
  await closeConnection();
  process.exit(1);
});

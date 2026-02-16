import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { RicardianController } from './api/controller';
import { createRouter } from './api/routes';
import { closeConnection, testConnection } from './database/connection';
import { runMigrations } from './database/migrations';
import { createRicardianRateLimiter } from './rateLimit/limiter';

async function bootstrap(): Promise<void> {
  await testConnection();
  await runMigrations();

  const app = express();
  const controller = new RicardianController();
  const rateLimiter = await createRicardianRateLimiter({
    config: {
      enabled: config.rateLimitEnabled,
      redisUrl: config.rateLimitRedisUrl,
      nodeEnv: process.env.NODE_ENV || 'development',
      writeRoute: {
        burst: {
          limit: config.rateLimitWriteBurstLimit,
          windowSeconds: config.rateLimitWriteBurstWindowSeconds,
        },
        sustained: {
          limit: config.rateLimitWriteSustainedLimit,
          windowSeconds: config.rateLimitWriteSustainedWindowSeconds,
        },
      },
      readRoute: {
        burst: {
          limit: config.rateLimitReadBurstLimit,
          windowSeconds: config.rateLimitReadBurstWindowSeconds,
        },
        sustained: {
          limit: config.rateLimitReadSustainedLimit,
          windowSeconds: config.rateLimitReadSustainedWindowSeconds,
        },
      },
    },
  });

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/api/ricardian/v1', createRouter(controller, rateLimiter.middleware));

  app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Ricardian service started',
        port: config.port,
        rateLimitEnabled: config.rateLimitEnabled,
        rateLimitMode: rateLimiter.mode,
        timestamp: new Date().toISOString(),
      })
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(JSON.stringify({ level: 'info', message: 'Shutting down Ricardian service', signal }));
    await rateLimiter.close();
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

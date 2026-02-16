import { closeConnection, testConnection } from './database/connection';
import { Logger } from './utils/logger';

async function runHealthcheck(): Promise<void> {
  try {
    await testConnection();
    Logger.info('Reconciliation healthcheck passed');
    await closeConnection();
    process.exit(0);
  } catch (error: any) {
    Logger.error('Reconciliation healthcheck failed', {
      error: error?.message || error,
    });

    await closeConnection();
    process.exit(1);
  }
}

void runHealthcheck();

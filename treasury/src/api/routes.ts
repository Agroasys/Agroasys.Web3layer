import { RequestHandler, Router } from 'express';
import { TreasuryController } from './controller';

export interface TreasuryRouterOptions {
  authMiddleware?: RequestHandler;
  readinessCheck?: () => Promise<void>;
}

export function createRouter(controller: TreasuryController, options: TreasuryRouterOptions = {}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ success: true, service: 'treasury', status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/ready', async (_req, res) => {
    try {
      if (options.readinessCheck) {
        await options.readinessCheck();
      }

      res.status(200).json({ success: true, service: 'treasury', ready: true, timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ success: false, service: 'treasury', ready: false, error: 'Dependencies not ready' });
    }
  });

  if (options.authMiddleware) {
    router.post('/ingest', options.authMiddleware, controller.ingest.bind(controller));
    router.post('/entries/:entryId/state', options.authMiddleware, controller.appendState.bind(controller));
  } else {
    router.post('/ingest', controller.ingest.bind(controller));
    router.post('/entries/:entryId/state', controller.appendState.bind(controller));
  }

  router.get('/entries', controller.listEntries.bind(controller));
  router.get('/export', controller.exportEntries.bind(controller));

  return router;
}

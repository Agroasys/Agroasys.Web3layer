import { RequestHandler, Router } from 'express';
import { TreasuryController } from './controller';

export function createRouter(controller: TreasuryController, authMiddleware?: RequestHandler): Router {
  const router = Router();

  router.get('/health', (_, res) => {
    res.status(200).json({ success: true, service: 'treasury', status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/ready', (_, res) => {
    res.status(200).json({ success: true, service: 'treasury', ready: true, timestamp: new Date().toISOString() });
  });

  if (authMiddleware) {
    router.use(authMiddleware);
  }

  router.post('/ingest', controller.ingest.bind(controller));
  router.get('/entries', controller.listEntries.bind(controller));
  router.post('/entries/:entryId/state', controller.appendState.bind(controller));
  router.get('/export', controller.exportEntries.bind(controller));

  return router;
}

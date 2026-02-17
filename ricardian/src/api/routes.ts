import { RequestHandler, Router } from 'express';
import { RicardianController } from './controller';

export function createRouter(
  controller: RicardianController,
  authMiddleware?: RequestHandler,
  rateLimitMiddleware?: RequestHandler,
): Router {
  const router = Router();

  router.get('/health', (_, res) => {
    res.status(200).json({ success: true, service: 'ricardian', status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/ready', (_, res) => {
    res.status(200).json({ success: true, service: 'ricardian', ready: true, timestamp: new Date().toISOString() });
  });

  if (rateLimitMiddleware) {
    router.use(rateLimitMiddleware);
  }

  if (authMiddleware) {
    router.use(authMiddleware);
  }

  router.post('/hash', controller.createHash.bind(controller));
  router.get('/hash/:hash', controller.getHash.bind(controller));

  return router;
}

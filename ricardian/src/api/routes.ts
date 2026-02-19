import { RequestHandler, Router } from 'express';
import { RicardianController } from './controller';

export interface RicardianRouterOptions {
  authMiddleware?: RequestHandler;
  rateLimitMiddleware?: RequestHandler;
  readinessCheck?: () => Promise<void>;
}

export function createRouter(controller: RicardianController, options: RicardianRouterOptions = {}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ success: true, service: 'ricardian', status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/ready', async (_req, res) => {
    try {
      if (options.readinessCheck) {
        await options.readinessCheck();
      }

      res.status(200).json({ success: true, service: 'ricardian', ready: true, timestamp: new Date().toISOString() });
    } catch {
      res
        .status(503)
        .json({ success: false, service: 'ricardian', ready: false, error: 'Dependencies not ready' });
    }
  });

  if (options.authMiddleware && options.rateLimitMiddleware) {
    router.post('/hash', options.authMiddleware, options.rateLimitMiddleware, controller.createHash.bind(controller));
  } else if (options.authMiddleware) {
    router.post('/hash', options.authMiddleware, controller.createHash.bind(controller));
  } else if (options.rateLimitMiddleware) {
    router.post('/hash', options.rateLimitMiddleware, controller.createHash.bind(controller));
  } else {
    router.post('/hash', controller.createHash.bind(controller));
  }

  if (options.rateLimitMiddleware) {
    router.get('/hash/:hash', options.rateLimitMiddleware, controller.getHash.bind(controller));
  } else {
    router.get('/hash/:hash', controller.getHash.bind(controller));
  }

  return router;
}

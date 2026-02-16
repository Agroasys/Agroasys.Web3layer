import { Router } from 'express';
import { RicardianController } from './controller';

export function createRouter(controller: RicardianController): Router {
  const router = Router();

  router.post('/hash', controller.createHash.bind(controller));
  router.get('/hash/:hash', controller.getHash.bind(controller));

  router.get('/health', (_, res) => {
    res.status(200).json({ success: true, service: 'ricardian', timestamp: new Date().toISOString() });
  });

  return router;
}

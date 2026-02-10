import { Router } from 'express';
import { OracleController } from './controller';
import { authMiddleware, idempotencyMiddleware } from './middleware';

const router = Router();


router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post(
    '/release-stage1',
    authMiddleware,
    idempotencyMiddleware,
    OracleController.releaseStage1
);

router.post(
    '/confirm-arrival',
    authMiddleware,
    idempotencyMiddleware,
    OracleController.confirmArrival
);

router.post(
    '/finalize-trade',
    authMiddleware,
    idempotencyMiddleware,
    OracleController.finalizeTrade
);

export default router;
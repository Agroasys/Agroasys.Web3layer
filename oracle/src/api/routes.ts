import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, hmacMiddleware } from '../middleware/middleware';
import { OracleController } from './controller';


function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export function createRouter(controller: OracleController): Router {
    const router = Router();

    router.get('/health', (req, res) => {
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString()
        });
    });

    router.post(
        '/release-stage1',
        authMiddleware,
        hmacMiddleware,
        asyncHandler((req, res) => controller.releaseStage1(req, res))
    );

    router.post(
        '/confirm-arrival',
        authMiddleware,
        hmacMiddleware,
        asyncHandler((req, res) => controller.confirmArrival(req, res))
    );

    router.post(
        '/finalize-trade',
        authMiddleware,
        hmacMiddleware,
        asyncHandler((req, res) => controller.finalizeTrade(req, res))
    );

    return router;
}
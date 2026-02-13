import { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { Logger } from './logger';
import { ErrorResponse } from './types/types';
import { getIdempotencyResponse } from './idempotency';

export function authMiddleware(req: Request,res: Response<ErrorResponse>,next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        Logger.warn('Missing authorization header', { ip: req.ip });
        res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Missing authorization header',
        timestamp: new Date().toISOString(),
        });
        return;
    }

    const token = authHeader.replace('Bearer ', '');

    if (token !== config.apiKey) {
        Logger.warn('Invalid API key', { ip: req.ip });
        res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid API key',
        timestamp: new Date().toISOString(),
        });
        return;
    }

    next();
}

export async function idempotencyMiddleware(req: Request,res: Response,next: NextFunction): Promise<void> {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
        Logger.warn('Missing idempotency key', { path: req.path });
        res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Idempotency-Key header is required',
        timestamp: new Date().toISOString(),
        });
        return;
    }

    try {
        const cached = await getIdempotencyResponse(idempotencyKey);
        
        if (cached) {
        Logger.info('Returning cached response from database', { idempotencyKey });
        res.status(200).json(cached);
        return;
        }

        (req as any).idempotencyKey = idempotencyKey;
        next();
    } catch (error) {
        Logger.error('Idempotency check failed', error);
        res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: 'Failed to process idempotency check',
        timestamp: new Date().toISOString(),
        });
    }
}

export function errorHandler(err: any,req: Request,res: Response<ErrorResponse>,next: NextFunction): void {
    Logger.error('Unhandled error', err);

    res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: err.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
    });
}
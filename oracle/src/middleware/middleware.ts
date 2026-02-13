import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { ErrorResponse } from '../types';
import { verifyRequestSignature } from '../utils/crypto';

export function authMiddleware(req: Request, res: Response<ErrorResponse>, next: NextFunction): void {
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

export function hmacMiddleware(req: Request, res: Response<ErrorResponse>, next: NextFunction): void {
    const timestamp = req.headers['x-timestamp'] as string;
    const signature = req.headers['x-signature'] as string;

    if (!timestamp || !signature) {
        Logger.warn('Missing HMAC headers', { ip: req.ip });
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Missing X-Timestamp or X-Signature headers',
            timestamp: new Date().toISOString(),
        });
        return;
    }

    try {
        const body = JSON.stringify(req.body);
        verifyRequestSignature(timestamp, body, signature, config.hmacSecret);
        
        Logger.info('HMAC signature verified', { 
            timestamp,
            ip: req.ip
        });
        
        next();
    } catch (error: any) {
        Logger.warn('HMAC verification failed', { 
            error: error.message,
            ip: req.ip 
        });
        res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: error.message,
            timestamp: new Date().toISOString(),
        });
    }
}

export function errorHandler(err: any, req: Request, res: Response<ErrorResponse>, next: NextFunction): void {
    Logger.error('Unhandled error', err);

    res.status(500).json({
        success: false,
        error: 'InternalServerError',
        message: err.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
    });
}
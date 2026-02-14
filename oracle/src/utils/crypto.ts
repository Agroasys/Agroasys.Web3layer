import crypto from 'crypto';
import { Logger } from './logger';

export function generateActionKey(operation: string, tradeId: string): string {
    return `${operation}:${tradeId}`;
}

export function generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
}

export function generateIdempotencyKey(actionKey: string, requestId: string): string {
    return `${actionKey}:${requestId}`;
}


export function generateRequestHash(timestamp: string, body: string, secret: string): string {
    const payload = timestamp + body;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyRequestSignature(
    timestamp: string,
    body: string,
    signature: string,
    secret: string,
    maxAgeMinutes: number = 5
): boolean {
    const requestTime = new Date(parseInt(timestamp));
    const now = new Date();
    const ageMinutes = (now.getTime() - requestTime.getTime()) / (1000 * 60);

    if (ageMinutes > maxAgeMinutes) {
        throw new Error(`Request timestamp too old: ${ageMinutes.toFixed(1)} minutes`);
    }

    if (ageMinutes < -1) {
        throw new Error('Request timestamp is in the future');
    }

    const expectedHash = generateRequestHash(timestamp, body, secret);
    
    if (signature.length !== expectedHash.length) {
        throw new Error('Invalid HMAC signature');
    }
    
    const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedHash, 'hex')
    );

    if (!isValid) {
        throw new Error('Invalid HMAC signature');
    }

    Logger.info('Request signature verified', { 
        timestamp, 
        ageSeconds: (ageMinutes * 60).toFixed(1) 
    });

    return true;
}

export function generateJitter(maxJitterMs: number = 1000): number {
    return Math.floor(Math.random() * maxJitterMs);
}

export function calculateBackoff(
    attempt: number,
    baseDelay: number,
    maxJitterMs: number = 1000
): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = generateJitter(maxJitterMs);
    const totalDelay = exponentialDelay + jitter;
    
    Logger.info('Calculated backoff', {
        attempt,
        exponentialDelay,
        jitter,
        totalDelay
    });
    
    return totalDelay;
}
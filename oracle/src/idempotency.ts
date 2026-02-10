import { pool } from './database';
import { OracleResponse } from './types';
import { Logger } from './logger';

const TTL_HOURS = 24;

export async function getIdempotencyResponse(idempotencyKey: string): Promise<OracleResponse | null> {
    try {
        const result = await pool.query(
            `SELECT response FROM idempotency_keys 
            WHERE idempotency_key = $1 AND expires_at > NOW()`,
            [idempotencyKey]
        );

        if (result.rows.length > 0) {
            Logger.info('Found cached idempotency response', { idempotencyKey });
            return result.rows[0].response;
        }

        return null;
    } catch (error) {
        Logger.error('Failed to get idempotency response', { idempotencyKey, error });
        throw error;
    }
}

export async function storeIdempotencyResponse(idempotencyKey: string,tradeId: string,operation: string,response: OracleResponse): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO idempotency_keys 
            (idempotency_key, trade_id, operation, response, expires_at) 
            VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${TTL_HOURS} hours')
            ON CONFLICT (idempotency_key) DO NOTHING`,
            [idempotencyKey, tradeId, operation, response]
        );

        Logger.info('Stored idempotency response', { 
            idempotencyKey, 
            tradeId, 
            operation 
        });
    } catch (error) {
        Logger.error('Failed to store idempotency response', { 
            idempotencyKey, 
            error 
        });
    }
}
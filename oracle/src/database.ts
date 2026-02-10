import { Pool } from 'pg';
import { config } from './config';
import { Logger } from './logger';

export const pool = new Pool({
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

export async function initializeDatabase() {
    try {
        await pool.query('SELECT NOW()');
        Logger.info('Database connection established');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                id SERIAL PRIMARY KEY,
                idempotency_key VARCHAR(255) UNIQUE NOT NULL,
                trade_id VARCHAR(100) NOT NULL,
                operation VARCHAR(50) NOT NULL,
                response JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            );
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_idempotency_key 
            ON idempotency_keys(idempotency_key);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_expires_at 
            ON idempotency_keys(expires_at);
        `);

        Logger.info('Database tables initialized');
    } catch (error) {
        Logger.error('Database initialization failed', error);
        throw error;
    }
}

export async function cleanupExpiredKeys() {
    try {
        const result = await pool.query(
            'DELETE FROM idempotency_keys WHERE expires_at < NOW()'
        );
        
        if (result.rowCount && result.rowCount > 0) {
        Logger.info('Cleaned up expired idempotency keys', { 
            count: result.rowCount 
        });
        }
    } catch (error) {
        Logger.error('Failed to cleanup expired keys', error);
    }
}

setInterval(cleanupExpiredKeys, 60 * 60 * 1000);
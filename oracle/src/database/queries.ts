import { pool } from './connection';

export const queries = {
    tradeExists: async (tradeId: string): Promise<boolean> => {
        const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM oracle_triggers WHERE trade_id = $1)',
            [tradeId]
        );
        return result.rows[0].exists;
    },

    getLatestTriggerForTrade: async (tradeId: string,triggerType: string): Promise<any> => {
        const result = await pool.query(
            `SELECT * FROM oracle_triggers
             WHERE trade_id = $1 AND trigger_type = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [tradeId, triggerType]
        );
        return result.rows[0] || null;
    },
};
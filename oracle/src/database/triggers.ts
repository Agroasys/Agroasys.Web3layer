import { pool } from './connection';
import { Logger } from '../utils/logger';
import { Trigger, CreateTriggerData, UpdateTriggerData,TriggerStatus } from '../types/trigger';


export async function createTrigger(data: CreateTriggerData): Promise<Trigger> {
    try {
        const result = await pool.query(
            `INSERT INTO oracle_triggers 
            (trigger_id, idempotency_key, request_id, trade_id, trigger_type, request_hash, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                data.triggerId,
                data.idempotencyKey,
                data.requestId,
                data.tradeId,
                data.triggerType,
                data.requestHash,
                data.status || TriggerStatus.PENDING
            ]
        );

        Logger.info('Trigger created', {
            triggerId: data.triggerId,
            tradeId: data.tradeId,
            type: data.triggerType
        });

        return result.rows[0];
    } catch (error: any) {
        Logger.error('Failed to create trigger', error);
        throw error;
    }
}


export async function getTrigger(triggerId: string): Promise<Trigger | null> {
    const result = await pool.query(
        'SELECT * FROM oracle_triggers WHERE trigger_id = $1',
        [triggerId]
    );
    return result.rows[0] || null;
}

export async function getTriggerByIdempotencyKey(idempotencyKey: string): Promise<Trigger | null> {
    const result = await pool.query(
        'SELECT * FROM oracle_triggers WHERE idempotency_key = $1',
        [idempotencyKey]
    );
    return result.rows[0] || null;
}

export async function getTriggersByTradeId(tradeId: string): Promise<Trigger[]> {
    const result = await pool.query(
        'SELECT * FROM oracle_triggers WHERE trade_id = $1 ORDER BY created_at DESC',
        [tradeId]
    );
    return result.rows;
}

export async function getTriggersByStatus(status: TriggerStatus, limit: number = 100): Promise<Trigger[]> {
    const result = await pool.query(
        'SELECT * FROM oracle_triggers WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
        [status, limit]
    );
    return result.rows;
}


export async function updateTrigger(triggerId: string, updates: UpdateTriggerData): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            fields.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }

    if (fields.length === 0) {
        Logger.warn('No fields to update', { triggerId });
        return;
    }

    fields.push('updated_at = NOW()');
    values.push(triggerId);

    const query = `
        UPDATE oracle_triggers 
        SET ${fields.join(', ')} 
        WHERE trigger_id = $${paramIndex}
    `;

    await pool.query(query, values);

    Logger.info('Trigger updated', { triggerId, fields: Object.keys(updates) });
}

export async function updateTriggerStatus(triggerId: string,status: TriggerStatus,metadata?: Partial<UpdateTriggerData>): Promise<void> {
    const updates: UpdateTriggerData = {
        status,
        ...metadata
    };

    if (status === TriggerStatus.SUBMITTED && !metadata?.submitted_at) {
        updates.submitted_at = new Date();
    }
    if (status === TriggerStatus.CONFIRMED && !metadata?.confirmed_at) {
        updates.confirmed_at = new Date();
    }

    await updateTrigger(triggerId, updates);
}
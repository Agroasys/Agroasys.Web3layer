import { Logger } from '../utils/logger';

const counters = {
    oracleExhaustedRetriesTotal: 0,
    oracleRedriveAttemptsTotal: 0,
};

export function incrementOracleExhaustedRetries(actionKey: string): void {
    counters.oracleExhaustedRetriesTotal += 1;
    Logger.warn('Metric increment', {
        metric: 'oracle_exhausted_retries_total',
        actionKey,
        value: counters.oracleExhaustedRetriesTotal,
    });
}

export function incrementOracleRedriveAttempts(actionKey: string): void {
    counters.oracleRedriveAttemptsTotal += 1;
    Logger.info('Metric increment', {
        metric: 'oracle_redrive_attempts_total',
        actionKey,
        value: counters.oracleRedriveAttemptsTotal,
    });
}

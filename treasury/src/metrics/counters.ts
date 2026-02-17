import { Logger } from '../utils/logger';

const counters = {
  authFailuresTotal: 0,
  replayRejectsTotal: 0,
};

export function incrementAuthFailure(reason: string): void {
  counters.authFailuresTotal += 1;
  Logger.warn('Metric increment', {
    metric: 'auth_failures_total',
    reason,
    value: counters.authFailuresTotal,
  });
}

export function incrementReplayReject(): void {
  counters.replayRejectsTotal += 1;
  Logger.warn('Metric increment', {
    metric: 'replay_rejects_total',
    value: counters.replayRejectsTotal,
  });
}

import { DriftSeverity } from '../types';
import { Logger } from '../utils/logger';

const counters = {
  reconciliationDriftClassificationsTotal: 0,
};

export function incrementDriftClassification(severity: DriftSeverity, mismatchCode: string): void {
  counters.reconciliationDriftClassificationsTotal += 1;
  Logger.info('Metric increment', {
    metric: 'reconciliation_drift_classifications_total',
    severity,
    mismatchCode,
    value: counters.reconciliationDriftClassificationsTotal,
  });
}

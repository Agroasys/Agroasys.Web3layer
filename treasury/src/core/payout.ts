import { PayoutState } from '../types';

const ALLOWED_TRANSITIONS: Record<PayoutState, PayoutState[]> = {
  PENDING_REVIEW: ['READY_FOR_PAYOUT', 'CANCELLED'],
  READY_FOR_PAYOUT: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

export function assertValidTransition(current: PayoutState, next: PayoutState): void {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid payout state transition: ${current} -> ${next}`);
  }
}

import {
  buildServiceAuthCanonicalString,
  createServiceAuthMiddleware as createSharedServiceAuthMiddleware,
  parseServiceApiKeys,
  signServiceAuthCanonicalString,
  type ServiceApiKey,
  type ServiceAuthContext,
  type ServiceAuthMiddlewareOptions,
} from '@agroasys/shared-auth/serviceAuth';
import { incrementAuthFailure, incrementReplayReject } from '../metrics/counters';

export {
  buildServiceAuthCanonicalString,
  parseServiceApiKeys,
  signServiceAuthCanonicalString,
  type ServiceApiKey,
  type ServiceAuthContext,
  type ServiceAuthMiddlewareOptions,
};

export function createServiceAuthMiddleware(options: ServiceAuthMiddlewareOptions) {
  return createSharedServiceAuthMiddleware({
    ...options,
    onAuthFailure: incrementAuthFailure,
    onReplayReject: incrementReplayReject,
  });
}

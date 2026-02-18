/**
 * SPDX-License-Identifier: Apache-2.0
 */
export interface RicardianHashRequest {
  requestId?: string;
  documentRef: string;
  terms: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RicardianHashRecord {
  id: number;
  requestId: string;
  documentRef: string;
  hash: string;
  rulesVersion: string;
  canonicalJson: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RicardianHashEnvelope {
  success: boolean;
  data?: RicardianHashRecord;
  error?: string;
}

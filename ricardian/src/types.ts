export const CANONICALIZATION_RULES_VERSION = 'RICARDIAN_CANONICAL_V1';

export interface RicardianHashRequest {
  requestId?: string;
  documentRef: string;
  terms: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RicardianHashResponse {
  id: number;
  requestId: string;
  documentRef: string;
  hash: string;
  rulesVersion: string;
  canonicalJson: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RicardianHashRow {
  id: number;
  request_id: string;
  document_ref: string;
  hash: string;
  rules_version: string;
  canonical_json: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

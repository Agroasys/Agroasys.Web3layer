import { Request, Response } from 'express';
import { buildRicardianHash } from '../utils/hash';
import { createRicardianHash, getRicardianHash } from '../database/queries';
import { RicardianHashRequest, RicardianHashResponse } from '../types';

function mapRowToResponse(row: any): RicardianHashResponse {
  return {
    id: row.id,
    requestId: row.request_id,
    documentRef: row.document_ref,
    hash: row.hash,
    rulesVersion: row.rules_version,
    canonicalJson: row.canonical_json,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  };
}

export class RicardianController {
  async createHash(req: Request<{}, {}, RicardianHashRequest>, res: Response): Promise<void> {
    const payload = req.body;

    let hashed;
    try {
      hashed = buildRicardianHash(payload);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error?.message || 'Invalid Ricardian payload',
      });
      return;
    }

    try {
      const row = await createRicardianHash({
        requestId: hashed.requestId,
        documentRef: hashed.documentRef,
        hash: hashed.hash,
        rulesVersion: hashed.rulesVersion,
        canonicalJson: hashed.canonicalJson,
        metadata: hashed.metadata,
      });

      res.status(200).json({
        success: true,
        data: mapRowToResponse(row),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to persist Ricardian hash',
      });
    }
  }

  async getHash(req: Request<{ hash: string }>, res: Response): Promise<void> {
    try {
      const hash = req.params.hash;

      if (!/^[a-f0-9]{64}$/i.test(hash)) {
        res.status(400).json({
          success: false,
          error: 'Invalid hash format',
        });
        return;
      }

      const row = await getRicardianHash(hash.toLowerCase());

      if (!row) {
        res.status(404).json({
          success: false,
          error: 'Hash not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: mapRowToResponse(row),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch Ricardian hash',
      });
    }
  }
}

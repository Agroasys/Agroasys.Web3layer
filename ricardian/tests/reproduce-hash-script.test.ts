import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { buildRicardianHash } from '../src/utils/hash';

describe('scripts/reproduce-ricardian-hash.mjs', () => {
  test('matches buildRicardianHash output for identical payload', () => {
    const payload = {
      documentRef: 'doc://trade-42',
      metadata: {
        jurisdiction: 'KE',
        tradeId: '42',
      },
      terms: {
        currency: 'USDC',
        quantityMt: 100,
        nested: {
          quality: 'A',
          tolerances: ['+/-2%'],
        },
      },
    };

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ricardian-repro-'));
    const payloadFile = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadFile, JSON.stringify(payload), 'utf8');

    const scriptPath = path.resolve(__dirname, '../../scripts/reproduce-ricardian-hash.mjs');
    const output = execFileSync(process.execPath, [scriptPath, '--payload-file', payloadFile], {
      encoding: 'utf8',
    });

    const parsed = JSON.parse(output) as {
      hash: string;
      canonicalJson: string;
      rulesVersion: string;
      documentRef: string;
    };
    const expected = buildRicardianHash(payload);

    expect(parsed.hash).toBe(expected.hash);
    expect(parsed.canonicalJson).toBe(expected.canonicalJson);
    expect(parsed.rulesVersion).toBe(expected.rulesVersion);
    expect(parsed.documentRef).toBe(expected.documentRef);
  });
});

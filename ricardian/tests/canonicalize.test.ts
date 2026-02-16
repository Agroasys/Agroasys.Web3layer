import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { CANONICALIZATION_RULES_VERSION } from '../src/types';
import { buildRicardianHash } from '../src/utils/hash';

interface TestVector {
  name: string;
  input: {
    documentRef: string;
    terms: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  expectedCanonicalJson: string;
}

function expectedHashFromCanonical(canonicalJson: string): string {
  return createHash('sha256')
    .update(`${CANONICALIZATION_RULES_VERSION}:${canonicalJson}`)
    .digest('hex');
}

describe('Ricardian deterministic hash vectors', () => {
  const vectorsPath = path.resolve(__dirname, 'vectors.json');
  const vectors = JSON.parse(fs.readFileSync(vectorsPath, 'utf8')) as TestVector[];

  for (const vector of vectors) {
    test(vector.name, () => {
      const result = buildRicardianHash(vector.input);

      expect(result.rulesVersion).toBe(CANONICALIZATION_RULES_VERSION);
      expect(result.canonicalJson).toBe(vector.expectedCanonicalJson);
      expect(result.hash).toBe(expectedHashFromCanonical(vector.expectedCanonicalJson));
    });
  }

  test('same semantic payload with different key order yields same hash', () => {
    const payloadA = {
      documentRef: 'doc://same',
      metadata: { b: 2, a: 1 },
      terms: {
        y: 'two',
        x: 'one',
      },
    };

    const payloadB = {
      documentRef: 'doc://same',
      metadata: { a: 1, b: 2 },
      terms: {
        x: 'one',
        y: 'two',
      },
    };

    const resultA = buildRicardianHash(payloadA);
    const resultB = buildRicardianHash(payloadB);

    expect(resultA.canonicalJson).toBe(resultB.canonicalJson);
    expect(resultA.hash).toBe(resultB.hash);
  });

  test('preserves __proto__ key as canonical data field', () => {
    const payloadWithProto = {
      documentRef: 'doc://proto',
      terms: JSON.parse('{"amount":1,"__proto__":{"polluted":true}}') as Record<string, unknown>,
      metadata: {},
    };

    const payloadWithoutProto = {
      documentRef: 'doc://proto',
      terms: { amount: 1 },
      metadata: {},
    };

    const withProto = buildRicardianHash(payloadWithProto);
    const withoutProto = buildRicardianHash(payloadWithoutProto);

    expect(withProto.canonicalJson).toContain('"__proto__"');
    expect(withProto.canonicalJson).not.toBe(withoutProto.canonicalJson);
    expect(withProto.hash).not.toBe(withoutProto.hash);
  });
});

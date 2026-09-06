import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadStrictRuntimeEnv, parseStrictEnv } from '../lib/strict-runtime-env.mjs';

test('parses literal quoted values without executing shell syntax', () => {
  const values = parseStrictEnv("NETWORK='Base Sepolia'\nLITERAL='$HOME'\n", 'fixture');
  assert.equal(values.get('NETWORK'), 'Base Sepolia');
  assert.equal(values.get('LITERAL'), '$HOME');
});

test('rejects duplicate, executable, and ambiguous values', () => {
  assert.throws(() => parseStrictEnv('A=one\nA=two\n', 'fixture'), /duplicate environment key A/);
  assert.throws(() => parseStrictEnv('export A=one\n', 'fixture'), /export syntax is not allowed/);
  assert.throws(() => parseStrictEnv('A=$(touch owned)\n', 'fixture'), /whitespace must be quoted/);
  assert.throws(() => parseStrictEnv('A=${OTHER}\n', 'fixture'), /expansion syntax is not allowed/);
  assert.throws(() => parseStrictEnv('A=two words\n', 'fixture'), /whitespace must be quoted/);
});

test('rejects unknown keys and inherited configuration overrides', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'cotsel-strict-env-'));
  const schemaFile = path.join(directory, 'schema.env');
  const envFile = path.join(directory, 'runtime.env');
  writeFileSync(schemaFile, 'KNOWN=\n');
  writeFileSync(envFile, 'UNKNOWN=value\n');
  assert.throws(
    () => loadStrictRuntimeEnv({ envFile, schemaFile, inheritedEnv: {} }),
    /unknown environment key UNKNOWN/,
  );

  writeFileSync(schemaFile, 'KNOWN=\nREQUIRED_EVEN_WHEN_EMPTY=\n');
  writeFileSync(envFile, 'KNOWN=file-value\n');
  assert.throws(
    () =>
      loadStrictRuntimeEnv({
        envFile,
        schemaFile,
        inheritedEnv: { REQUIRED_EVEN_WHEN_EMPTY: 'ambient-value' },
      }),
    /missing environment key REQUIRED_EVEN_WHEN_EMPTY/,
  );

  writeFileSync(schemaFile, 'KNOWN=\n');
  writeFileSync(envFile, 'KNOWN=file-value\n');
  assert.throws(
    () => loadStrictRuntimeEnv({ envFile, schemaFile, inheritedEnv: { KNOWN: 'ambient-value' } }),
    /inherited override for KNOWN is prohibited/,
  );

  assert.doesNotThrow(() =>
    loadStrictRuntimeEnv({ envFile, schemaFile, inheritedEnv: { KNOWN: 'file-value' } }),
  );
});

test('produces a deterministic digest from redacted configuration', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'cotsel-config-digest-'));
  const schemaFile = path.join(directory, 'schema.env');
  const envFile = path.join(directory, 'runtime.env');
  writeFileSync(schemaFile, 'MODE=\nAPI_SECRET=\n');
  writeFileSync(envFile, 'MODE=staging\nAPI_SECRET=first-secret\n');
  const first = loadStrictRuntimeEnv({ envFile, schemaFile, inheritedEnv: {} });

  writeFileSync(envFile, 'API_SECRET=rotated-secret\nMODE=staging\n');
  const reorderedAndRotated = loadStrictRuntimeEnv({ envFile, schemaFile, inheritedEnv: {} });
  assert.equal(first.redactedConfigSha256, reorderedAndRotated.redactedConfigSha256);

  writeFileSync(envFile, 'MODE=production\nAPI_SECRET=rotated-secret\n');
  const changedPublicConfig = loadStrictRuntimeEnv({ envFile, schemaFile, inheritedEnv: {} });
  assert.notEqual(first.redactedConfigSha256, changedPublicConfig.redactedConfigSha256);
});

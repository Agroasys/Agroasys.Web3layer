import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function loadGateScript(): string {
  const gatePath = path.resolve(__dirname, '../../../scripts/staging-e2e-real-gate.sh');
  return fs.readFileSync(gatePath, 'utf8');
}

test('staging-e2e-real gate captures reconciliation run summary output', () => {
  const script = loadGateScript();

  assert.match(script, /reconciliation run summary:/);
  assert.match(script, /SELECT status \|\| ',' \|\| total_trades \|\| ',' \|\| drift_count FROM reconcile_runs/);
});

test('staging-e2e-real gate captures drift classification snapshot output', () => {
  const script = loadGateScript();

  assert.match(script, /drift classification snapshot:/);
  assert.match(script, /SELECT mismatch_code \|\| ':' \|\| COUNT\(\*\) FROM reconcile_drifts/);
});

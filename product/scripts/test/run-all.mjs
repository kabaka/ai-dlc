#!/usr/bin/env node
// run-all.mjs — single entry point for the design-QA tooling test suite.
//
// Runs each test module as a child (so a process.exit in one cannot truncate
// the others) and aggregates a final PASS/FAIL. Exit non-zero if any suite
// failed. This is the runner CI / pre-flight invokes:
//
//   node product/scripts/test/run-all.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUITES = [
  'lib-binding.test.mjs',
  'stdlib-tools.test.mjs',
  'app-exec-harness.attack.test.mjs',
];

let failed = 0;
for (const suite of SUITES) {
  process.stdout.write(`\n########## ${suite} ##########\n`);
  const r = spawnSync(process.execPath, [join(__dirname, suite)], {
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 120000,
  });
  if (r.status !== 0) {
    failed++;
    process.stdout.write(`########## ${suite}: FAILED (exit ${r.status}) ##########\n`);
  }
}

process.stdout.write('\n==================================================\n');
if (failed === 0) {
  process.stdout.write(`ALL ${SUITES.length} SUITES GREEN\n`);
  process.exit(0);
} else {
  process.stdout.write(`${failed}/${SUITES.length} SUITES FAILED\n`);
  process.exit(1);
}

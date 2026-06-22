// stdlib-tools.test.mjs — REAL fixture runs asserting exact exit codes for the
// three exec-free visual-QA tools: good→0, findings→1, malformed→2, absent→3.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, assertEqual, assertMatch, runTool, report } from './_harness.mjs';
import {
  makeTempRoot, cleanup,
  contrastGood, contrastFindings, contrastMalformed, contrastAbsent,
  coverageGood, coverageFindings, coverageMalformed, coverageAbsent,
  changelogGood, changelogFindings, changelogAbsent,
} from './_fixtures.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(__dirname, '..', 'visual-qa');
const CONTRAST = join(SCRIPTS, 'contrast-check.mjs');
const COVERAGE = join(SCRIPTS, 'patch-coverage.mjs');
const CHANGELOG = join(SCRIPTS, 'changelog-check.mjs');

const base = makeTempRoot();

describe('contrast-check', () => {
  it('good fixture → PASS (0)', () => {
    const r = runTool(CONTRAST, ['--repo', contrastGood(base)]);
    assertEqual(r.code, 0, 'exit');
    assertMatch(r.stdout, /^PASS:/m, 'PASS line');
  });
  it('findings fixture → FINDINGS (1)', () => {
    const r = runTool(CONTRAST, ['--repo', contrastFindings(base)]);
    assertEqual(r.code, 1, 'exit');
    assertMatch(r.stdout, /^FINDINGS:/m, 'FINDINGS line');
  });
  it('malformed (bad color) → ERROR (2)', () => {
    const r = runTool(CONTRAST, ['--repo', contrastMalformed(base)]);
    assertEqual(r.code, 2, 'exit');
    assertMatch(r.stderr, /^ERROR:/m, 'ERROR line');
  });
  it('absent (no token_pairs) → SKIPPED (3)', () => {
    const r = runTool(CONTRAST, ['--repo', contrastAbsent(base)]);
    assertEqual(r.code, 3, 'exit');
    assertMatch(r.stdout, /^SKIPPED:/m, 'SKIPPED line');
  });
});

describe('patch-coverage', () => {
  it('good fixture → PASS (0)', () => {
    const repo = coverageGood(base);
    const r = runTool(COVERAGE, ['--repo', repo, '--coverage', 'cov.info', '--diff', 'changes.diff']);
    assertEqual(r.code, 0, 'exit');
    assertMatch(r.stdout, /^PASS:/m, 'PASS line');
  });
  it('findings fixture → FINDINGS (1)', () => {
    const repo = coverageFindings(base);
    const r = runTool(COVERAGE, ['--repo', repo, '--coverage', 'cov.info', '--diff', 'changes.diff']);
    assertEqual(r.code, 1, 'exit');
    assertMatch(r.stdout, /^FINDINGS:/m, 'FINDINGS line');
  });
  it('malformed coverage json → ERROR (2)', () => {
    const repo = coverageMalformed(base);
    const r = runTool(COVERAGE, ['--repo', repo, '--coverage', 'cov.json', '--diff', 'changes.diff']);
    assertEqual(r.code, 2, 'exit');
    assertMatch(r.stderr, /^ERROR:/m, 'ERROR line');
  });
  it('absent (no inputs) → SKIPPED (3)', () => {
    const repo = coverageAbsent(base);
    const r = runTool(COVERAGE, ['--repo', repo]);
    assertEqual(r.code, 3, 'exit');
    assertMatch(r.stdout, /^SKIPPED:/m, 'SKIPPED line');
  });
});

describe('changelog-check', () => {
  it('good fixture → PASS (0)', () => {
    const repo = changelogGood(base);
    const r = runTool(CHANGELOG, ['--repo', repo, '--commits', 'abc123,def456']);
    assertEqual(r.code, 0, 'exit');
    assertMatch(r.stdout, /^PASS:/m, 'PASS line');
  });
  it('findings (empty Unreleased) → FINDINGS (1)', () => {
    const repo = changelogFindings(base);
    const r = runTool(CHANGELOG, ['--repo', repo, '--commits', 'abc123']);
    assertEqual(r.code, 1, 'exit');
    assertMatch(r.stdout, /^FINDINGS:/m, 'FINDINGS line');
  });
  it('malformed (bad arg) → ERROR (2)', () => {
    const repo = changelogGood(base);
    const r = runTool(CHANGELOG, ['--repo', repo, '--bogus']);
    assertEqual(r.code, 2, 'exit');
    assertMatch(r.stderr, /^ERROR:/m, 'ERROR line');
  });
  it('absent (no commits) → SKIPPED (3)', () => {
    const repo = changelogAbsent(base);
    const r = runTool(CHANGELOG, ['--repo', repo]);
    assertEqual(r.code, 3, 'exit');
    assertMatch(r.stdout, /^SKIPPED:/m, 'SKIPPED line');
  });
});

await report();
cleanup(base);

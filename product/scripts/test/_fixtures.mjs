// _fixtures.mjs — build real on-disk fixture repos in a temp dir for the
// stdlib-tool tests. Each builder returns the absolute repo root. The caller is
// responsible for removing the temp tree (we mkdtemp under os.tmpdir()).

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTempRoot() {
  return mkdtempSync(join(tmpdir(), 'aidlc-fix-'));
}

export function cleanup(root) {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeBinding(repo, obj) {
  mkdirSync(join(repo, '.ai-dlc'), { recursive: true });
  writeFileSync(join(repo, '.ai-dlc', 'stack-binding.json'), JSON.stringify(obj, null, 2));
}

function write(repo, rel, content) {
  const full = join(repo, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

// ---- contrast-check fixtures -------------------------------------------
export function contrastGood(base) {
  const repo = join(base, 'contrast-good');
  mkdirSync(repo, { recursive: true });
  write(repo, 'tokens/t.json', JSON.stringify({
    color: { ink: { $value: '#000000' }, paper: { $value: '#ffffff' } },
  }));
  writeBinding(repo, {
    surface: 'web',
    token_source: 'tokens/t.json',
    token_pairs: [{ label: 'body', fg: '{color.ink}', bg: '{color.paper}' }],
  });
  return repo;
}

export function contrastFindings(base) {
  const repo = join(base, 'contrast-findings');
  mkdirSync(repo, { recursive: true });
  writeBinding(repo, {
    surface: 'web',
    // light grey on white — well below 4.5:1
    token_pairs: [{ label: 'low', fg: '#bbbbbb', bg: '#ffffff' }],
  });
  return repo;
}

export function contrastMalformed(base) {
  const repo = join(base, 'contrast-malformed');
  mkdirSync(repo, { recursive: true });
  writeBinding(repo, {
    surface: 'web',
    token_pairs: [{ label: 'bad', fg: 'not-a-color', bg: '#ffffff' }],
  });
  return repo;
}

export function contrastAbsent(base) {
  const repo = join(base, 'contrast-absent');
  mkdirSync(repo, { recursive: true });
  writeBinding(repo, { surface: 'web' }); // no token_pairs → SKIPPED
  return repo;
}

// ---- patch-coverage fixtures -------------------------------------------
export function coverageGood(base) {
  const repo = join(base, 'coverage-good');
  mkdirSync(repo, { recursive: true });
  // diff adds lines 1-3 of src/a.js; lcov covers them with hits>0.
  write(repo, 'changes.diff', [
    'diff --git a/src/a.js b/src/a.js',
    '--- /dev/null',
    '+++ b/src/a.js',
    '@@ -0,0 +1,3 @@',
    '+const a = 1;',
    '+const b = 2;',
    '+export default a + b;',
    '',
  ].join('\n'));
  write(repo, 'cov.info', [
    'SF:src/a.js',
    'DA:1,5',
    'DA:2,5',
    'DA:3,5',
    'end_of_record',
    '',
  ].join('\n'));
  return repo;
}

export function coverageFindings(base) {
  const repo = join(base, 'coverage-findings');
  mkdirSync(repo, { recursive: true });
  write(repo, 'changes.diff', [
    'diff --git a/src/a.js b/src/a.js',
    '--- /dev/null',
    '+++ b/src/a.js',
    '@@ -0,0 +1,3 @@',
    '+const a = 1;',
    '+const b = 2;',
    '+export default a + b;',
    '',
  ].join('\n'));
  // line 1 covered, lines 2 & 3 NOT covered (hits 0) → 33% < 80%
  write(repo, 'cov.info', [
    'SF:src/a.js',
    'DA:1,5',
    'DA:2,0',
    'DA:3,0',
    'end_of_record',
    '',
  ].join('\n'));
  return repo;
}

export function coverageMalformed(base) {
  const repo = join(base, 'coverage-malformed');
  mkdirSync(repo, { recursive: true });
  write(repo, 'changes.diff', '+++ b/src/a.js\n@@ -0,0 +1,1 @@\n+x\n');
  write(repo, 'cov.json', '{ this is not json');
  return repo;
}

export function coverageAbsent(base) {
  const repo = join(base, 'coverage-absent');
  mkdirSync(repo, { recursive: true });
  return repo; // no args, no binding → SKIPPED
}

// ---- changelog-check fixtures ------------------------------------------
export function changelogGood(base) {
  const repo = join(base, 'changelog-good');
  mkdirSync(repo, { recursive: true });
  write(repo, 'CHANGELOG.md', [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '- New contrast checker.',
    '',
    '## [1.0.0] - 2026-01-01',
    '- Initial.',
    '',
  ].join('\n'));
  return repo;
}

export function changelogFindings(base) {
  const repo = join(base, 'changelog-findings');
  mkdirSync(repo, { recursive: true });
  write(repo, 'CHANGELOG.md', [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '## [1.0.0] - 2026-01-01',
    '- Initial.',
    '',
  ].join('\n')); // Unreleased present but EMPTY
  return repo;
}

export function changelogAbsent(base) {
  const repo = join(base, 'changelog-absent');
  mkdirSync(repo, { recursive: true });
  // changelog exists but no commits supplied → SKIPPED
  write(repo, 'CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n- x\n');
  return repo;
}

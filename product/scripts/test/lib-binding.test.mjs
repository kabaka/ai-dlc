// lib-binding.test.mjs — unit tests for the shared hardened primitives,
// focused on the WRITE-path containment extension and the canonical hash.

import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, assert, assertEqual, report } from './_harness.mjs';
import {
  resolveContained, ToolError, sha256Canonical, canonicalize, isContained,
} from '../lib/binding.mjs';

const base = mkdtempSync(join(tmpdir(), 'aidlc-lib-'));

describe('resolveContained — read mode (parity with off-token-lint)', () => {
  it('rejects ../ traversal', () => {
    let threw = false;
    try { resolveContained(base, '../../etc/hostname', 'p', 'read'); }
    catch (e) { threw = e instanceof ToolError; }
    assert(threw, 'traversal must throw ToolError');
  });
  it('rejects absolute path', () => {
    let threw = false;
    try { resolveContained(base, '/etc/hostname', 'p', 'read'); }
    catch (e) { threw = e instanceof ToolError; }
    assert(threw, 'absolute must throw');
  });
  it('rejects NUL byte', () => {
    let threw = false;
    try { resolveContained(base, 'a' + String.fromCharCode(0) + 'b', 'p', 'read'); }
    catch (e) { threw = e instanceof ToolError; }
    assert(threw, 'NUL must throw');
  });
  it('accepts a contained relative path', () => {
    const p = resolveContained(base, 'sub/x.json', 'p', 'read');
    assert(p.startsWith(base), 'resolved inside root');
  });
});

describe('resolveContained — WRITE mode (the new extension)', () => {
  it('rejects a write target escaping via ..', () => {
    let threw = false;
    try { resolveContained(base, '../../../tmp/evil', 'out', 'write'); }
    catch (e) { threw = e instanceof ToolError; }
    assert(threw, 'write escape must throw');
  });
  it('accepts a contained non-existent write target (final component need not exist)', () => {
    const p = resolveContained(base, 'newdir/fresh-output', 'out', 'write');
    assert(p.startsWith(base), 'contained write target allowed');
  });
  it('rejects a write target under a symlinked parent that escapes the repo', () => {
    const evilTarget = mkdtempSync(join(tmpdir(), 'aidlc-evil-'));
    const linkDir = join(base, 'escaped-parent');
    let threw = false;
    try {
      symlinkSync(evilTarget, linkDir);
    } catch {
      // symlink unsupported on this platform — skip the assertion gracefully.
      return;
    }
    try { resolveContained(base, 'escaped-parent/child', 'out', 'write'); }
    catch (e) { threw = e instanceof ToolError; }
    assert(threw, 'symlinked-parent escape must throw');
  });
});

describe('canonical hash', () => {
  it('is order-independent over object keys', () => {
    const a = sha256Canonical({ x: 1, y: [2, 3], z: { b: 1, a: 2 } });
    const b = sha256Canonical({ z: { a: 2, b: 1 }, y: [2, 3], x: 1 });
    assertEqual(a, b, 'key order must not change the hash');
  });
  it('is order-DEPENDENT over arrays', () => {
    assert(sha256Canonical([1, 2]) !== sha256Canonical([2, 1]), 'array order matters');
  });
  it('distinguishes a missing field from a null field via canonicalize', () => {
    assert(canonicalize({ a: null }) !== canonicalize({}), 'null vs absent differ');
  });
});

describe('isContained', () => {
  it('treats the root itself as contained', () => {
    assert(isContained('/repo', '/repo'));
  });
  it('rejects a sibling prefix (/repo-evil)', () => {
    assert(!isContained('/repo', '/repo-evil/x'), 'prefix-but-not-subdir must be rejected');
  });
});

await report();
rmSync(base, { recursive: true, force: true });

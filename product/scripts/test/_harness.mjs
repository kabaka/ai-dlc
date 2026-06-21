// _harness.mjs — a tiny zero-dependency test harness for the design-QA tools.
//
// Provides describe/it/assert + a runner that tallies pass/fail and exits
// non-zero on any failure. Also a `runTool` helper that executes one of the
// .mjs tools as a child and captures { code, stdout, stderr } — used to assert
// exact exit codes for the stdlib tools.

import { spawnSync } from 'node:child_process';

const results = [];
const pending = []; // queued test thunks (sync + async), run by report()
let current = '(top)';

export function describe(name, fn) {
  const prev = current;
  current = name;
  fn();
  current = prev;
}

// Register a test. The thunk is NOT run now — it is queued and executed
// sequentially by report(), which awaits each one. This makes async tests
// (returning a promise) work without the test file having to await every it().
export function it(name, fn) {
  const label = `${current} › ${name}`;
  pending.push(async () => {
    try {
      await fn();
      results.push({ label, ok: true });
    } catch (e) {
      results.push({ label, ok: false, error: e });
    }
  });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'not equal'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertMatch(text, re, msg) {
  if (!re.test(text)) throw new Error(`${msg || 'no match'}: ${re} not found in ${JSON.stringify(text)}`);
}

export function assertNotMatch(text, re, msg) {
  if (re.test(text)) throw new Error(`${msg || 'unexpected match'}: ${re} present in ${JSON.stringify(text)}`);
}

// Run a tool script as a child; returns { code, stdout, stderr }.
export function runTool(scriptPath, args, opts = {}) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 30000,
    env: opts.env || process.env,
    cwd: opts.cwd,
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', signal: r.signal };
}

export async function report() {
  // Execute all queued tests sequentially (awaiting async ones) before tallying.
  for (const thunk of pending) {
    await thunk();
  }
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}\n`);
    if (!r.ok) process.stdout.write(`        ${r.error && r.error.message}\n`);
  }
  process.stdout.write(`\n${results.length - failed.length}/${results.length} assertions passed\n`);
  if (failed.length > 0) {
    process.stdout.write(`${failed.length} FAILED\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('ALL GREEN\n');
  }
}

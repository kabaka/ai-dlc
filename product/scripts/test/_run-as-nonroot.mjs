#!/usr/bin/env node
// _run-as-nonroot.mjs — LOCAL test scaffolding. The app-exec harness correctly
// REFUSES to launch as root (uid 0) — that R5 defense is real and unconditional
// in production (process.getuid is used; there is no env/flag override). This
// repo's container happens to run as root, so to exercise the REAL chromium
// smoke test (which performs a real harness-gated launch) we must run the test
// process as a NON-root uid.
//
// This launcher, when invoked as root, drops privileges to a non-root uid (the
// `nobody` account, uid 65534, by default) via setgid/setuid and then re-execs
// the smoke test as that user. If already non-root, it just runs the test. It is
// NOT shipped to consumers and NOT part of the Tier-1 CI suite — it only makes
// the local Tier-2 smoke test runnable inside a root dev container.
//
// Run:  node product/scripts/test/_run-as-nonroot.mjs [test-file]
//        (defaults to test/browser-tools.smoke.mjs)

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.argv[2])
  : join(__dirname, 'browser-tools.smoke.mjs');

const DROP_UID = Number(process.env.SMOKE_UID || 65534); // nobody
const DROP_GID = Number(process.env.SMOKE_GID || 65534);

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

if (!isRoot) {
  // Already non-root — run the test directly in-process semantics via a child.
  const r = spawnSync(process.execPath, [target], { stdio: 'inherit', env: process.env });
  process.exit(r.status === null ? 1 : r.status);
}

// Root: drop to the non-root uid for the CHILD only, so the harness's root
// refusal does not fire and temp dirs are owned by the dropped user.
// A writable HOME/TMPDIR the dropped user can use:
const childEnv = { ...process.env, HOME: tmpdir(), TMPDIR: tmpdir() };

const r = spawnSync(process.execPath, [target], {
  stdio: 'inherit',
  env: childEnv,
  uid: DROP_UID,
  gid: DROP_GID,
});

if (r.error) {
  process.stderr.write(`failed to run smoke test as uid ${DROP_UID}: ${r.error.message}\n`);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);

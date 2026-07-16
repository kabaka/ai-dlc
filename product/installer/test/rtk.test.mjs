// Behavioral tests for the OPT-IN rtk (Rust Token Killer) installer wiring.
//
// These run the real CLI (bin/ai-dlc.mjs) against throwaway temp repos via
// spawnSync — the same materialize-and-assert style as run-shipped-tools.test.mjs
// — and assert the end-to-end contract: default install is unchanged, --with-rtk
// lands the files/hook/manifest block, env is equivalent, re-runs are idempotent,
// `update` preserves the choice, --without-rtk removes ONLY rtk (arbiter and a
// planted consumer hook survive), and --dry-run writes nothing.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "..", "bin", "ai-dlc.mjs");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const repos = [];
function freshRepo() {
  const r = mkdtempSync(join(tmpdir(), "aidlc-rtk-test-"));
  repos.push(r);
  return r;
}

/** Run the installer CLI against `repo`. Returns { status, out }. */
function cli(repo, args = [], env = {}) {
  const res = spawnSync(process.execPath, [CLI, ...args, "--repo", repo], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: res.status, out: (res.stdout || "") + (res.stderr || "") };
}

const RTK_WRAP = ".ai-dlc/hooks/rtk-wrap.sh";
const RTK_INSTALL = ".ai-dlc/rtk/install-rtk.sh";
const RTK_MD = ".ai-dlc/rtk/RTK.md";
const RTK_FILES = [RTK_WRAP, RTK_INSTALL, RTK_MD];
const SETTINGS = ".claude/settings.json";
const MANIFEST = ".ai-dlc/manifest.json";

const has = (repo, rel) => existsSync(join(repo, rel));
const readJson = (repo, rel) => JSON.parse(readFileSync(join(repo, rel), "utf8"));
function preHooks(repo) {
  const s = readJson(repo, SETTINGS);
  return s?.hooks?.PreToolUse ?? [];
}
function commandsIn(pre) {
  const cmds = [];
  for (const block of pre) {
    for (const h of block?.hooks ?? []) if (h?.command) cmds.push(h.command);
  }
  return cmds;
}
const hasArbiter = (repo) =>
  commandsIn(preHooks(repo)).some((c) => c.includes("arbiter-gate.sh"));
const hasRtkHook = (repo) =>
  commandsIn(preHooks(repo)).some((c) => c.includes("rtk-wrap.sh"));

// --- 1. Default init: zero rtk footprint, arbiter still wired ---------------
test("default init lands no rtk files, no rtk hook, no manifest rtk block", () => {
  const repo = freshRepo();
  const { status } = cli(repo, ["init"]);
  assert.equal(status, 0, "default init should succeed");
  for (const f of RTK_FILES) {
    assert.ok(!has(repo, f), `default init must NOT land ${f}`);
  }
  assert.ok(!hasRtkHook(repo), "default init must NOT wire the rtk hook");
  assert.ok(hasArbiter(repo), "default init MUST still wire the arbiter hook");
  const manifest = readJson(repo, MANIFEST);
  // The invariant is stronger than "not enabled": a default install writes NO rtk
  // block at all, keeping the default manifest byte-for-byte unchanged.
  assert.ok(!manifest.rtk, "default manifest must have NO rtk block whatsoever");
});

// --- 2. init --with-rtk: files (0755), hook, manifest, arbiter intact -------
test("init --with-rtk lands files (0755), wires the hook, stamps manifest", () => {
  const repo = freshRepo();
  const { status } = cli(repo, ["init", "--with-rtk"]);
  assert.equal(status, 0, "init --with-rtk should succeed");
  for (const f of RTK_FILES) assert.ok(has(repo, f), `--with-rtk must land ${f}`);

  // The two shell scripts must be mode 0755.
  for (const sh of [RTK_WRAP, RTK_INSTALL]) {
    const mode = statSync(join(repo, sh)).mode & 0o777;
    assert.equal(mode, 0o755, `${sh} must be 0755; got ${mode.toString(8)}`);
  }

  assert.ok(hasRtkHook(repo), "--with-rtk must wire the rtk hook");
  assert.ok(hasArbiter(repo), "arbiter hook must remain present with rtk");

  const manifest = readJson(repo, MANIFEST);
  assert.equal(manifest.rtk?.enabled, true, "manifest rtk.enabled must be true");
  assert.equal(manifest.rtk?.version, "v0.43.0", "manifest rtk.version must be v0.43.0");
});

// --- 3. AIDLC_INSTALL_RTK=1 init (no flag) == --with-rtk --------------------
// Install-time env-equivalence lives on AIDLC_INSTALL_RTK (the dedicated install
// signal), NOT AIDLC_ENABLE_RTK (the runtime activation gate).
test("AIDLC_INSTALL_RTK=1 init is equivalent to --with-rtk", () => {
  const repo = freshRepo();
  const { status } = cli(repo, ["init"], { AIDLC_INSTALL_RTK: "1" });
  assert.equal(status, 0, "install-env init should succeed");
  for (const f of RTK_FILES) assert.ok(has(repo, f), `install-env init must land ${f}`);
  assert.ok(hasRtkHook(repo), "install-env init must wire the rtk hook");
  assert.equal(readJson(repo, MANIFEST).rtk?.enabled, true);
});

// --- 4. Idempotence: re-running --with-rtk does not duplicate ---------------
test("re-running init --with-rtk does not duplicate the rtk hook", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const before = commandsIn(preHooks(repo)).filter((c) => c.includes("rtk-wrap.sh"));
  assert.equal(before.length, 1, "first run wires exactly one rtk hook");

  const second = cli(repo, ["init", "--with-rtk"]);
  assert.equal(second.status, 0, "second run should succeed");
  const after = commandsIn(preHooks(repo)).filter((c) => c.includes("rtk-wrap.sh"));
  assert.equal(after.length, 1, "second run must NOT duplicate the rtk hook");
  // Unchanged files report as noop/unchanged, not re-created.
  assert.ok(
    /unchanged|no file changes/.test(second.out),
    `idempotent re-run should report unchanged files:\n${second.out}`
  );
});

// --- 5. update stability: plain update after --with-rtk KEEPS rtk -----------
test("plain update after init --with-rtk keeps rtk (manifest-driven)", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const upd = cli(repo, ["update"]); // NO flag
  assert.equal(upd.status, 0, "plain update should succeed");
  for (const f of RTK_FILES) assert.ok(has(repo, f), `update must KEEP ${f}`);
  assert.ok(hasRtkHook(repo), "update must keep the rtk hook");
  assert.equal(readJson(repo, MANIFEST).rtk?.enabled, true, "update keeps rtk.enabled");
});

// --- 6. --without-rtk removes rtk only; arbiter + consumer hook survive -----
test("--without-rtk removes rtk hook+files, keeps arbiter and a planted consumer hook", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  assert.ok(hasRtkHook(repo) && RTK_FILES.every((f) => has(repo, f)));

  // Plant a consumer-authored PreToolUse hook BEFORE disabling.
  const settings = readJson(repo, SETTINGS);
  const consumerCmd = 'bash "${CLAUDE_PROJECT_DIR}/.mine/consumer-hook.sh"';
  settings.hooks.PreToolUse.push({
    matcher: "Bash",
    hooks: [{ type: "command", command: consumerCmd, timeout: 10 }],
  });
  writeFileSync(join(repo, SETTINGS), JSON.stringify(settings, null, 2) + "\n");

  const off = cli(repo, ["update", "--without-rtk"]);
  assert.equal(off.status, 0, "--without-rtk should succeed");

  // rtk removed.
  for (const f of RTK_FILES) assert.ok(!has(repo, f), `--without-rtk must remove ${f}`);
  assert.ok(!hasRtkHook(repo), "--without-rtk must remove the rtk hook");

  // Everything else preserved.
  assert.ok(hasArbiter(repo), "arbiter hook must survive --without-rtk");
  assert.ok(
    commandsIn(preHooks(repo)).includes(consumerCmd),
    "planted consumer hook must survive untouched"
  );

  // Manifest rtk.enabled cleared, and rtk file stamps dropped.
  const manifest = readJson(repo, MANIFEST);
  assert.ok(!manifest.rtk?.enabled, "manifest rtk.enabled must be cleared");
  for (const f of RTK_FILES) {
    assert.ok(!manifest.files[f], `manifest stamp for ${f} must be dropped`);
  }
});

// --- 6b. Sticky removal: a runtime env var must NOT re-install/re-activate ---
// Regression guard for the install-vs-runtime decoupling. After an explicit
// --without-rtk (which persists a STICKY enabled:false), a later plain `update`
// with AIDLC_INSTALL_RTK UNSET but AIDLC_ENABLE_RTK=1 set (the RUNTIME gate) must
// NOT re-create rtk files or re-wire the hook. Only --with-rtk / AIDLC_INSTALL_RTK
// re-enables.
test("sticky --without-rtk: AIDLC_ENABLE_RTK=1 update does NOT re-install rtk", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const off = cli(repo, ["update", "--without-rtk"]);
  assert.equal(off.status, 0, "--without-rtk should succeed");
  assert.ok(!hasRtkHook(repo) && RTK_FILES.every((f) => !has(repo, f)), "rtk removed");
  assert.equal(readJson(repo, MANIFEST).rtk?.enabled, false, "manifest sticky enabled:false");

  // Runtime gate set, install signal UNSET: must stay disabled.
  const upd = cli(repo, ["update"], { AIDLC_ENABLE_RTK: "1" });
  assert.equal(upd.status, 0, "update should succeed");
  for (const f of RTK_FILES) {
    assert.ok(!has(repo, f), `AIDLC_ENABLE_RTK must NOT re-create ${f}`);
  }
  assert.ok(!hasRtkHook(repo), "AIDLC_ENABLE_RTK must NOT re-wire the rtk hook");
  assert.equal(
    readJson(repo, MANIFEST).rtk?.enabled,
    false,
    "manifest must stay enabled:false — no env var flips a sticky removal"
  );
});

// --- 6c. AIDLC_INSTALL_RTK=1 DOES re-enable after a sticky removal -----------
// The escape hatch: the dedicated INSTALL signal (unlike the runtime gate) is an
// explicit opt-in equivalent to --with-rtk, so it re-installs even over sticky OFF.
test("AIDLC_INSTALL_RTK=1 re-enables rtk after a sticky --without-rtk", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  cli(repo, ["update", "--without-rtk"]);
  const on = cli(repo, ["update"], { AIDLC_INSTALL_RTK: "1" });
  assert.equal(on.status, 0, "install-env update should succeed");
  for (const f of RTK_FILES) assert.ok(has(repo, f), `AIDLC_INSTALL_RTK must re-land ${f}`);
  assert.ok(hasRtkHook(repo), "AIDLC_INSTALL_RTK must re-wire the rtk hook");
  assert.equal(readJson(repo, MANIFEST).rtk?.enabled, true, "manifest re-enabled");
});

// --- 7. Dry run writes nothing ---------------------------------------------
test("init --with-rtk --dry-run writes nothing", () => {
  const repo = freshRepo();
  const { status, out } = cli(repo, ["init", "--with-rtk", "--dry-run"]);
  assert.equal(status, 0, "dry-run should succeed");
  for (const f of RTK_FILES) assert.ok(!has(repo, f), `dry-run must not write ${f}`);
  assert.ok(!has(repo, MANIFEST), "dry-run must not write the manifest");
  assert.ok(!has(repo, SETTINGS), "dry-run must not write settings.json");
  assert.ok(/nothing was written/.test(out), "dry-run should say nothing was written");
});

// --- Run --------------------------------------------------------------------
let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}\n        ${e.message.split("\n").join("\n        ")}`);
  }
}
for (const r of repos) rmSync(r, { recursive: true, force: true });
console.log(`\nrtk.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

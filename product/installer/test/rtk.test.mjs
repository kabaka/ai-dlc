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
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashFile } from "../lib/manifest.mjs";
import { resolvePayloadRoot } from "../lib/payload.mjs";

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
const CLAUDE = "CLAUDE.md";
const CLAUDE_NEW = "CLAUDE.md.new";
const IMPORT = "@.ai-dlc/rtk/RTK.md";
const MARK_BEGIN = "<!-- ai-dlc:begin -->";
const MARK_END = "<!-- ai-dlc:end -->";
// A recognizable managed-region line used to simulate a NEWER kit whose payload
// baseline region differs from an undrifted consumer's on-disk region.
const SENTINEL = "MANAGED-BASELINE-V2-SENTINEL";

const read = (repo, rel) => readFileSync(join(repo, rel), "utf8");
/** The text strictly BETWEEN the managed markers of a CLAUDE.md string. */
function markerRegion(md) {
  const b = md.indexOf(MARK_BEGIN);
  const e = md.indexOf(MARK_END);
  return b === -1 || e === -1 ? "" : md.slice(b + MARK_BEGIN.length, e);
}
/** Count occurrences of the rtk @-import as a standalone line. */
const importLineCount = (md) =>
  md.split("\n").filter((l) => l.trim() === IMPORT).length;

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

// --- 8. CLAUDE.md @-import: managed create + clean-no-op second run ----------
// init --with-rtk on a repo with NO pre-existing CLAUDE.md must create a MANAGED
// CLAUDE.md (our markers) carrying the rtk @-import INSIDE the region, stamp it in
// the manifest, and a following `update` must be a clean no-op (no `.new`, no drift).
test("init --with-rtk creates a managed CLAUDE.md with the rtk @-import; second update is a clean no-op", () => {
  const repo = freshRepo();
  const { status } = cli(repo, ["init", "--with-rtk"]);
  assert.equal(status, 0, "init --with-rtk should succeed");

  assert.ok(has(repo, CLAUDE), "init must create CLAUDE.md");
  const md = read(repo, CLAUDE);
  assert.ok(
    md.includes(MARK_BEGIN) && md.includes(MARK_END),
    "created CLAUDE.md must carry the managed markers"
  );
  assert.ok(
    markerRegion(md).includes(IMPORT),
    "the rtk @-import must live INSIDE the managed marker region"
  );
  assert.equal(importLineCount(md), 1, "exactly one rtk @-import line");

  // Manifest stamps CLAUDE.md to its on-disk bytes (post-reconcile re-stamp).
  const manifest = readJson(repo, MANIFEST);
  assert.ok(manifest.files[CLAUDE], "manifest must stamp CLAUDE.md");
  assert.equal(
    manifest.files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "manifest stamp must match the reconciled on-disk CLAUDE.md (no drift)"
  );
  assert.ok(!has(repo, CLAUDE_NEW), "no sidecar on a fresh managed create");

  // Second run: clean no-op — no sidecar, no churn, CLAUDE.md byte-identical.
  const upd = cli(repo, ["update"]);
  assert.equal(upd.status, 0, "second update should succeed");
  assert.ok(!has(repo, CLAUDE_NEW), "clean no-op must NOT write a .new sidecar");
  assert.equal(read(repo, CLAUDE), md, "second run must not churn CLAUDE.md");
  assert.ok(
    !/updated rtk context import/.test(upd.out),
    `second run must not re-touch the CLAUDE.md import:\n${upd.out}`
  );
  assert.ok(
    /unchanged|no file changes/.test(upd.out),
    `second run should report a no-op:\n${upd.out}`
  );
  assert.equal(
    readJson(repo, MANIFEST).files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "manifest stays in sync on the no-op run"
  );
});

// --- 9. update --without-rtk removes the @-import; rest intact; run clean ----
test("update --without-rtk removes the rtk @-import from CLAUDE.md, keeps the rest, re-stamps, stays clean", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const before = read(repo, CLAUDE);
  assert.ok(markerRegion(before).includes(IMPORT), "precondition: import present");

  const off = cli(repo, ["update", "--without-rtk"]);
  assert.equal(off.status, 0, "--without-rtk should succeed");

  const after = read(repo, CLAUDE);
  assert.equal(importLineCount(after), 0, "the rtk @-import must be removed");
  // The rest of CLAUDE.md is intact: markers survive, out-of-region content stays.
  assert.ok(
    after.includes(MARK_BEGIN) && after.includes(MARK_END),
    "managed markers must survive removal"
  );
  assert.ok(
    after.includes("# Claude Code specifics"),
    "out-of-region CLAUDE.md content must be preserved"
  );
  // Manifest re-stamped to the new (import-free) on-disk bytes.
  assert.equal(
    readJson(repo, MANIFEST).files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "manifest must be re-stamped after removal (no drift)"
  );
  assert.ok(!has(repo, CLAUDE_NEW), "removal must not spawn a sidecar");

  // Follow-up run stays clean.
  const upd = cli(repo, ["update"]);
  assert.equal(upd.status, 0, "follow-up update should succeed");
  assert.equal(read(repo, CLAUDE), after, "follow-up run must not churn CLAUDE.md");
  assert.ok(!has(repo, CLAUDE_NEW), "follow-up run must not write a sidecar");
});

// --- 10. Consumer-owned CLAUDE.md: never edited; sidecar + manual instruction -
test("consumer-owned CLAUDE.md is left byte-identical; sidecar written; manual instruction reported", () => {
  const repo = freshRepo();
  const consumerMd = "# My project\n\nHand-written orchestrator context. No markers here.\n";
  writeFileSync(join(repo, CLAUDE), consumerMd);

  const { status, out } = cli(repo, ["init", "--with-rtk"]);
  assert.equal(status, 0, "init --with-rtk over a consumer CLAUDE.md should succeed");

  // The consumer's file is NEVER edited in place.
  assert.equal(read(repo, CLAUDE), consumerMd, "consumer CLAUDE.md must be byte-identical");
  // The managed version lands alongside as a sidecar.
  assert.ok(has(repo, CLAUDE_NEW), "a CLAUDE.md.new sidecar must be written");
  // The run reports the actionable manual-instruction path.
  assert.ok(/rtk enabled: add/.test(out), `manual instruction must be reported:\n${out}`);
  assert.ok(out.includes(IMPORT), "manual instruction must name the @-import line");
  assert.ok(out.includes(CLAUDE_NEW), "manual instruction must point at the sidecar");
  // We must NOT have stamped (claimed ownership of) the consumer's file.
  assert.ok(
    !readJson(repo, MANIFEST).files[CLAUDE],
    "consumer-owned CLAUDE.md must not be stamped"
  );
});

// --- 11. Idempotence: init --with-rtk twice -> no duplicate import, no drift --
test("init --with-rtk twice does not duplicate the CLAUDE.md @-import or drift", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const first = read(repo, CLAUDE);
  assert.equal(importLineCount(first), 1, "first run wires exactly one @-import");

  const second = cli(repo, ["init", "--with-rtk"]);
  assert.equal(second.status, 0, "second init should succeed");
  const md = read(repo, CLAUDE);
  assert.equal(importLineCount(md), 1, "second run must NOT duplicate the @-import");
  assert.equal(md, first, "second init must not churn CLAUDE.md");
  assert.ok(!has(repo, CLAUDE_NEW), "idempotent re-run writes no sidecar");
});

// --- 12. Drifted managed CLAUDE.md (the fragile path / QA blocking gap) ------
// init --with-rtk, then append project content OUTSIDE the markers (consumer
// drift), then update. The reconciler-owned deferral means the engine must NOT
// sidecar the file, the reconcile preserves the drift and keeps exactly one
// import, and the manifest ADOPTS the drifted on-disk bytes so a follow-up run is
// a clean no-op. This FAILS if the post-apply reconcile is dropped or reordered
// before planActions (the stamp would not track the drift, or the import would be
// stripped by a generic marker-update to the import-free payload).
test("drifted managed CLAUDE.md: update preserves out-of-marker edits, keeps one import, no sidecar, re-stamps, then clean no-op", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const drift = "\n\n## My project notes\n\nHand-written context OUTSIDE the markers.\n";
  const original = read(repo, CLAUDE);
  writeFileSync(join(repo, CLAUDE), original + drift);

  const upd = cli(repo, ["update"]);
  assert.equal(upd.status, 0, "update over a drifted managed CLAUDE.md should succeed");

  const after = read(repo, CLAUDE);
  assert.ok(after.includes("## My project notes"), "out-of-marker drift must be preserved");
  assert.ok(after.endsWith(drift), "the appended content must be preserved verbatim");
  assert.equal(importLineCount(after), 1, "exactly one rtk @-import after the update");
  assert.ok(
    after.includes(MARK_BEGIN) && after.includes(MARK_END),
    "managed markers must stay intact"
  );
  assert.ok(!has(repo, CLAUDE_NEW), "a reconciler-owned file must NOT spawn a .new sidecar on drift");
  assert.equal(
    readJson(repo, MANIFEST).files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "manifest stamp must ADOPT the drifted on-disk bytes (no residual false drift)"
  );

  // A follow-up update is a clean no-op.
  const again = cli(repo, ["update"]);
  assert.equal(again.status, 0, "follow-up update should succeed");
  assert.equal(read(repo, CLAUDE), after, "follow-up update must not churn CLAUDE.md");
  assert.ok(!has(repo, CLAUDE_NEW), "follow-up update writes no sidecar");
});

// --- 13. Baseline propagation (freeze regression) ---------------------------
// Simulate a NEWER kit version whose payload baseline marker-region differs from
// what an UNDRIFTED consumer has on disk, and prove the reconcile UPDATES the
// region to the new baseline while keeping the import correct. This is the direct
// regression guard for the freeze bug (undrifted stamped-with-markers -> noop).
test("baseline propagation: a newer payload baseline region reaches an undrifted managed CLAUDE.md (no freeze), import preserved", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const before = read(repo, CLAUDE);
  assert.equal(importLineCount(before), 1, "precondition: one import present");
  assert.ok(!markerRegion(before).includes(SENTINEL), "precondition: sentinel absent");

  // Newer kit: copy the real payload, mutate ONLY CLAUDE.md's managed region.
  const altPayload = mkdtempSync(join(tmpdir(), "aidlc-rtk-payload-"));
  repos.push(altPayload);
  cpSync(resolvePayloadRoot(), altPayload, { recursive: true });
  const payloadClaudePath = join(altPayload, CLAUDE);
  const payloadClaude = readFileSync(payloadClaudePath, "utf8");
  assert.ok(payloadClaude.includes(MARK_END), "payload CLAUDE.md must carry markers");
  writeFileSync(
    payloadClaudePath,
    payloadClaude.replace(MARK_END, `${SENTINEL}\n${MARK_END}`)
  );

  // Consumer is UNDRIFTED (on-disk == stamp). Update against the newer payload.
  const upd = cli(repo, ["update"], { AIDLC_PAYLOAD_ROOT: altPayload });
  assert.equal(upd.status, 0, "update against the newer payload should succeed");

  const after = read(repo, CLAUDE);
  assert.ok(
    markerRegion(after).includes(SENTINEL),
    "the NEW baseline region MUST reach the undrifted consumer (no silent freeze)"
  );
  assert.equal(importLineCount(after), 1, "the rtk import stays present and single");
  assert.ok(
    after.includes(MARK_BEGIN) && after.includes(MARK_END),
    "managed markers must stay intact"
  );
  assert.ok(after.includes("# Claude Code specifics"), "out-of-marker content preserved");
  assert.ok(!has(repo, CLAUDE_NEW), "baseline propagation writes no sidecar");
  assert.equal(
    readJson(repo, MANIFEST).files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "re-stamped to the propagated on-disk bytes"
  );

  // Idempotent against the same newer payload.
  const again = cli(repo, ["update"], { AIDLC_PAYLOAD_ROOT: altPayload });
  assert.equal(again.status, 0, "re-run against the same payload should succeed");
  assert.equal(read(repo, CLAUDE), after, "re-run must not churn CLAUDE.md");
  assert.ok(!has(repo, CLAUDE_NEW), "no sidecar on the idempotent re-run");
});

// --- 14. Default (no rtk) create -> second run clean no-op -------------------
// The reconcile must not churn on the default OFF path: a managed CLAUDE.md with
// NO import stays byte-identical across runs and never grows an import.
test("default (no rtk) init creates a managed CLAUDE.md with no import; second update is a clean no-op", () => {
  const repo = freshRepo();
  const { status } = cli(repo, ["init"]);
  assert.equal(status, 0, "default init should succeed");
  assert.ok(has(repo, CLAUDE), "default init creates CLAUDE.md");
  const md = read(repo, CLAUDE);
  assert.ok(md.includes(MARK_BEGIN) && md.includes(MARK_END), "managed markers present");
  assert.equal(importLineCount(md), 0, "default install carries NO rtk import");
  assert.ok(!has(repo, CLAUDE_NEW), "no sidecar on a fresh default create");
  assert.equal(
    readJson(repo, MANIFEST).files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "CLAUDE.md stamped to its on-disk bytes"
  );

  const upd = cli(repo, ["update"]);
  assert.equal(upd.status, 0, "second update should succeed");
  assert.equal(read(repo, CLAUDE), md, "second run must not churn CLAUDE.md");
  assert.equal(importLineCount(read(repo, CLAUDE)), 0, "no import ever appears on the default path");
  assert.ok(!has(repo, CLAUDE_NEW), "clean no-op writes no sidecar");
  assert.ok(
    !/updated rtk context import/.test(upd.out),
    `default no-op must not touch the import:\n${upd.out}`
  );
  assert.ok(
    /unchanged|no file changes/.test(upd.out),
    `second run should report a no-op:\n${upd.out}`
  );
});

// --- 15. Dry-run over an already-managed CLAUDE.md that WOULD change ----------
// Guards the :213 dry-run bug: a --dry-run that would add the import must PREVIEW
// it but persist NOTHING — CLAUDE.md unedited and the manifest file byte-identical
// (no persisted re-stamp).
test("--dry-run over an already-managed CLAUDE.md that would change writes nothing and persists no re-stamp", () => {
  const repo = freshRepo();
  cli(repo, ["init"]); // managed CLAUDE.md, NO rtk import
  const md0 = read(repo, CLAUDE);
  assert.equal(importLineCount(md0), 0, "precondition: no import");
  const manifestBytes0 = read(repo, MANIFEST);
  assert.equal(
    readJson(repo, MANIFEST).files[CLAUDE].hash,
    hashFile(join(repo, CLAUDE)),
    "precondition: stamp matches on-disk"
  );

  const dry = cli(repo, ["update", "--with-rtk", "--dry-run"]);
  assert.equal(dry.status, 0, "dry-run should succeed");
  assert.ok(
    /would update rtk context import/.test(dry.out),
    `dry-run must PREVIEW the intended change:\n${dry.out}`
  );
  assert.ok(/nothing was written/.test(dry.out), "dry-run reports nothing written");

  // Nothing persisted: CLAUDE.md unedited, manifest byte-identical (no re-stamp).
  assert.equal(read(repo, CLAUDE), md0, "dry-run must not edit CLAUDE.md");
  assert.equal(importLineCount(read(repo, CLAUDE)), 0, "dry-run must not add the import");
  assert.equal(
    read(repo, MANIFEST),
    manifestBytes0,
    "dry-run must persist NO manifest change (including the CLAUDE.md re-stamp)"
  );
  assert.ok(!has(repo, CLAUDE_NEW), "dry-run writes no sidecar");
});

// --- 16. --without-rtk dangling-import instruction (consumer-owned) ----------
// A consumer-OWNED (marker-less) CLAUDE.md that imports RTK.md + --without-rtk:
// the import now points at a removed file, so the run prints a manual-REMOVAL
// instruction and NEVER edits the consumer's file.
test("--without-rtk on a consumer-owned CLAUDE.md that imports RTK.md prints a removal instruction; the file is never edited", () => {
  const repo = freshRepo();
  const consumerMd = `# My project\n\nHand-written orchestrator context. No markers.\n\n${IMPORT}\n`;
  writeFileSync(join(repo, CLAUDE), consumerMd);

  // Enable rtk first so RTK.md is actually installed (removal then dangles the import).
  const on = cli(repo, ["init", "--with-rtk"]);
  assert.equal(on.status, 0, "init --with-rtk should succeed");
  assert.equal(read(repo, CLAUDE), consumerMd, "consumer CLAUDE.md untouched on enable");
  assert.ok(has(repo, RTK_MD), "RTK.md must be installed while enabled");

  const off = cli(repo, ["update", "--without-rtk"]);
  assert.equal(off.status, 0, "--without-rtk should succeed");
  assert.equal(
    read(repo, CLAUDE),
    consumerMd,
    "consumer-owned CLAUDE.md must remain byte-identical after --without-rtk"
  );
  assert.ok(!has(repo, RTK_MD), "RTK.md removed -> the consumer's import now dangles");
  assert.ok(/rtk disabled:/.test(off.out), `must print a manual-removal instruction:\n${off.out}`);
  assert.ok(off.out.includes(IMPORT), "removal instruction must name the dangling import line");
  assert.ok(/dangling import/.test(off.out), "removal instruction must explain the dangling import");
});

// --- 16b. Removal instruction is guarded on an actual disable TRANSITION ------
// A plain `init` (no rtk ever installed) on a repo whose CONSUMER-authored,
// marker-less CLAUDE.md merely happens to contain the rtk @-import must NOT print
// the "dangling import — remove this line" instruction: RTK.md was never there, so
// the claim would be false. The consumer's file must also stay byte-identical.
test("plain init (rtk never installed) does NOT print the removal instruction for a consumer import, and never edits the file", () => {
  const repo = freshRepo();
  const consumerMd = `# My project\n\nHand-written orchestrator context. No markers.\n\n${IMPORT}\n`;
  writeFileSync(join(repo, CLAUDE), consumerMd);

  const { status, out } = cli(repo, ["init"]); // no flag, no env -> rtk never installed
  assert.equal(status, 0, "plain init should succeed");
  // No disable transition ever happened, so no removal nag.
  assert.ok(
    !/rtk disabled:/.test(out),
    `plain init must NOT print the removal instruction (rtk was never installed):\n${out}`
  );
  assert.ok(
    !/dangling import/.test(out),
    `plain init must NOT claim a dangling import:\n${out}`
  );
  // The consumer's CLAUDE.md is never touched.
  assert.equal(read(repo, CLAUDE), consumerMd, "consumer CLAUDE.md must be byte-identical");
});

// --- 16c. Removal instruction prints ONCE on the disable transition, not after --
// Consumer-owned CLAUDE.md, enable-then-disable lifecycle. `init --with-rtk` over a
// consumer file WITHOUT the import prints the ADD-instruction (enable direction).
// The consumer then adds the line by hand. `--without-rtk` is the enabled->disabled
// TRANSITION (wasEnabled true) -> the REMOVAL instruction prints exactly once. A
// subsequent plain `update` (still off, manifest already enabled:false ->
// wasEnabled false) must NOT re-print it — no persistent nag. The consumer's file is
// never edited in either direction.
test("consumer-owned CLAUDE.md: removal instruction prints once on disable, not again on a later sticky-off update", () => {
  const repo = freshRepo();
  const beforeImport = "# My project\n\nHand-written orchestrator context. No markers.\n";
  writeFileSync(join(repo, CLAUDE), beforeImport);

  // Enable over a consumer file WITHOUT the import: prints the ADD-instruction only.
  const on = cli(repo, ["init", "--with-rtk"]);
  assert.equal(on.status, 0, "init --with-rtk should succeed");
  assert.ok(/rtk enabled: add/.test(on.out), `enable must print the add-instruction:\n${on.out}`);
  assert.ok(!/rtk disabled:/.test(on.out), "enable must NOT print the removal instruction");
  assert.ok(has(repo, RTK_MD), "RTK.md installed while enabled");
  assert.equal(read(repo, CLAUDE), beforeImport, "consumer CLAUDE.md untouched on enable");

  // The consumer follows the instruction and adds the import line by hand.
  const withImport = `${beforeImport}\n${IMPORT}\n`;
  writeFileSync(join(repo, CLAUDE), withImport);

  // Disable TRANSITION: removal instruction prints exactly once; file untouched.
  const off = cli(repo, ["update", "--without-rtk"]);
  assert.equal(off.status, 0, "--without-rtk should succeed");
  assert.ok(/rtk disabled:/.test(off.out), `disable transition must print the removal instruction:\n${off.out}`);
  assert.ok(/dangling import/.test(off.out), "removal instruction must explain the dangling import");
  assert.equal(read(repo, CLAUDE), withImport, "consumer CLAUDE.md stays byte-identical");
  assert.equal(readJson(repo, MANIFEST).rtk?.enabled, false, "manifest is sticky enabled:false");

  // Subsequent sticky-off update: NOT re-printed (wasEnabled is now false).
  const again = cli(repo, ["update"]);
  assert.equal(again.status, 0, "follow-up update should succeed");
  assert.ok(
    !/rtk disabled:/.test(again.out),
    `a later sticky-off update must NOT re-nag with the removal instruction:\n${again.out}`
  );
  assert.equal(read(repo, CLAUDE), withImport, "consumer CLAUDE.md still byte-identical");
});

// --- 17. Malformed markers fail-safe ----------------------------------------
// A stamped CLAUDE.md whose markers are reordered (end before begin) must make the
// reconcile a NO-OP — it must never corrupt or rewrite the file.
test("malformed markers fail-safe: a reordered end marker makes the reconcile a no-op (no corruption)", () => {
  const repo = freshRepo();
  cli(repo, ["init", "--with-rtk"]);
  const good = read(repo, CLAUDE);
  // Swap the markers so END precedes BEGIN (both remain present as substrings).
  const corrupt = good
    .replace(MARK_BEGIN, "@@AIDLC_TMP@@")
    .replace(MARK_END, MARK_BEGIN)
    .replace("@@AIDLC_TMP@@", MARK_END);
  assert.ok(
    corrupt.indexOf(MARK_END) < corrupt.indexOf(MARK_BEGIN),
    "precondition: the end marker now precedes the begin marker"
  );
  writeFileSync(join(repo, CLAUDE), corrupt);

  const upd = cli(repo, ["update"]);
  assert.equal(upd.status, 0, "update over malformed markers must not crash");
  assert.equal(
    read(repo, CLAUDE),
    corrupt,
    "reconcile must NOT edit a file whose markers are malformed (no corruption)"
  );
  assert.ok(!has(repo, CLAUDE_NEW) || read(repo, CLAUDE) === corrupt, "the consumer file itself is never rewritten");
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

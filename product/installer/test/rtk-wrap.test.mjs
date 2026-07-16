// Security-relevant behavioral tests for the rtk PreToolUse wrapper
// (product/templates/hooks/rtk-wrap.sh). We exercise the CANONICAL shipped script
// directly with crafted stdin and a STUB `rtk` on PATH, and assert the opt-in kill
// switch, fail-open behavior, the transition pass-throughs (the wrapper never
// rewrites a phase-transition command), and correct delegation for a wrap-eligible
// command.
//
// The stub `rtk`:
//   - `rtk hook claude --help`  -> exit 0 (identity check surface).
//   - `rtk hook claude`         -> read stdin, emit a recognizable updatedInput
//                                  JSON echoing the original command.
//   - with RTK_STUB_FAIL=1 set, `rtk hook claude` writes JUNK to stdout and exits
//     NON-ZERO — exercises the wrapper's fail-open-on-failure branch (a rtk that
//     fails must produce NO forwarded output).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WRAP = join(HERE, "..", "..", "templates", "hooks", "rtk-wrap.sh");

// --- Build a throwaway dir holding a stub `rtk` -----------------------------
const stubDir = mkdtempSync(join(tmpdir(), "aidlc-rtk-stub-"));
const STUB_MARK = "RTK_STUB_REWROTE";
writeFileSync(
  join(stubDir, "rtk"),
  `#!/usr/bin/env bash
if [ "$1" = "hook" ] && [ "$2" = "claude" ]; then
  if [ "$3" = "--help" ]; then exit 0; fi
  if [ "\${RTK_STUB_FAIL:-0}" = "1" ]; then
    printf 'JUNK_RTK_FAILURE_STDOUT_MUST_NOT_BE_FORWARDED'
    exit 1
  fi
  in="$(cat)"
  orig="$(printf '%s' "$in" | jq -r '.tool_input.command // empty')"
  jq -n --arg c "${STUB_MARK} -- $orig" \\
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput:{command:$c}}}'
  exit 0
fi
exit 1
`,
  { mode: 0o755 }
);
chmodSync(join(stubDir, "rtk"), 0o755);

// PATH variants: WITH the stub (rtk present) and WITHOUT (rtk absent, but jq kept).
const PATH_WITH_RTK = stubDir + delimiter + process.env.PATH;
const PATH_NO_RTK = process.env.PATH; // no stub -> `rtk` not found, jq still present

/**
 * Run the wrapper with `command` as tool_input.command, given env + PATH.
 * `fail: true` puts the stub rtk into its non-zero/junk-stdout mode.
 */
function runWrap(command, { enable, path, fail }) {
  const input = JSON.stringify({ tool_input: { command } });
  const env = { ...process.env, PATH: path };
  if (enable === undefined) delete env.AIDLC_ENABLE_RTK;
  else env.AIDLC_ENABLE_RTK = enable;
  if (fail) env.RTK_STUB_FAIL = "1";
  const res = spawnSync("bash", [WRAP], { input, encoding: "utf8", env });
  return { status: res.status, out: res.stdout || "", err: res.stderr || "" };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// --- 1. Kill switch: env unset/0 -> inert even with stub rtk present --------
test("kill switch: AIDLC_ENABLE_RTK unset -> exit 0, empty stdout (stub rtk present)", () => {
  const { status, out } = runWrap("ls -la", { enable: undefined, path: PATH_WITH_RTK });
  assert.equal(status, 0, "must exit 0 when disabled");
  assert.equal(out, "", "must emit nothing when disabled");
});

test("kill switch: AIDLC_ENABLE_RTK=0 -> exit 0, empty stdout (stub rtk present)", () => {
  const { status, out } = runWrap("ls -la", { enable: "0", path: PATH_WITH_RTK });
  assert.equal(status, 0);
  assert.equal(out, "");
});

// --- 2. Fail-open: enabled but no rtk on PATH -> pass through ----------------
test("fail-open: enabled, no rtk on PATH -> exit 0, empty stdout", () => {
  const { status, out } = runWrap("ls -la", { enable: "1", path: PATH_NO_RTK });
  assert.equal(status, 0, "absent rtk must never block");
  assert.equal(out, "", "absent rtk must produce no rewrite");
});

// --- 3. Delegate: enabled, stub rtk, non-transition command -> rewrite -------
test("delegate: enabled + stub rtk, 'ls -la' -> forwards stub updatedInput JSON", () => {
  const { status, out } = runWrap("ls -la", { enable: "1", path: PATH_WITH_RTK });
  assert.equal(status, 0);
  assert.ok(out.includes(STUB_MARK), `expected stub rewrite on stdout:\n${out}`);
  assert.ok(out.includes("updatedInput"), "forwarded JSON must carry updatedInput");
});

test("delegate: enabled + stub rtk, 'cargo build' (not a family) -> forwards rewrite", () => {
  const { status, out } = runWrap("cargo build", { enable: "1", path: PATH_WITH_RTK });
  assert.equal(status, 0);
  assert.ok(out.includes(STUB_MARK), `cargo must delegate (not in family):\n${out}`);
});

// --- 3b. Fail-open on rtk FAILURE: non-zero rtk -> forward NOTHING -----------
// The wrapper captures rtk's stdout and forwards it ONLY on a zero exit. When rtk
// exits non-zero (even while printing junk), the wrapper must emit nothing and
// exit 0 so Claude runs the ORIGINAL command. Without this, a mutation that always
// printed rtk's stdout would go undetected.
test("fail-open: enabled + stub rtk that EXITS NON-ZERO -> exit 0, empty stdout", () => {
  const { status, out } = runWrap("ls -la", {
    enable: "1",
    path: PATH_WITH_RTK,
    fail: true,
  });
  assert.equal(status, 0, "a failing rtk must never block the command");
  assert.equal(out, "", "a failing rtk's stdout must NOT be forwarded");
});

// --- 4. Transition pass-throughs: NEVER rewrite a transition ----------------
// One case per family in rtk-wrap.sh's case list (git|gh|npm|pnpm|yarn|make) plus
// the deploy|release word-match branch, so every pass-through arm is exercised.
const TRANSITIONS = [
  "git status", // git family (conservative superset)
  "git merge main",
  "git push origin main",
  "git tag v1",
  "gh pr merge 12", // gh family
  "npm publish", // npm family
  "pnpm install", // pnpm family
  "yarn add lodash", // yarn family
  "make build", // make family
  "terraform deploy -auto-approve", // deploy word-match branch
  "./release.sh --prod", // release word-match branch (basename not in family list)
];
for (const cmd of TRANSITIONS) {
  test(`pass-through: '${cmd}' -> exit 0, empty stdout (no rewrite) with rtk enabled`, () => {
    const { status, out } = runWrap(cmd, { enable: "1", path: PATH_WITH_RTK });
    assert.equal(status, 0, `${cmd} must exit 0`);
    assert.equal(out, "", `${cmd} must NOT be rewritten (transition pass-through)`);
  });
}

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
rmSync(stubDir, { recursive: true, force: true });
console.log(`\nrtk-wrap.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

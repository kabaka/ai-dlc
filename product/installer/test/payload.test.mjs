// Payload-shape tests for the AI-DLC installer.
//
// These pin the design-QA tool reachability contract (the orphan-feature fix):
// the installer MUST ship the first-party design-QA TOOLS into the consumer repo
// at .ai-dlc/scripts/, and MUST fence out the validation-only scaffolding
// (package.json, the lockfile, node_modules/, test/) that pins THIS repo's own
// tests and must never land on a consumer machine.
//
// They also assert the correct OWNERSHIP TIER ("kit") and that the tools land at
// the exact consumer paths the skills/agents reference, with the directory shape
// preserved so the tools' relative imports resolve.

import assert from "node:assert/strict";
import { resolvePayloadRoot, buildPayload } from "../lib/payload.mjs";

const payloadRoot = resolvePayloadRoot();
const entries = buildPayload(payloadRoot);
const byDest = new Map(entries.map((e) => [e.dest, e]));
const dests = new Set(byDest.keys());

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// --- What MUST ship (the reachability fix) ---------------------------------

// off-token-lint.mjs (Slice 1) lands at the top of .ai-dlc/scripts/.
test("ships off-token-lint.mjs at .ai-dlc/scripts/off-token-lint.mjs", () => {
  assert.ok(
    dests.has(".ai-dlc/scripts/off-token-lint.mjs"),
    "off-token-lint.mjs must ship to .ai-dlc/scripts/"
  );
});

// The shared, audited lib primitives every tool imports.
const REQUIRED_LIB = [
  ".ai-dlc/scripts/lib/contract.mjs",
  ".ai-dlc/scripts/lib/binding.mjs",
  ".ai-dlc/scripts/lib/app-exec-harness.mjs",
];
for (const dest of REQUIRED_LIB) {
  test(`ships ${dest}`, () => {
    assert.ok(dests.has(dest), `${dest} must ship (relative imports depend on it)`);
  });
}

// The Slice-3 visual-QA suite — every tool, both exec-free and harness-gated,
// plus the shared drivers (browser-lib, browser-runner, static-server).
const REQUIRED_VISUAL_QA = [
  "contrast-check.mjs",
  "patch-coverage.mjs",
  "changelog-check.mjs",
  "axe-audit.mjs",
  "responsive-check.mjs",
  "pixel-diff.mjs",
  "reachability-runner.mjs",
  "browser-lib.mjs",
  "browser-runner.mjs",
  "static-server.mjs",
].map((f) => `.ai-dlc/scripts/visual-qa/${f}`);
for (const dest of REQUIRED_VISUAL_QA) {
  test(`ships ${dest}`, () => {
    assert.ok(dests.has(dest), `${dest} must ship`);
  });
}

// The consumer-facing README (a trimmed, consumer-path variant).
test("ships a consumer-facing .ai-dlc/scripts/README.md", () => {
  assert.ok(
    dests.has(".ai-dlc/scripts/README.md"),
    "a consumer-facing scripts README must ship"
  );
});

// --- What MUST NOT ship (the fence) ----------------------------------------

// No validation-only scaffolding may land under .ai-dlc/scripts/.
test("fences out validation-only scaffolding (no package.json / lock / node_modules / test)", () => {
  const leaked = [...dests].filter(
    (d) =>
      d.startsWith(".ai-dlc/scripts/") &&
      (/(^|\/)package(-lock)?\.json$/.test(d) ||
        /(^|\/)node_modules(\/|$)/.test(d) ||
        /(^|\/)test(\/|$)/.test(d))
  );
  assert.deepEqual(leaked, [], `validation-only files leaked into payload: ${leaked}`);
});

// Belt-and-suspenders: only first-party .mjs (and the one README.md) may ship
// under .ai-dlc/scripts/. Catches any incidental non-.mjs that would otherwise
// hitch a ride if the source tree gains a stray file.
test("ships only .mjs tools and the README under .ai-dlc/scripts/", () => {
  const scriptDests = [...dests].filter((d) => d.startsWith(".ai-dlc/scripts/"));
  const offenders = scriptDests.filter(
    (d) => !d.endsWith(".mjs") && d !== ".ai-dlc/scripts/README.md"
  );
  assert.deepEqual(offenders, [], `unexpected non-.mjs payload under scripts: ${offenders}`);
});

// --- Tier correctness -------------------------------------------------------

// Every shipped script is "kit" tier: it runs via `node <path>` (no chmod+x),
// so it matches how other kit files are written/preserved on update.
test("every shipped .ai-dlc/scripts/ entry is the 'kit' tier", () => {
  const scriptEntries = entries.filter((e) => e.dest.startsWith(".ai-dlc/scripts/"));
  assert.ok(scriptEntries.length > 0, "expected design-QA scripts in the payload");
  for (const e of scriptEntries) {
    assert.equal(
      e.tier,
      "kit",
      `${e.dest} must be the 'kit' tier (node-run, not executable); got '${e.tier}'`
    );
  }
});

// --- Count snapshot ---------------------------------------------------------

// Exact count of shipped design-QA files: 1 off-token-lint + 3 lib + 10 visual-qa
// + 1 consumer README = 15. A drift here means a tool was added/dropped from the
// payload — update this number deliberately and re-verify the dry-run proof.
test("ships exactly 15 design-QA files under .ai-dlc/scripts/", () => {
  const scriptDests = [...dests].filter((d) => d.startsWith(".ai-dlc/scripts/"));
  assert.equal(
    scriptDests.length,
    15,
    `expected 15 shipped scripts; got ${scriptDests.length}:\n  ${scriptDests
      .sort()
      .join("\n  ")}`
  );
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
console.log(`\npayload.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

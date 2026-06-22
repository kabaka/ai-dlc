// Behavioral test: materialize the payload into a temp repo and RUN shipped
// design-QA tools from .ai-dlc/scripts/ to prove their RELATIVE imports resolve
// once the directory shape is preserved (off-token-lint -> ./lib/*; visual-qa/*
// -> ../lib/* and ./<sibling>). A module-resolution regression here would surface
// as ERR_MODULE_NOT_FOUND, which we assert is absent.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePayloadRoot, buildPayload } from "../lib/payload.mjs";
import { decideAction, executeAction } from "../lib/apply.mjs";

const payloadRoot = resolvePayloadRoot();
const entries = buildPayload(payloadRoot).filter((e) =>
  e.dest.startsWith(".ai-dlc/scripts/")
);

// Materialize just the design-QA scripts into a throwaway repo, exactly as the
// installer would (create action -> write file at dest).
const repo = mkdtempSync(join(tmpdir(), "aidlc-installer-test-"));
const manifest = { files: {} };
for (const entry of entries) {
  const action = decideAction(entry, repo, manifest);
  executeAction(action, repo, manifest, { dryRun: false });
}

function run(rel, args = []) {
  const res = spawnSync(process.execPath, [join(repo, rel), ...args], {
    encoding: "utf8",
  });
  return { status: res.status, out: (res.stdout || "") + (res.stderr || "") };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// off-token-lint resolves ./lib/binding.mjs + ./lib/contract.mjs. With no
// binding it must SKIP (exit 3) — not crash on a missing module.
test("off-token-lint runs from .ai-dlc/scripts/ (resolves ./lib/*)", () => {
  const { status, out } = run(".ai-dlc/scripts/off-token-lint.mjs", [
    "--repo",
    repo,
  ]);
  assert.ok(
    !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(out),
    `relative import failed to resolve:\n${out}`
  );
  assert.equal(status, 3, `expected SKIPPED (3) with no binding; got ${status}\n${out}`);
});

// An exec-free visual-qa tool resolves ../lib/binding.mjs + ../lib/contract.mjs.
test("contrast-check runs from visual-qa/ (resolves ../lib/*)", () => {
  const { status, out } = run(".ai-dlc/scripts/visual-qa/contrast-check.mjs", [
    "--repo",
    repo,
  ]);
  assert.ok(
    !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(out),
    `relative import failed to resolve:\n${out}`
  );
  assert.equal(status, 3, `expected SKIPPED (3) with no binding; got ${status}\n${out}`);
});

// A harness-gated tool pulls the deepest import chain: ../lib/app-exec-harness +
// ./browser-runner -> ./browser-lib -> ./static-server. We only assert the chain
// resolves (no ERR_MODULE_NOT_FOUND) and the tool exits NON-PASS fail-closed
// (3 default-deny, or 2 on a security refusal such as the no-root rule) — never
// a hollow PASS.
test("reachability-runner resolves its full relative import chain", () => {
  const { status, out } = run(
    ".ai-dlc/scripts/visual-qa/reachability-runner.mjs",
    ["--repo", repo]
  );
  assert.ok(
    !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(out),
    `relative import chain failed to resolve:\n${out}`
  );
  assert.ok(
    status === 3 || status === 2,
    `expected fail-closed non-PASS (3 default-deny or 2 refusal); got ${status}\n${out}`
  );
});

// With a non-visual binding, off-token-lint still resolves its imports and SKIPs.
test("off-token-lint reads an untrusted binding without import failure", () => {
  mkdirSync(join(repo, ".ai-dlc"), { recursive: true });
  writeFileSync(
    join(repo, ".ai-dlc", "stack-binding.json"),
    JSON.stringify({ surface: "none", absent: true })
  );
  const { status, out } = run(".ai-dlc/scripts/off-token-lint.mjs", [
    "--repo",
    repo,
  ]);
  assert.ok(
    !/ERR_MODULE_NOT_FOUND|Cannot find module/.test(out),
    `relative import failed to resolve:\n${out}`
  );
  assert.equal(status, 3, `non-visual surface must SKIP (3); got ${status}\n${out}`);
});

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
rmSync(repo, { recursive: true, force: true });
console.log(`\nrun-shipped-tools.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

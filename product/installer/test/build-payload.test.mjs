// Payload-build PARITY tests for the AI-DLC installer.
//
// These pin the invariant that makes a PUBLISHED install work: the generated
// installer/payload/ (assembled by scripts/build-payload.mjs) carries EXACTLY the
// source set buildPayload() expects — no missing file (which would throw at
// install time) and no extra file (drift / accidental inclusion). Because the
// build and the installer both derive from buildPayload(), a divergence here means
// the copy step itself failed to land or over-copied.
//
// We drive the REAL build (assemblePayload) and then verify the on-disk result,
// independently of the copy mechanism, so a broken build cannot pass silently.

import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { assemblePayload } from "../scripts/build-payload.mjs";
import { buildPayload } from "../lib/payload.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/test
const INSTALLER_ROOT = resolve(HERE, "..");
const PRODUCT_ROOT = resolve(INSTALLER_ROOT, "..");

// Assemble the payload for real (clears + rebuilds installer/payload/).
const { payloadDir, files: writtenRel } = assemblePayload();

/** Recursively list files under `dir` as POSIX-relative paths. */
function walkRel(dir) {
  const out = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) out.push(relative(dir, child).split(sep).join("/"));
    }
  };
  if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir);
  return out.sort();
}

const onDisk = walkRel(payloadDir);
const written = [...writtenRel].map((p) => p.split(sep).join("/")).sort();

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// --- The build wrote something, and the report matches the disk --------------

test("assemblePayload wrote a non-empty payload", () => {
  assert.ok(written.length > 0, "expected the build to write files");
});

test("reported file list exactly matches what is on disk (no phantom, no stray)", () => {
  assert.deepEqual(
    onDisk,
    written,
    "payload/ on disk must equal the set build-payload reported writing"
  );
});

// --- Parity: the built payload yields the identical install plan -------------

// The set of destinations the installer would produce must be identical whether
// it reads the in-repo product/ tree or the assembled installer/payload/. Include
// rtk (opt-in) so the published --with-rtk path is covered too.
const productPlan = buildPayload(PRODUCT_ROOT, { withRtk: true });
const payloadPlan = buildPayload(payloadDir, { withRtk: true });

test("payload plan has the same destinations as the product plan", () => {
  const a = productPlan.map((e) => e.dest).sort();
  const b = payloadPlan.map((e) => e.dest).sort();
  assert.deepEqual(b, a, "install plan diverged between product/ and payload/");
});

test("every source the payload plan references exists on disk (no missing file)", () => {
  const missing = [];
  for (const e of payloadPlan) {
    // The one consumer-scripts README is read from INSTALLER_ROOT (ships via
    // package.json "files"), not from payload/ — it is legitimately not copied.
    if (resolve(e.src).startsWith(INSTALLER_ROOT + sep)) continue;
    if (!existsSync(e.src)) missing.push(e.src);
  }
  assert.deepEqual(missing, [], `payload is missing expected sources: ${missing}`);
});

// --- The default (no-rtk) install path also resolves fully -------------------

test("default (no-rtk) payload plan resolves every source", () => {
  const missing = buildPayload(payloadDir)
    .filter((e) => !resolve(e.src).startsWith(INSTALLER_ROOT + sep))
    .filter((e) => !existsSync(e.src))
    .map((e) => e.src);
  assert.deepEqual(missing, [], `default payload missing sources: ${missing}`);
});

// --- The fence held: validation-only scaffolding never landed ----------------

test("no validation-only scaffolding leaked into payload/", () => {
  const leaked = onDisk.filter(
    (p) =>
      /(^|\/)node_modules(\/|$)/.test(p) ||
      /(^|\/)test(\/|$)/.test(p) ||
      /(^|\/)package(-lock)?\.json$/.test(p)
  );
  assert.deepEqual(leaked, [], `fenced-out files leaked into payload: ${leaked}`);
});

test("installer/ was not recursed into payload/", () => {
  const leaked = onDisk.filter((p) => p === "installer" || p.startsWith("installer/"));
  assert.deepEqual(leaked, [], `installer/ leaked into payload: ${leaked}`);
});

// --- resolvePayloadRoot now selects the built payload ------------------------

test("payload/AGENTS.md exists so resolvePayloadRoot selects the published layout", () => {
  assert.ok(
    existsSync(join(payloadDir, "AGENTS.md")),
    "payload/AGENTS.md must exist for resolvePayloadRoot to pick installer/payload/"
  );
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
console.log(`\nbuild-payload.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

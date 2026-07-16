// Kit-version resolution tests.
//
// package.json is the single SemVer source of truth (ADR-aligned: the plugin
// manifest no longer carries a `version`). These pin that resolveKitVersion()
// returns the installer package.json version in the published scenario (a payload
// root with NO plugin.json) and via the fallback path (a plugin.json that omits
// `version`), while the legacy read still honors a plugin.json that does stamp one.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assemblePayload } from "../scripts/build-payload.mjs";
import { resolveKitVersion } from "../lib/version.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const INSTALLER_ROOT = resolve(HERE, "..");

const pkg = JSON.parse(readFileSync(join(INSTALLER_ROOT, "package.json"), "utf8"));
const PKG_VERSION = pkg.version;

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("package.json declares a non-empty version string", () => {
  assert.equal(typeof PKG_VERSION, "string");
  assert.ok(PKG_VERSION.trim().length > 0, "package.json version must be set");
});

// Published scenario: the assembled payload root has NO .claude-plugin/plugin.json
// (it is not part of the payload), so resolution falls straight to package.json.
test("resolveKitVersion(payload) returns the package.json version (published layout)", () => {
  const { payloadDir } = assemblePayload();
  assert.equal(resolveKitVersion(payloadDir), PKG_VERSION);
});

// Fallback path: a plugin.json that OMITS `version` must not short-circuit —
// resolution falls through to package.json.
test("resolveKitVersion falls through a version-less plugin.json to package.json", () => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-ver-nover-"));
  try {
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "ai-dlc" }) // no `version`
    );
    assert.equal(resolveKitVersion(root), PKG_VERSION);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Defensive legacy read: an older plugin.json that DOES stamp a version is still
// honored (behavior preserved — the code path is not dead for such a manifest).
test("resolveKitVersion honors a plugin.json that still stamps a version", () => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-ver-legacy-"));
  try {
    mkdirSync(join(root, ".claude-plugin"), { recursive: true });
    writeFileSync(
      join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "ai-dlc", version: "9.9.9" })
    );
    assert.equal(resolveKitVersion(root), "9.9.9");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
console.log(`\nversion.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

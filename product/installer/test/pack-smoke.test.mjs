// Tarball SMOKE test: pack the package exactly as `npm publish` would, extract
// it, and prove the PUBLISHED artifact actually works end to end.
//
// This is the regression guard for the shipped-package blocker: package.json
// listed payload/ but nothing built it, so a published `npx @kabaka/ai-dlc init`
// threw "Could not locate the AI-DLC payload." Here we run the real `npm pack`
// (which fires the `prepack` build-payload step), assert the payload + license +
// readme are inside the tarball and the dev-only scaffolding is NOT, then run
// `ai-dlc init --dry-run` FROM the extracted tarball against a throwaway git repo
// and assert a clean exit with a plausible plan.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const INSTALLER_ROOT = resolve(HERE, "..");

const tmps = [];
const mkTmp = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
};
const cleanup = () => {
  for (const d of tmps) rmSync(d, { recursive: true, force: true });
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// --- Pack (runs prepack -> build-payload) and extract ------------------------

const tgzDir = mkTmp("aidlc-pack-");
const pack = spawnSync("npm", ["pack", "--pack-destination", tgzDir], {
  cwd: INSTALLER_ROOT,
  encoding: "utf8",
});
if (pack.status !== 0) {
  console.error(`FAIL  npm pack exited ${pack.status}\n${pack.stdout}\n${pack.stderr}`);
  cleanup();
  process.exit(1);
}
const tgz = readdirSync(tgzDir).find((f) => f.endsWith(".tgz"));
if (!tgz) {
  console.error(`FAIL  npm pack produced no .tgz in ${tgzDir}\n${pack.stdout}`);
  cleanup();
  process.exit(1);
}

const extractDir = mkTmp("aidlc-extract-");
const untar = spawnSync("tar", ["-xzf", join(tgzDir, tgz), "-C", extractDir], {
  encoding: "utf8",
});
if (untar.status !== 0) {
  console.error(`FAIL  tar extract exited ${untar.status}\n${untar.stderr}`);
  cleanup();
  process.exit(1);
}
// npm tarballs always extract under a top-level `package/`.
const pkgDir = join(extractDir, "package");
const has = (rel) => existsSync(join(pkgDir, rel));
const anyIn = (rel, pred) => {
  const abs = join(pkgDir, rel);
  return existsSync(abs) && readdirSync(abs).some(pred);
};

// --- What MUST be inside the tarball -----------------------------------------

test("tarball contains payload/AGENTS.md (resolvePayloadRoot target)", () => {
  assert.ok(has("payload/AGENTS.md"), "payload/AGENTS.md must ship");
});

test("tarball contains payload/CLAUDE.md", () => {
  assert.ok(has("payload/CLAUDE.md"), "payload/CLAUDE.md must ship");
});

test("tarball contains payload/.claude/agents/*.md", () => {
  assert.ok(
    anyIn("payload/.claude/agents", (f) => f.endsWith(".md")),
    "agent files must ship in the payload"
  );
});

test("tarball contains payload/.claude/skills/** SKILL.md", () => {
  // Skills nest one directory deep; check a known skill dir carries its SKILL.md.
  assert.ok(
    has("payload/.claude/skills/aidlc-workflow/SKILL.md"),
    "skills must ship in the payload"
  );
});

test("tarball contains methodology templates under payload/templates/", () => {
  assert.ok(
    has("payload/templates/artifacts/decision-record.md"),
    "artifact templates must ship"
  );
  assert.ok(
    has("payload/templates/hooks/arbiter-gate.sh"),
    "the arbiter-gate hook source must ship"
  );
});

test("tarball contains the shipped design-QA tools under payload/scripts/", () => {
  assert.ok(has("payload/scripts/off-token-lint.mjs"), "off-token-lint must ship");
  assert.ok(
    has("payload/scripts/visual-qa/contrast-check.mjs"),
    "visual-qa tools must ship"
  );
});

test("tarball contains LICENSE and README.md", () => {
  assert.ok(has("LICENSE"), "LICENSE must ship in the tarball");
  assert.ok(has("README.md"), "README.md must ship in the tarball");
});

// --- What MUST NOT be inside the tarball -------------------------------------

test("tarball omits the installer's own test/ directory", () => {
  assert.ok(!has("test"), "installer test/ must NOT ship to consumers");
});

test("tarball omits the dev-only build scripts/ directory", () => {
  // build-payload.mjs is a build tool, not shipped runtime code.
  assert.ok(!has("scripts"), "installer scripts/ (build tooling) must NOT ship");
});

test("payload/ did not recurse installer/ into itself", () => {
  assert.ok(!has("payload/installer"), "installer/ must not be nested in payload/");
});

test("payload/ omits validation-only scaffolding under scripts/", () => {
  assert.ok(!has("payload/scripts/package.json"), "no scripts/package.json in payload");
  assert.ok(!has("payload/scripts/test"), "no scripts/test in payload");
  assert.ok(!has("payload/scripts/node_modules"), "no node_modules in payload");
});

// --- The extracted package actually installs (dry-run) -----------------------

test("`ai-dlc init --dry-run` from the tarball exits 0 with a plausible plan", () => {
  // Throwaway git repo to install into (nothing is written under --dry-run).
  const repo = mkTmp("aidlc-target-");
  const git = spawnSync("git", ["init", "-q", repo], { encoding: "utf8" });
  assert.equal(git.status, 0, `git init failed: ${git.stderr}`);

  const res = spawnSync(
    process.execPath,
    [join(pkgDir, "bin", "ai-dlc.mjs"), "init", "--dry-run", "--repo", repo],
    { encoding: "utf8" }
  );
  const out = (res.stdout || "") + (res.stderr || "");
  assert.equal(res.status, 0, `init --dry-run must exit 0; got ${res.status}\n${out}`);
  assert.match(out, /payload file\(s\)/, `plan should report payload files\n${out}`);
  assert.match(out, /would create\s+AGENTS\.md/, `plan should scaffold AGENTS.md\n${out}`);
  assert.match(out, /\[dry-run\] nothing was written\./, `must be a real dry run\n${out}`);
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
cleanup();
console.log(`\npack-smoke.test.mjs: ${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);

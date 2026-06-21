#!/usr/bin/env node
// Lint AI-DLC triggering/behavior EVAL RECORDS. Zero-dependency: Node built-ins
// only.
//
// SCOPE — read this first. This is a DETERMINISTIC, CI-runnable linter over the
// eval-record FILES. It asserts that the records are well-formed and avoid known
// fakes. It does NOT run the evals, does NOT invoke a model, and makes NO claim
// that any skill/agent was behaviorally verified to trigger. Behavioral
// verification is the separate, human-plus-fresh-session eval loop described in
// the `skill-evaluation` / `kit-validation` skills. This gate only proves the
// eval SUITE is honest and complete enough to be worth running.
//
// RECORD FORMAT (JSONL — one JSON object per line under the evals roots):
//   - Files: product/evals/**/*.jsonl (layer 2) and evals/**/*.jsonl (layer 1)
//   - Blank lines and lines whose first non-space char is `#` are ignored
//     (lets authors annotate suites).
//   - Each remaining line is one record object with these fields:
//       id          string   REQUIRED. Unique across all records.
//       target      string   REQUIRED. The skill or agent name under test.
//       prompt      string   REQUIRED. The realistic user request to evaluate.
//       expectation string   REQUIRED. The pass criterion a human/evaluator judges.
//       kind        string   REQUIRED. One of:
//                              "positive"            should trigger `target`
//                              "near-miss-negative"  plausible but must NOT trigger
//                              "behavior"            once triggered, does it behave
//
// QUALITY RULES enforced (a violation fails CI):
//   1. Each record has all required fields with the right types and a valid
//      `kind`.
//   2. `id` is unique.
//   3. Anti-fake — the "skill-name-in-query" tell: for the TRIGGERING kinds
//      (`positive`, `near-miss-negative`) the `prompt` must NOT contain the
//      `target` name (case-insensitive, whole-token). A prompt that names the
//      skill/agent trivially "passes" triggering and proves nothing.
//   4. Coverage — every `target` that has ANY triggering record MUST have at
//      least one `positive` AND at least one `near-miss-negative`. (A target
//      that only has `behavior` records is allowed — it is not a triggering
//      target.)
//
// Skips cleanly when no eval records exist yet.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Two evals roots: layer-2 (the deliverable product) under product/evals, and
// layer-1 (the kit-builder itself) under evals. Each is scanned if present and
// skipped cleanly when absent.
const EVALS_DIRS = [join(REPO_ROOT, "product", "evals"), join(REPO_ROOT, "evals")];

const TRIGGERING_KINDS = new Set(["positive", "near-miss-negative"]);
const ALL_KINDS = new Set(["positive", "near-miss-negative", "behavior"]);

const failures = [];
const fail = (where, reason) => failures.push({ where, reason });

const isString = (v) => typeof v === "string";

/** Recursively collect *.jsonl files under a directory. */
function listJsonl(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsonl(abs));
    else if (ent.isFile() && ent.name.endsWith(".jsonl")) out.push(abs);
  }
  return out;
}

/** True if `prompt` mentions `name` as a whole token (case-insensitive). */
function mentionsTarget(prompt, name) {
  // Whole-token match: the name bounded by non-alphanumeric (treating `-`/`_`
  // as part of the token so "kit-review" must match exactly, not "kit").
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^A-Za-z0-9_-])${escaped}(?:[^A-Za-z0-9_-]|$)`, "i");
  return re.test(prompt);
}

const files = EVALS_DIRS.flatMap((dir) => listJsonl(dir));

// target -> Set of kinds seen (for coverage). Only built from valid records.
const targetKinds = new Map();
const seenIds = new Map(); // id -> first location, to flag duplicates.
let recordCount = 0;

for (const abs of files) {
  if (!statSync(abs).isFile()) continue;
  const rel = relative(REPO_ROOT, abs);
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const loc = `${rel}:${i + 1}`;

    let rec;
    try {
      rec = JSON.parse(line);
    } catch (e) {
      fail(loc, `invalid JSON: ${e.message}`);
      continue;
    }
    if (rec === null || typeof rec !== "object" || Array.isArray(rec)) {
      fail(loc, "record must be a JSON object");
      continue;
    }
    recordCount++;

    // Required string fields.
    let ok = true;
    for (const f of ["id", "target", "prompt", "expectation", "kind"]) {
      if (!(f in rec)) {
        fail(loc, `missing required field \`${f}\``);
        ok = false;
      } else if (!isString(rec[f]) || rec[f].trim() === "") {
        fail(loc, `\`${f}\` must be a non-empty string`);
        ok = false;
      }
    }
    if (!ok) continue;

    if (!ALL_KINDS.has(rec.kind)) {
      fail(
        loc,
        `\`kind\` "${rec.kind}" must be one of positive, near-miss-negative, behavior`
      );
      continue;
    }

    // Unique id.
    if (seenIds.has(rec.id)) {
      fail(loc, `duplicate \`id\` "${rec.id}" (first seen at ${seenIds.get(rec.id)})`);
    } else {
      seenIds.set(rec.id, loc);
    }

    // Anti-fake: triggering prompts must not name the target.
    if (TRIGGERING_KINDS.has(rec.kind) && mentionsTarget(rec.prompt, rec.target)) {
      fail(
        loc,
        `triggering \`prompt\` names its target "${rec.target}" — a skill-name-in-query fake; rephrase so the prompt does not mention the target`
      );
    }

    // Record coverage.
    if (!targetKinds.has(rec.target)) targetKinds.set(rec.target, new Set());
    targetKinds.get(rec.target).add(rec.kind);
  }
}

// Coverage: a target with ANY triggering record needs both a positive and a
// near-miss-negative.
for (const [target, kinds] of targetKinds) {
  const hasTriggering = [...kinds].some((k) => TRIGGERING_KINDS.has(k));
  if (!hasTriggering) continue;
  if (!kinds.has("positive")) {
    fail(`target:${target}`, `triggering target "${target}" has no \`positive\` eval`);
  }
  if (!kinds.has("near-miss-negative")) {
    fail(
      `target:${target}`,
      `triggering target "${target}" has no \`near-miss-negative\` eval`
    );
  }
}

console.log("Eval-record lint");
if (files.length === 0) {
  console.log(
    "  no eval records found (product/evals/**/*.jsonl, evals/**/*.jsonl) — skipping"
  );
  console.log("PASS: nothing to lint");
  process.exit(0);
}
console.log(
  `  linted ${recordCount} record(s) across ${files.length} file(s); ${targetKinds.size} target(s)`
);
console.log(
  "  note: record-QUALITY lint only — does NOT verify triggering behavior"
);

if (failures.length === 0) {
  console.log("PASS: all eval records well-formed");
  process.exit(0);
}

console.log(`FAIL: ${failures.length} problem(s):`);
for (const { where, reason } of failures) {
  console.log(`  ${where}: ${reason}`);
}
process.exit(1);

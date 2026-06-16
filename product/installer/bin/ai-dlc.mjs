#!/usr/bin/env node
// AI-DLC installer CLI.
//
//   npx ai-dlc init      scaffold the kit into the current repo
//   npx ai-dlc update    re-apply + merge to the current kit version
//   npx ai-dlc <cmd> --dry-run    print the plan; touch nothing
//
// init and update share one idempotent, version-stamped, drift-detecting engine
// (ADR-0006). `init` on an already-initialized repo behaves like `update`.
// Zero runtime dependencies (Node built-ins only).

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolvePayloadRoot, buildPayload } from "../lib/payload.mjs";
import { resolveKitVersion } from "../lib/version.mjs";
import {
  MANIFEST_REL,
  loadManifest,
  serializeManifest,
} from "../lib/manifest.mjs";
import { planActions, executeAction } from "../lib/apply.mjs";
import { planSettingsMerge, SETTINGS_REL } from "../lib/settings.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.find((a) => !a.startsWith("-")) ?? "";
  const dryRun = args.includes("--dry-run") || args.includes("-n");
  const help = args.includes("--help") || args.includes("-h");
  let repoRoot = process.cwd();
  const rootIdx = args.indexOf("--repo");
  if (rootIdx !== -1 && args[rootIdx + 1]) repoRoot = args[rootIdx + 1];
  return { cmd, dryRun, help, repoRoot };
}

const USAGE = `ai-dlc — install and update the AI-DLC kit in your repository

Usage:
  npx ai-dlc init [--dry-run]      Scaffold the kit into this repo.
  npx ai-dlc update [--dry-run]    Update an existing install to the current kit.

Options:
  --dry-run, -n   Print the plan without writing anything.
  --repo <dir>    Operate on <dir> instead of the current directory.
  --help, -h      Show this help.

init and update are idempotent and version-stamped: re-running with no kit change
is a no-op. Consumer-modified kit files and pre-existing AGENTS.md / CLAUDE.md are
never clobbered — a .new sidecar is written alongside with merge instructions.`;

function summarize(results) {
  const counts = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return counts;
}

function main() {
  const { cmd, dryRun, help, repoRoot } = parseArgs(process.argv);

  if (help || cmd === "" || (cmd !== "init" && cmd !== "update")) {
    console.log(USAGE);
    process.exit(cmd === "" || help ? 0 : 1);
  }

  const payloadRoot = resolvePayloadRoot();
  const kitVersion = resolveKitVersion(payloadRoot);
  const entries = buildPayload(payloadRoot);
  const manifest = loadManifest(repoRoot);

  const initializing = !existsSync(join(repoRoot, MANIFEST_REL));
  const effectiveCmd =
    cmd === "init" && !initializing ? "update (repo already initialized)" : cmd;

  const tag = dryRun ? "[dry-run] " : "";
  console.log(
    `${tag}ai-dlc ${effectiveCmd} -> ${repoRoot}\n` +
      `${tag}kit version ${kitVersion}; ${entries.length} payload file(s)\n`
  );

  // --- File actions ---------------------------------------------------------
  const actions = planActions(entries, repoRoot, manifest);
  const results = [];
  const sidecars = [];
  for (const action of actions) {
    const r = executeAction(action, repoRoot, manifest, { dryRun });
    results.push(r);
    const verb = dryRun ? "would " : "";
    if (r.kind === "create") console.log(`  ${verb}create  ${r.dest}`);
    else if (r.kind === "update") console.log(`  ${verb}update  ${r.dest}`);
    else if (r.kind === "marker-update")
      console.log(`  ${verb}merge   ${r.dest} (${r.note})`);
    else if (r.kind === "drift-sidecar" || r.kind === "coowned-sidecar") {
      console.log(`  ${verb}PRESERVE ${r.dest} -> wrote ${r.dest}.new (${r.note})`);
      sidecars.push(r);
    }
    // noop / noop-restamp are silent unless verbose.
  }

  // --- Hook wiring into .claude/settings.json -------------------------------
  let settingsChanged = false;
  try {
    const plan = planSettingsMerge(repoRoot);
    if (plan.changed) {
      settingsChanged = true;
      const verb = dryRun ? "would wire" : "wired";
      console.log(`  ${verb} arbiter-gate hook into ${SETTINGS_REL}`);
      if (!dryRun) {
        const abs = join(repoRoot, SETTINGS_REL);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, plan.content);
      }
    }
  } catch (e) {
    console.error(`  ! could not wire hook: ${e.message}`);
  }

  // --- Stamp manifest -------------------------------------------------------
  manifest.kitVersion = kitVersion;
  manifest.updatedAt = new Date().toISOString();
  if (!dryRun) {
    const abs = join(repoRoot, MANIFEST_REL);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, serializeManifest(manifest));
  }

  // --- Report ---------------------------------------------------------------
  const counts = summarize(results);
  const parts = Object.entries(counts)
    .filter(([k]) => k !== "noop")
    .map(([k, n]) => `${n} ${k}`);
  const noop = counts.noop ?? 0;
  console.log(
    `\n${tag}summary: ${parts.length ? parts.join(", ") : "no file changes"}` +
      `${noop ? `, ${noop} unchanged` : ""}` +
      `${settingsChanged ? ", hook wired" : ""}.`
  );

  if (sidecars.length) {
    console.log(
      `\n${tag}ACTION NEEDED — ${sidecars.length} file(s) were preserved. ` +
        "Review each .new sidecar and merge by hand:"
    );
    for (const r of sidecars) {
      console.log(
        `  - ${r.dest}: compare with ${r.dest}.new and fold in any wanted changes, ` +
          `then delete ${r.dest}.new. To make future updates automatic, wrap the ` +
          "kit-managed section in <!-- ai-dlc:begin --> / <!-- ai-dlc:end --> markers."
      );
    }
  }

  if (dryRun) console.log("\n[dry-run] nothing was written.");
}

main();

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
import { planActions, planRemovals, executeAction } from "../lib/apply.mjs";
import {
  planSettingsMerge,
  planRtkSettings,
  SETTINGS_REL,
} from "../lib/settings.mjs";
import { planRtk, removeRtk, RTK_VERSION } from "../lib/rtk.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args.find((a) => !a.startsWith("-")) ?? "";
  const dryRun = args.includes("--dry-run") || args.includes("-n");
  const help = args.includes("--help") || args.includes("-h");
  const withRtk = args.includes("--with-rtk");
  const withoutRtk = args.includes("--without-rtk");
  // AIDLC_INSTALL_RTK=1 is the non-interactive equivalent of --with-rtk (a
  // dedicated INSTALL-time signal). It is deliberately DISTINCT from
  // AIDLC_ENABLE_RTK, which is ONLY the RUNTIME activation gate read inside
  // rtk-wrap.sh — the install-time enable and the runtime kill switch must not
  // share a variable, or removing rtk (`--without-rtk`) could be silently undone
  // by an env var meant only to activate an already-installed hook. An explicit
  // --without-rtk still wins over this (resolved in resolveRtkEnabled).
  const envInstall = process.env.AIDLC_INSTALL_RTK === "1";
  let repoRoot = process.cwd();
  const rootIdx = args.indexOf("--repo");
  if (rootIdx !== -1 && args[rootIdx + 1]) repoRoot = args[rootIdx + 1];
  return { cmd, dryRun, help, repoRoot, withRtk, withoutRtk, envInstall };
}

/**
 * Resolve the effective rtk-enabled state for this run:
 *   explicit --without-rtk                 -> false, and STICKY (main() persists
 *                                             enabled:false so a later env var
 *                                             cannot re-enable it)
 *   explicit --with-rtk / AIDLC_INSTALL_RTK -> true
 *   otherwise                              -> the manifest's persisted choice —
 *                                             including a sticky enabled:false (so
 *                                             a plain `update` after `init
 *                                             --with-rtk` keeps rtk, and after
 *                                             `--without-rtk` stays off)
 *   default                                -> false
 *
 * A persisted enabled:false is NEVER flipped by any env var. Re-enabling requires
 * an explicit --with-rtk or AIDLC_INSTALL_RTK=1. AIDLC_ENABLE_RTK is intentionally
 * NOT consulted here — it is only the runtime activation gate in rtk-wrap.sh.
 */
function resolveRtkEnabled({ withRtk, withoutRtk, envInstall }, manifest) {
  if (withoutRtk) return false;
  if (withRtk || envInstall) return true;
  return Boolean(manifest?.rtk?.enabled);
}

const USAGE = `ai-dlc — install and update the AI-DLC kit in your repository

Usage:
  npx ai-dlc init [--dry-run]      Scaffold the kit into this repo.
  npx ai-dlc update [--dry-run]    Update an existing install to the current kit.

Options:
  --dry-run, -n     Print the plan without writing anything.
  --with-rtk        Install the OPT-IN rtk (Rust Token Killer) output-compression
                    hook. Equivalently, set AIDLC_INSTALL_RTK=1 (install-time).
  --without-rtk     Disable rtk: remove its hook and files (kept otherwise). This
                    choice is sticky — no env var re-enables it; pass --with-rtk.
  --repo <dir>      Operate on <dir> instead of the current directory.
  --help, -h        Show this help.

init and update are idempotent and version-stamped: re-running with no kit change
is a no-op. Consumer-modified kit files and pre-existing AGENTS.md / CLAUDE.md are
never clobbered — a .new sidecar is written alongside with merge instructions.

rtk is OPT-IN and OFF by default. Two independent switches: --with-rtk /
AIDLC_INSTALL_RTK=1 INSTALLS the hook (still INERT); AIDLC_ENABLE_RTK=1 in your
environment ACTIVATES it at RUNTIME. A plain \`update\` preserves your prior rtk
choice (recorded in .ai-dlc/manifest.json).`;

function summarize(results) {
  const counts = {};
  for (const r of results) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  return counts;
}

function main() {
  const opts = parseArgs(process.argv);
  const { cmd, dryRun, help, repoRoot } = opts;

  if (help || cmd === "" || (cmd !== "init" && cmd !== "update")) {
    console.log(USAGE);
    process.exit(cmd === "" || help ? 0 : 1);
  }

  const payloadRoot = resolvePayloadRoot();
  const kitVersion = resolveKitVersion(payloadRoot);
  const manifest = loadManifest(repoRoot);

  // Resolve the OPT-IN rtk state from flags/env, falling back to the manifest's
  // persisted choice so a plain `update` preserves it. Then build the payload with
  // rtk files included only when enabled — the default path is unchanged.
  const rtkEnabled = resolveRtkEnabled(opts, manifest);
  const rtkPlan = planRtk({ repoRoot, enabled: rtkEnabled, manifest });
  const entries = buildPayload(payloadRoot, { withRtk: rtkEnabled });

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

  // --- rtk file removal (bounded; only when disabling a prior opt-in) --------
  // When rtk is NOT enabled but was previously installed, delete the rtk-managed
  // files and drop their manifest stamps. Never runs on a fresh default install
  // (no prior rtk state -> nothing to remove), keeping that path untouched.
  const rtkRemovals = [];
  if (!rtkEnabled && rtkPlan.wasEnabled) {
    const removalActions = planRemovals(removeRtk().dests, repoRoot, manifest);
    for (const action of removalActions) {
      const r = executeAction(action, repoRoot, manifest, { dryRun });
      results.push(r);
      if (r.kind === "remove") {
        const verb = dryRun ? "would remove" : "removed";
        console.log(`  ${verb}  ${r.dest} (rtk)`);
        rtkRemovals.push(r);
      }
    }
  }

  // --- Hook wiring into .claude/settings.json -------------------------------
  // The arbiter gate is the whole point of the kit's enforcement. If we cannot
  // wire it, that is a HARD failure (M1): never a quiet `!` line above a green
  // summary. We record it and exit non-zero after reporting.
  let settingsChanged = false;
  let gateError = null;
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
    gateError = e;
  }

  // --- rtk hook wiring into .claude/settings.json (OPT-IN, not a hard gate) --
  // Add the rtk hook when enabled; strip ONLY the rtk entry when disabled. rtk is
  // optional, so a failure here is reported but never fails the install the way a
  // missing arbiter gate does. Runs AFTER the arbiter merge so it reads the
  // just-written settings.json (non-dry-run) and adds/removes a separate entry.
  let rtkSettingsChanged = false;
  try {
    const plan = planRtkSettings(repoRoot, rtkEnabled);
    if (plan.changed) {
      rtkSettingsChanged = true;
      const action = rtkEnabled ? "wire" : "remove";
      const verb = dryRun ? `would ${action}` : action === "wire" ? "wired" : "removed";
      console.log(`  ${verb} rtk hook ${rtkEnabled ? "into" : "from"} ${SETTINGS_REL}`);
      if (!dryRun) {
        const abs = join(repoRoot, SETTINGS_REL);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, plan.content);
      }
    }
  } catch (e) {
    console.error(`  WARNING: could not update the rtk hook in ${SETTINGS_REL}: ${e.message}`);
  }

  // --- Ensure the records directory the hook scans exists -------------------
  // The arbiter-gate hook reads .ai-dlc/records/; the quickstart documents that
  // layout. Create it (with a .gitkeep so it survives commit) so the path is
  // real even before the first Decision Record is written.
  const RECORDS_REL = ".ai-dlc/records";
  if (!dryRun) {
    const recordsAbs = join(repoRoot, RECORDS_REL);
    mkdirSync(recordsAbs, { recursive: true });
    const keep = join(recordsAbs, ".gitkeep");
    if (!existsSync(keep)) writeFileSync(keep, "");
  } else {
    console.log(`  would ensure ${RECORDS_REL}/ exists`);
  }

  // --- Stamp manifest -------------------------------------------------------
  manifest.kitVersion = kitVersion;
  manifest.updatedAt = new Date().toISOString();
  // Persist the OPT-IN rtk choice so `update` preserves it. Write the block when
  // opting in, when an explicit --without-rtk makes the OFF choice STICKY (so no
  // env var can later re-enable it), or when a prior opt-in is being turned off
  // (record enabled:false). A fresh default install (no flag) leaves manifest.rtk
  // unset (no block written), keeping the default manifest byte-for-byte unchanged.
  if (rtkEnabled) {
    manifest.rtk = rtkPlan.manifestRtk; // { enabled: true, version }
  } else if (opts.withoutRtk || rtkPlan.wasEnabled || manifest.rtk) {
    manifest.rtk = { enabled: false, version: RTK_VERSION };
  }
  if (!dryRun) {
    const abs = join(repoRoot, MANIFEST_REL);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, serializeManifest(manifest));
  }

  // --- Report ---------------------------------------------------------------
  const counts = summarize(results);
  const parts = Object.entries(counts)
    .filter(([k]) => k !== "noop" && k !== "noop-restamp" && k !== "remove-noop")
    .map(([k, n]) => `${n} ${k}`);
  const noop = counts.noop ?? 0;
  console.log(
    `\n${tag}summary: ${parts.length ? parts.join(", ") : "no file changes"}` +
      `${noop ? `, ${noop} unchanged` : ""}` +
      `${settingsChanged ? ", arbiter hook wired" : ""}` +
      `${rtkSettingsChanged ? `, rtk hook ${rtkEnabled ? "wired" : "removed"}` : ""}.`
  );

  // --- rtk status line ------------------------------------------------------
  if (rtkEnabled) {
    console.log(
      `\n${tag}rtk (Rust Token Killer) is ENABLED (pinned ${RTK_VERSION}) but INSTALLED INERT.\n` +
        `${tag}  It does NOTHING until you set AIDLC_ENABLE_RTK=1 in your environment at\n` +
        `${tag}  runtime. Install the binary via .ai-dlc/rtk/install-rtk.sh (needs cargo).`
    );
  } else if (rtkRemovals.length || (rtkPlan.wasEnabled && !rtkEnabled)) {
    console.log(
      `\n${tag}rtk (Rust Token Killer) is DISABLED — its hook and files were removed. ` +
        "The arbiter gate and your other hooks are untouched."
    );
  }

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

  // --- M1: gate-wiring failure is a HARD, unmissable failure ----------------
  if (gateError) {
    console.error(
      "\n========================================================\n" +
        "  GATE NOT ACTIVE — the arbiter-gate hook was NOT wired.\n" +
        "========================================================\n" +
        `  Reason: ${gateError.message}\n` +
        `  Phase-transition gating is INACTIVE until ${SETTINGS_REL} registers\n` +
        "  the hook. Fix the cause above and re-run `npx ai-dlc init`."
    );
    process.exit(1);
  }
}

main();

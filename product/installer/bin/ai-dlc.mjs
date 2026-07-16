#!/usr/bin/env node
// AI-DLC installer CLI.
//
//   npx @kabaka/ai-dlc init      scaffold the kit into the current repo
//   npx @kabaka/ai-dlc update    re-apply + merge to the current kit version
//   npx @kabaka/ai-dlc <cmd> --dry-run    print the plan; touch nothing
//
// init and update share one idempotent, version-stamped, drift-detecting engine
// (ADR-0006). `init` on an already-initialized repo behaves like `update`.
// Zero runtime dependencies (Node built-ins only).

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolvePayloadRoot, buildPayload } from "../lib/payload.mjs";
import { resolveKitVersion } from "../lib/version.mjs";
import {
  MANIFEST_REL,
  loadManifest,
  serializeManifest,
  hash,
} from "../lib/manifest.mjs";
import {
  planActions,
  planRemovals,
  executeAction,
  MARK_BEGIN,
  MARK_END,
} from "../lib/apply.mjs";
import {
  planSettingsMerge,
  planRtkSettings,
  SETTINGS_REL,
} from "../lib/settings.mjs";
import {
  planRtk,
  removeRtk,
  reconcileClaudeRtkImport,
  reconciledDests,
  RTK_IMPORT_LINE,
  RTK_VERSION,
} from "../lib/rtk.mjs";

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
  npx @kabaka/ai-dlc init [--dry-run]      Scaffold the kit into this repo.
  npx @kabaka/ai-dlc update [--dry-run]    Update an existing install to the current kit.

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
  // CLAUDE.md's managed marker region is owned by the post-apply rtk reconcile
  // below, NOT the generic engine. Pass that ownership IN (never inferred) so the
  // engine defers the region to the reconcile while still protecting the file's
  // first-touch / marker-less-drift cases with a `.new` sidecar.
  const reconciled = new Set(reconciledDests());
  const actions = planActions(entries, repoRoot, manifest, reconciled);
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

  // --- rtk CLAUDE.md context import (@-import) reconcile --------------------
  // rtk's value as agent context depends on CLAUDE.md importing RTK.md. When the
  // installer MANAGES the consumer's CLAUDE.md (stamped in the manifest AND our
  // markers are present on disk), surgically add/remove the `@.ai-dlc/rtk/RTK.md`
  // import INSIDE the managed marker region only (content outside the markers is
  // untouched), then RE-STAMP the manifest to the new on-disk bytes so a later run
  // sees no drift and emits no spurious `.new` sidecar. When CLAUDE.md is
  // consumer-OWNED (a `.new` sidecar case: not stamped, or marker-less), we NEVER
  // edit it — we record the need so the summary prints a one-line manual instruction.
  const CLAUDE_REL = "CLAUDE.md";
  let rtkClaudeManual = false; // consumer-owned CLAUDE.md, enabling: add the import
  let rtkClaudeManualRemove = false; // consumer-owned CLAUDE.md, disabling: drop a dangling import
  {
    const claudeAbs = join(repoRoot, CLAUDE_REL);
    if (existsSync(claudeAbs)) {
      const onDisk = readFileSync(claudeAbs, "utf8");
      const stamped = Boolean(manifest.files[CLAUDE_REL]);
      const managed =
        stamped && onDisk.includes(MARK_BEGIN) && onDisk.includes(MARK_END);
      if (managed) {
        // The reconcile is the SINGLE AUTHORITY over the managed region. Compute the
        // DESIRED region from the shipped payload baseline (so a baseline change
        // propagates — no freeze) plus the import iff rtk is enabled.
        const payloadClaude = readFileSync(join(payloadRoot, CLAUDE_REL), "utf8");
        const { changed, content } = reconcileClaudeRtkImport(
          onDisk,
          rtkEnabled,
          payloadClaude
        );
        if (changed) {
          const verb = dryRun ? "would update" : "updated";
          console.log(
            `  ${verb} rtk context import in ${CLAUDE_REL} ` +
              `(${rtkEnabled ? "added" : "removed"} ${RTK_IMPORT_LINE})`
          );
        }
        // Persist ONLY on a real (non-dry-run) run: write the reconciled region when
        // it changed, and ALWAYS re-stamp CLAUDE.md to the current on-disk bytes so
        // out-of-marker consumer drift is adopted as the new baseline and the next
        // run is a clean no-op. `content` == the on-disk bytes when unchanged, so the
        // stamp always equals the on-disk hash after a run (no false drift). In
        // dry-run we touch NEITHER the disk NOR the in-memory manifest.
        if (!dryRun) {
          if (changed) writeFileSync(claudeAbs, content);
          manifest.files[CLAUDE_REL] = { hash: hash(content), tier: "co-owned" };
        }
      } else {
        // Consumer-owned / marker-less CLAUDE.md we must NEVER edit in place. Print
        // an accurate manual instruction in whichever direction applies.
        const hasImport = onDisk
          .split("\n")
          .some((l) => l.trim() === RTK_IMPORT_LINE);
        if (rtkEnabled && !hasImport) rtkClaudeManual = true;
        // Removal instruction ONLY on an actual disable TRANSITION: rtk was enabled
        // before this run (`rtkPlan.wasEnabled`, from the manifest's prior rtk state)
        // and is now off. Without this guard a fresh `init` on a repo whose
        // consumer-authored CLAUDE.md merely happens to contain the import would
        // falsely claim RTK.md was removed (it was never installed), and every later
        // sticky-off `update` (manifest already enabled:false -> wasEnabled false)
        // would re-nag about a line the consumer owns.
        else if (!rtkEnabled && hasImport && rtkPlan.wasEnabled)
          rtkClaudeManualRemove = true;
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

  // Consumer-owned CLAUDE.md we could not edit: tell them the exact line to add so
  // rtk loads as agent context. The `.new` sidecar is the STATIC payload whose region
  // is comment-only — it does NOT contain the import — so the message names the exact
  // line to add rather than implying the sidecar shows it.
  if (rtkClaudeManual) {
    console.log(
      `\n${tag}rtk enabled: add \`${RTK_IMPORT_LINE}\` to your ${CLAUDE_REL} to load rtk ` +
        `as agent context. Your ${CLAUDE_REL} is consumer-owned, so it was not edited; a ` +
        `${CLAUDE_REL}.new sidecar shows the kit's managed layout (the import is NOT in it — ` +
        `add the exact line above yourself).`
    );
  }

  // Symmetric case: rtk was disabled but a consumer-owned CLAUDE.md still imports the
  // now-removed RTK.md. Tell them to remove the dangling line (we never edit their file).
  if (rtkClaudeManualRemove) {
    console.log(
      `\n${tag}rtk disabled: your consumer-owned ${CLAUDE_REL} still contains ` +
        `\`${RTK_IMPORT_LINE}\`, which now points at a removed file. Remove that line from ` +
        `${CLAUDE_REL} to avoid a dangling import.`
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
        "  the hook. Fix the cause above and re-run `npx @kabaka/ai-dlc init`."
    );
    process.exit(1);
  }
}

main();

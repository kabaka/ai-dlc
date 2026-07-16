// rtk (Rust Token Killer) planning for the AI-DLC installer — OPT-IN.
//
// All rtk-specific knowledge lives here so the core payload/apply/settings code
// stays clean and the default (no-rtk) install path is byte-for-byte unchanged.
// rtk is enabled only when the consumer opts in (`--with-rtk`, `AIDLC_INSTALL_RTK=1`
// at install time, or a persisted manifest choice); see bin/ai-dlc.mjs.
// (`AIDLC_ENABLE_RTK` is NOT an install signal — it is only the runtime gate in
// rtk-wrap.sh.)
//
// What rtk adds when enabled:
//   - .ai-dlc/hooks/rtk-wrap.sh    (0755) — the PreToolUse wrapper (runtime-gated)
//   - .ai-dlc/rtk/install-rtk.sh   (0755) — the cloud setup-script installer
//   - .ai-dlc/rtk/RTK.md           (kit)  — the rtk context doc. When the installer
//                                            MANAGES the consumer's CLAUDE.md (it
//                                            created/stamped it and our markers are
//                                            present), enabling rtk injects an
//                                            `@.ai-dlc/rtk/RTK.md` import into the
//                                            managed marker region, so this doc IS
//                                            loaded as agent context. For a
//                                            consumer-OWNED CLAUDE.md we never edit,
//                                            it stays reference until they add that
//                                            line by hand (the installer prints the
//                                            one-line instruction). See
//                                            reconcileClaudeRtkImport below.
//   - a SEPARATE PreToolUse/Bash hook entry in .claude/settings.json (settings.mjs)
//   - an `rtk: { enabled, version }` block in .ai-dlc/manifest.json
//
// The runtime activation gate is authoritative and lives in rtk-wrap.sh: even once
// installed, the wrapper is INERT unless AIDLC_ENABLE_RTK=1 is set at runtime.

import { join } from "node:path";
import { spliceMarkers, extractMarkerRegion } from "./apply.mjs";

// The `@`-import that loads the rtk context doc (RTK.md) as agent context. Landed
// INSIDE CLAUDE.md's managed marker region when rtk is enabled and the installer
// manages CLAUDE.md; stripped from that region when rtk is disabled.
//
// Path form: a repo-root CLAUDE.md `@`-import resolves RELATIVE TO the importing
// file (per Claude Code memory docs), so `@.ai-dlc/rtk/RTK.md` resolves to
// <repo-root>/.ai-dlc/rtk/RTK.md — exactly where RTK.md lands. It mirrors the
// existing `@AGENTS.md`, is an IN-REPO import (no external-import approval dialog),
// and sits outside any code fence/backticks so it is parsed as an import.
export const RTK_IMPORT_LINE = "@.ai-dlc/rtk/RTK.md";

// The consumer-repo-relative dest of the orchestrator entry file whose managed
// marker region this module's reconcile OWNS. Threaded into the apply engine's
// `reconciledDests` so the generic engine defers that region to reconcileClaudeRtkImport.
export const CLAUDE_REL = "CLAUDE.md";

/**
 * The co-owned dests whose managed marker region is owned by a post-apply
 * reconciler (this module's reconcileClaudeRtkImport), not the generic apply
 * engine. Today only CLAUDE.md. The bin passes `new Set(reconciledDests())` into
 * planActions so ownership is explicit rather than inferred from a content diff.
 */
export function reconciledDests() {
  return [CLAUDE_REL];
}

// The pinned rtk release. Single source of truth for the installer side; the
// shell installer (install-rtk.sh) pins the same version independently in its own
// RTK_VERSION / RTK_REV variables (it runs standalone in a cloud setup script and
// cannot import from this module).
export const RTK_VERSION = "v0.43.0";

// The IMMUTABLE commit the pin resolves to. We install by --rev <SHA>, never by
// the mutable tag, so a moved/re-pushed tag cannot change what we build. This is
// the canonical rev; install-rtk.sh keeps a byte-identical RTK_REV in sync.
//   rtk v0.43.0
export const RTK_REV = "5a7880d404db8364d602f2ecdc41dd790f64013f";

// Canonical descriptors for the files rtk lands in a consumer repo. `srcRel` is
// relative to the payload root (product/ in-repo, or installer/payload/ when
// published). Tiers match apply.mjs: "executable" -> mode 0755, "kit" -> node/text.
const RTK_FILES = [
  {
    srcRel: "templates/hooks/rtk-wrap.sh",
    dest: ".ai-dlc/hooks/rtk-wrap.sh",
    tier: "executable",
  },
  {
    srcRel: "templates/rtk/install-rtk.sh",
    dest: ".ai-dlc/rtk/install-rtk.sh",
    tier: "executable",
  },
  {
    srcRel: "templates/rtk/RTK.md",
    dest: ".ai-dlc/rtk/RTK.md",
    tier: "kit",
  },
];

/**
 * Resolve rtk payload entries { src, dest, tier } against a payload root, in the
 * same shape buildPayload() uses. payload.mjs appends these ONLY when opted in.
 */
export function rtkPayloadEntries(payloadRoot) {
  return RTK_FILES.map((f) => ({
    src: join(payloadRoot, f.srcRel),
    dest: f.dest,
    tier: f.tier,
  }));
}

/** The consumer-repo dest paths rtk owns (for removal + manifest bookkeeping). */
export function rtkDests() {
  return RTK_FILES.map((f) => f.dest);
}

/**
 * High-level rtk plan for a run. Encapsulates the persisted state and the
 * settings intent so the bin never open-codes rtk decisions.
 *
 * @param {{ repoRoot: string, enabled: boolean, manifest: object }} args
 * @returns {{
 *   enabled: boolean,
 *   version: string,
 *   files: Array<{dest: string, tier: string}>,  // descriptors (tiers) for the payload
 *   settingsIntent: "add" | "remove",            // wire the hook, or strip it
 *   manifestRtk: { enabled: boolean, version: string },
 *   wasEnabled: boolean,                          // rtk was on before this run
 * }}
 */
export function planRtk({ enabled, manifest }) {
  const wasEnabled = Boolean(manifest?.rtk?.enabled) || rtkStamped(manifest);
  return {
    enabled: Boolean(enabled),
    version: RTK_VERSION,
    files: RTK_FILES.map((f) => ({ dest: f.dest, tier: f.tier })),
    settingsIntent: enabled ? "add" : "remove",
    manifestRtk: { enabled: Boolean(enabled), version: RTK_VERSION },
    wasEnabled,
  };
}

/**
 * The removal intent used by `--without-rtk`: the landed rtk files to delete
 * (their manifest stamps are dropped by apply.mjs's bounded "remove" action) and
 * the settings intent to strip the rtk hook. Never touches non-rtk files.
 */
export function removeRtk() {
  return {
    dests: rtkDests(),
    settingsIntent: "remove",
  };
}

/** True if any rtk-owned file is stamped in the manifest (was previously landed). */
function rtkStamped(manifest) {
  const files = manifest?.files;
  if (!files || typeof files !== "object") return false;
  return rtkDests().some((d) => Object.prototype.hasOwnProperty.call(files, d));
}

/**
 * Reconcile CLAUDE.md's MANAGED MARKER REGION to its DESIRED content. The reconcile
 * is the SINGLE AUTHORITY over that region (the generic apply engine defers it here
 * for reconciler-owned dests), so it computes the whole desired region rather than
 * only toggling one line:
 *
 *   desired region = the payload CLAUDE.md's baseline marker-region content
 *                    + the `@.ai-dlc/rtk/RTK.md` import line IFF rtk is enabled
 *
 * Reading the baseline from the SHIPPED payload (not a hardcoded string) means a
 * future kit version whose baseline region changed propagates to an undrifted
 * consumer — no silent freeze — while the import is present/absent per `enabled`.
 * Everything OUTSIDE the markers on disk is preserved byte-for-byte (spliceMarkers
 * only rewrites the region). Reuses apply.mjs's marker parsing rather than
 * re-implementing it.
 *
 * Fail-safe: if the ON-DISK file has no well-formed managed markers (absent, or an
 * end-before-begin / missing marker), returns { changed: false } and does NOT edit
 * — the caller must not touch a marker-less / consumer-owned / malformed CLAUDE.md.
 * If the PAYLOAD lacks markers (shouldn't happen), the on-disk region is used as the
 * baseline so the import toggle still works.
 *
 * Idempotent: a region already equal to desired yields { changed: false }.
 *
 * @param {string} onDisk        current CLAUDE.md contents
 * @param {boolean} enabled      whether rtk is enabled for this run
 * @param {string} payloadClaude the shipped payload CLAUDE.md contents (baseline)
 * @returns {{ changed: boolean, content: string }}
 */
export function reconcileClaudeRtkImport(onDisk, enabled, payloadClaude) {
  // Guard on the ON-DISK markers: never edit a marker-less or malformed file.
  const onDiskRegion = extractMarkerRegion(onDisk);
  if (onDiskRegion === null) return { changed: false, content: onDisk };

  // The desired region is built from the PAYLOAD baseline (so a baseline change
  // propagates), falling back to the on-disk region only if the payload has none.
  const payloadRegion =
    typeof payloadClaude === "string" ? extractMarkerRegion(payloadClaude) : null;
  const baseline = (payloadRegion === null ? onDiskRegion : payloadRegion)
    .split("\n")
    .filter((line) => line.trim() !== RTK_IMPORT_LINE) // never double the import
    .join("\n")
    .trim();
  const nextRegion = enabled
    ? (baseline ? `${baseline}\n${RTK_IMPORT_LINE}` : RTK_IMPORT_LINE)
    : baseline;

  const content = spliceMarkers(onDisk, Buffer.from(nextRegion, "utf8"));
  if (content === null) return { changed: false, content: onDisk };
  return { changed: content !== onDisk, content };
}

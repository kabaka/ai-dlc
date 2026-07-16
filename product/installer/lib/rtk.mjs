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
//   - .ai-dlc/rtk/RTK.md           (kit)  — a human-facing reference doc; NOT
//                                            auto-loaded as agent context (nothing
//                                            imports it), so it is documentation
//                                            about rtk's behavior, not a live
//                                            agent-awareness surface.
//   - a SEPARATE PreToolUse/Bash hook entry in .claude/settings.json (settings.mjs)
//   - an `rtk: { enabled, version }` block in .ai-dlc/manifest.json
//
// The runtime activation gate is authoritative and lives in rtk-wrap.sh: even once
// installed, the wrapper is INERT unless AIDLC_ENABLE_RTK=1 is set at runtime.

import { join } from "node:path";

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

// Version-stamp manifest for the AI-DLC installer (ADR-0006).
//
// On init/update the installer writes `.ai-dlc/manifest.json` in the consumer
// repo recording, per landed file, the SHA-256 the installer wrote. On a later
// run it compares the on-disk hash against this stamp to detect consumer drift
// (installed != stamped) and to make re-runs idempotent (no change -> no write).

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MANIFEST_REL = ".ai-dlc/manifest.json";
const MANIFEST_VERSION = 1; // schema version of this manifest file itself

/** SHA-256 of a buffer or string, hex. */
export function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

/** SHA-256 of a file on disk, or null if absent. */
export function hashFile(absPath) {
  if (!existsSync(absPath)) return null;
  return hash(readFileSync(absPath));
}

/** Load the stamp manifest from the consumer repo, or a fresh empty one. */
export function loadManifest(repoRoot) {
  const abs = join(repoRoot, MANIFEST_REL);
  if (!existsSync(abs)) {
    return { manifestVersion: MANIFEST_VERSION, kitVersion: null, files: {} };
  }
  try {
    const data = JSON.parse(readFileSync(abs, "utf8"));
    if (typeof data !== "object" || data === null) throw new Error("not an object");
    if (typeof data.files !== "object" || data.files === null) data.files = {};
    return data;
  } catch (e) {
    throw new Error(
      `Existing ${MANIFEST_REL} is unreadable (${e.message}). ` +
        "Refusing to proceed so a corrupt stamp can't cause silent clobbering. " +
        "Inspect or remove it, then re-run."
    );
  }
}

/** Serialize a manifest object to stable, pretty JSON with a trailing newline. */
export function serializeManifest(manifest) {
  const ordered = {
    manifestVersion: MANIFEST_VERSION,
    kitVersion: manifest.kitVersion ?? null,
    updatedAt: manifest.updatedAt,
    files: {},
  };
  // Sort file keys for deterministic output (stable diffs / idempotent writes).
  for (const k of Object.keys(manifest.files).sort()) {
    ordered.files[k] = manifest.files[k];
  }
  return JSON.stringify(ordered, null, 2) + "\n";
}

#!/usr/bin/env node
// Assemble installer/payload/ — the published-tarball copy of the kit source.
//
// WHY THIS EXISTS
// ---------------
// The installer lands a fixed set of source files into a consumer repo. It reads
// those files from a "payload root" resolved by lib/payload.mjs::resolvePayloadRoot():
//   1. installer/payload/   (the PUBLISHED npm-package layout), else
//   2. product/             (the in-repo single source of truth).
// In a published npm tarball `product/` is ABSENT, so unless installer/payload/
// exists the installer throws "Could not locate the AI-DLC payload." This script
// builds installer/payload/ so `npx @kabaka/ai-dlc init` works from the tarball.
//
// It is wired as `prepack`, so `npm pack` / `npm publish` regenerate the payload
// automatically; payload/ itself is git-ignored (a generated artifact, never
// committed).
//
// DRIFT-PROOF BY CONSTRUCTION
// ---------------------------
// The copy set is not a hand-maintained list. It is derived from the SAME
// buildPayload() the installer runs, so the payload can never disagree with what
// the installer expects. We enumerate buildPayload(product, { withRtk: true })
// (withRtk:true so the OPT-IN rtk sources also ship — a published --with-rtk
// install must find them) and copy each entry whose SOURCE lives under product/,
// preserving the product-relative directory shape so buildPayload(payload) reads
// back an identical entry set.
//
// EXCLUSIONS fall out automatically:
//   - product/installer/** — the installer's own code (incl. payload-extra/) is
//     never a product-tree source; its one referenced file
//     (payload-extra/scripts-README.md) is read from INSTALLER_ROOT at install
//     time and ships via package.json "files", so it is NOT copied here.
//   - validation-only scaffolding already fenced out in payload.mjs
//     (product/scripts/package.json, the lockfile, node_modules/, test/, and any
//     non-.mjs under scripts/) never appears as a buildPayload entry, so it is
//     never copied.
//
// Deterministic + idempotent: payload/ is cleared first, then rebuilt from the
// current product tree, so repeated runs yield byte-identical output.
//
// Zero dependencies (Node built-ins only), ESM.

import {
  copyFileSync,
  mkdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPayload } from "../lib/payload.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // installer/scripts
const INSTALLER_ROOT = resolve(HERE, "..");           // installer/
const PRODUCT_ROOT = resolve(INSTALLER_ROOT, "..");   // product/
const PAYLOAD_DIR = join(INSTALLER_ROOT, "payload");  // installer/payload/

/** True if `abs` is inside `root` (or equal to it). */
function isInside(root, abs) {
  return abs === root || abs.startsWith(root + sep);
}

/**
 * Rebuild installer/payload/ from the product tree.
 *
 * @returns {{ payloadDir: string, files: string[] }} the payload dir and the
 *   sorted list of payload-relative paths that were written.
 */
export function assemblePayload() {
  // Enumerate the exact source set the installer expects. Build against the
  // in-repo product/ root DIRECTLY (never resolvePayloadRoot(), which could pick
  // a stale installer/payload/ from a prior build). withRtk:true so opt-in rtk
  // sources are included in the published package.
  const entries = buildPayload(PRODUCT_ROOT, { withRtk: true });

  // Map each product-sourced entry to a payload-relative path. Skip entries whose
  // source lives under installer/ (e.g. payload-extra/scripts-README.md): those
  // ship via package.json "files" and are read from INSTALLER_ROOT, not payload/.
  const rels = new Set();
  for (const { src } of entries) {
    const abs = resolve(src);
    if (isInside(INSTALLER_ROOT, abs)) continue; // installer-sourced -> not copied
    if (!isInside(PRODUCT_ROOT, abs)) {
      throw new Error(
        `build-payload: refusing to copy a source outside the product tree: ${abs}`
      );
    }
    rels.add(relative(PRODUCT_ROOT, abs));
  }

  // Clear any stale payload so the result is deterministic and idempotent.
  rmSync(PAYLOAD_DIR, { recursive: true, force: true });

  const files = [...rels].sort();
  for (const rel of files) {
    const from = join(PRODUCT_ROOT, rel);
    const to = join(PAYLOAD_DIR, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }

  // Sanity: buildPayload() reading the built payload must resolve every source we
  // just wrote (missing/extra would break a real install). Fail loudly if not.
  const rebuilt = buildPayload(PAYLOAD_DIR, { withRtk: true });
  for (const { src } of rebuilt) {
    const abs = resolve(src);
    if (isInside(INSTALLER_ROOT, abs)) continue; // read from INSTALLER_ROOT, fine
    if (!statExists(abs)) {
      throw new Error(
        `build-payload: assembled payload is missing an expected source: ${abs}`
      );
    }
  }

  return { payloadDir: PAYLOAD_DIR, files };
}

function statExists(abs) {
  try {
    statSync(abs);
    return true;
  } catch {
    return false;
  }
}

// Run when invoked directly (node scripts/build-payload.mjs), not when imported.
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? "")) {
  const { payloadDir, files } = assemblePayload();
  console.log(
    `build-payload: wrote ${files.length} file(s) to ${relative(process.cwd(), payloadDir) || payloadDir}`
  );
}

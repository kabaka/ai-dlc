// The apply engine: turn a payload plan + the stamp manifest into a list of
// per-file ACTIONS, then (optionally) execute them. Implements ADR-0006:
// idempotent, version-stamped, drift-detecting, with the co-owned first-touch
// `.new` sidecar rule.
//
// Action kinds (decided per file by decideAction):
//   create        : dest absent          -> write payload, stamp it.
//   update        : kit-owned, on disk == stamp, payload differs -> overwrite, restamp.
//   noop          : on disk == payload (and stamped) -> nothing to do (idempotent).
//   drift-sidecar : kit-owned, on disk != stamp (consumer edited) AND payload
//                   differs -> DO NOT clobber; write `<dest>.new`, warn.
//   coowned-sidecar: co-owned, dest pre-exists and was NOT installer-stamped
//                   (marker-less consumer file) -> write `<dest>.new` + merge
//                   instructions; never edit in place.
//   marker-update : co-owned, dest contains our managed markers -> update only the
//                   marked region in place (opt-in path).
//   remove        : BOUNDED deletion used ONLY for rtk-managed files during
//                   `--without-rtk` — delete the landed file (if present) and drop
//                   its manifest stamp. Never produced by decideAction; only by
//                   planRemovals, which the bin calls exclusively for rtk dests.
//
// Reconciler-owned dests (see the `reconciledDests` set threaded through
// planActions/decideAction) are the exception to marker handling: for those dests
// the generic engine NEVER writes or reconciles the managed marker region — a
// post-apply reconciler in the bin is the single authority over that region.
// The engine still protects the file's first-touch / marker-less-drift cases with
// the co-owned `.new` sidecar exactly as it does for any other co-owned file.
// Ownership is passed IN explicitly; it is never inferred from a content diff.

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { hash, hashFile } from "./manifest.mjs";

/**
 * Assert that a destination path resolves to inside `repoRoot` and return the
 * resolved absolute path. Mirrors the containment check in
 * scripts/validate-manifests.mjs: refuse anything that escapes the repo (via
 * `..`, an absolute dest, or a symlink-style traversal in the relative path).
 * This runs on a consumer's machine, so a payload dest must never write outside
 * the repo it is installing into.
 */
function assertInsideRepo(repoRoot, destRel) {
  const rootAbs = resolve(repoRoot);
  const destAbs = resolve(rootAbs, destRel);
  if (destAbs !== rootAbs && !destAbs.startsWith(rootAbs + sep)) {
    throw new Error(
      `refusing to write outside the repo: "${destRel}" resolves to "${destAbs}", ` +
        `which is not inside "${rootAbs}".`
    );
  }
  return destAbs;
}

export const MARK_BEGIN = "<!-- ai-dlc:begin -->";
export const MARK_END = "<!-- ai-dlc:end -->";

/**
 * Decide the action for one payload entry given current disk + stamp state.
 *
 * `reconciledDests` is the set of co-owned dests whose managed marker region is
 * owned by a POST-APPLY RECONCILER (today just `CLAUDE.md`, via the rtk
 * `@`-import reconcile in the bin). For a dest in this set the engine never
 * writes or reconciles the marker region itself — it defers to the reconciler —
 * while still protecting the file's first-touch / marker-less-drift cases with a
 * `.new` sidecar. Ownership is passed IN, never inferred from a content diff.
 */
export function decideAction(entry, repoRoot, manifest, reconciledDests = new Set()) {
  // Containment (M2): the resolved dest MUST stay inside repoRoot. Refuse
  // otherwise — never write outside the repo we are installing into.
  const destAbs = assertInsideRepo(repoRoot, entry.dest);
  const payload = readFileSync(entry.src);
  const payloadHash = hash(payload);
  const stamped = manifest.files[entry.dest]; // { hash } | undefined
  const onDiskHash = hashFile(destAbs);

  const base = { entry, destAbs, payload, payloadHash };

  // Brand-new file: just create it (and we then own/stamp this copy).
  if (onDiskHash === null) {
    return { ...base, kind: "create" };
  }

  // Already exactly the payload content -> idempotent no-op. (Also covers the
  // case where the stamp is missing but content matches, e.g. manual install.)
  if (onDiskHash === payloadHash) {
    // Ensure it gets (re)stamped so future drift detection works.
    return { ...base, kind: stamped ? "noop" : "noop-restamp" };
  }

  if (entry.tier === "co-owned") {
    const content = payload.toString("utf8");
    const onDisk = readFileSync(destAbs, "utf8");
    // M3: markers are AUTHORITATIVE only when WE stamped this file (we wrote the
    // markers, per the manifest). For a first-touch / never-stamped consumer
    // file, a crafted <!-- ai-dlc:begin/end --> string must NOT cause an in-place
    // edit — fall back to the `.new` sidecar regardless of marker presence.
    const installerStamped = Boolean(stamped);
    const hasMarkers = onDisk.includes(MARK_BEGIN) && onDisk.includes(MARK_END);

    // Reconciler-owned dest (e.g. CLAUDE.md): a post-apply reconciler is the single
    // authority over the managed marker region. The engine must NOT touch that
    // region — neither force it to the static payload (which would strip the
    // reconciler's import and churn) nor freeze it (which would stop future managed
    // content reaching an undrifted consumer). It DEFERS the region to the
    // reconciler for any file we already own with markers present (drifted or not);
    // the reconciler splices only the region and preserves everything outside it.
    // Ownership is passed IN, not inferred from a content diff.
    if (reconciledDests.has(entry.dest)) {
      if (installerStamped && hasMarkers) {
        return {
          ...base,
          kind: "noop",
          note: "managed marker region deferred to post-apply reconciler",
        };
      }
      // First-touch pre-existing file (never stamped), OR a stamped file whose
      // markers were removed/corrupted: NEVER edit in place -> sidecar. (The bin
      // also prints a manual add/remove instruction for this consumer-owned case.)
      return decideSidecar(base, repoRoot, manifest, "coowned-sidecar", content);
    }

    // --- Non-reconciler co-owned files: the generic marker-update path ---------
    // Undrifted file WE stamped (on disk == our last stamp). The raw-payload match
    // was already handled as a whole-file noop above, so a difference here means the
    // static payload's managed region legitimately changed (a newer kit version).
    // Reconcile ONLY the marked region in place so that change propagates without
    // clobbering the consumer's out-of-marker content; a marker-less co-owned file
    // we own is safe to overwrite wholesale.
    if (installerStamped && onDiskHash === stamped.hash) {
      if (hasMarkers) {
        return { ...base, kind: "marker-update" };
      }
      return { ...base, kind: "update" };
    }

    // Stamped file the consumer DRIFTED (edited) that still carries our markers:
    // update ONLY inside the markers in place, preserving their out-of-marker edits.
    if (installerStamped && hasMarkers) {
      return { ...base, kind: "marker-update" };
    }
    // First-touch pre-existing file (never stamped), OR a stamped+drifted+marker-less
    // file: NEVER edit in place -> sidecar.
    return decideSidecar(base, repoRoot, manifest, "coowned-sidecar", content);
  }

  // kit-owned / executable tiers.
  if (stamped && onDiskHash === stamped.hash) {
    // Consumer hasn't touched it; payload changed -> clean overwrite.
    return { ...base, kind: "update" };
  }
  // Consumer edited a kit-owned file (or it pre-existed un-stamped) AND payload
  // differs -> drift. Do not clobber; write a sidecar.
  return decideSidecar(base, repoRoot, manifest, "drift-sidecar");
}

/**
 * Decide a sidecar action, collapsing to a no-op when the `<dest>.new` sidecar
 * already exists with exactly the payload content. This makes re-running with no
 * kit change a true no-op for co-owned / drifted files: we neither rewrite the
 * sidecar nor re-emit the "ACTION NEEDED" warning.
 */
function decideSidecar(base, repoRoot, manifest, kind, content) {
  const sidecarRel = base.entry.dest + ".new";
  const sidecarAbs = assertInsideRepo(repoRoot, sidecarRel);
  if (hashFile(sidecarAbs) === base.payloadHash) {
    // Sidecar already carries this exact payload -> nothing to do this run.
    return { ...base, kind: "noop", note: "sidecar already current" };
  }
  return { ...base, kind, content };
}

/**
 * Build the full action plan across all payload entries. `reconciledDests` (a Set
 * of co-owned dests whose marker region a post-apply reconciler owns; today just
 * `CLAUDE.md`) is threaded to decideAction so ownership is explicit, not inferred.
 */
export function planActions(entries, repoRoot, manifest, reconciledDests = new Set()) {
  return entries.map((e) => decideAction(e, repoRoot, manifest, reconciledDests));
}

/**
 * Build BOUNDED removal actions for a set of consumer-repo-relative dest paths.
 * Used ONLY for rtk-managed files during `--without-rtk`. Each dest is
 * containment-checked (assertInsideRepo) exactly like a write. A dest that is
 * neither present on disk nor stamped yields a no-op removal (idempotent). This is
 * the only path that deletes files; it is never wired to general payload flow.
 */
export function planRemovals(dests, repoRoot, manifest) {
  return dests.map((dest) => {
    const destAbs = assertInsideRepo(repoRoot, dest);
    const onDisk = existsSync(destAbs);
    const stamped = Boolean(manifest.files[dest]);
    return {
      entry: { dest },
      destAbs,
      kind: onDisk || stamped ? "remove" : "remove-noop",
    };
  });
}

function ensureDir(absFile) {
  mkdirSync(dirname(absFile), { recursive: true });
}

/**
 * Replace the content between markers, preserving the rest of the file. `payload`
 * is a Buffer or string; its trimmed text becomes the new region body. Returns the
 * new whole-file string, or null when the markers are absent/malformed.
 */
export function spliceMarkers(onDisk, payload) {
  const begin = onDisk.indexOf(MARK_BEGIN);
  const end = onDisk.indexOf(MARK_END);
  if (begin === -1 || end === -1 || end < begin) return null;
  const before = onDisk.slice(0, begin + MARK_BEGIN.length);
  const after = onDisk.slice(end);
  return `${before}\n${payload.toString("utf8").trim()}\n${after}`;
}

/**
 * Return the raw text BETWEEN the managed markers (exclusive of the markers), or
 * null when they are absent/malformed. Lets post-apply reconcilers read the current
 * managed region without re-implementing marker parsing.
 */
export function extractMarkerRegion(onDisk) {
  const begin = onDisk.indexOf(MARK_BEGIN);
  const end = onDisk.indexOf(MARK_END);
  if (begin === -1 || end === -1 || end < begin) return null;
  return onDisk.slice(begin + MARK_BEGIN.length, end);
}

/**
 * Execute one action. `dryRun` => compute the effect/messages but touch nothing.
 * Mutates `manifest.files` for actions that (re)stamp. Returns a result row:
 *   { dest, kind, wrote: [paths], note }
 */
export function executeAction(action, repoRoot, manifest, { dryRun }) {
  const { entry, destAbs, payload, payloadHash, kind } = action;
  const wrote = [];
  const removed = [];
  let note = "";

  const stamp = () => {
    manifest.files[entry.dest] = { hash: payloadHash, tier: entry.tier };
  };
  const writeFile = (abs, data, exec) => {
    if (!dryRun) {
      ensureDir(abs);
      writeFileSync(abs, data);
      if (exec) chmodSync(abs, 0o755);
    }
    wrote.push(abs);
  };

  switch (kind) {
    case "create":
      writeFile(destAbs, payload, entry.tier === "executable");
      stamp();
      break;

    case "update":
      writeFile(destAbs, payload, entry.tier === "executable");
      stamp();
      break;

    case "noop":
      // Nothing to write; stamp already correct.
      break;

    case "noop-restamp":
      // Content already matches payload but wasn't stamped; record the stamp so
      // future drift detection is accurate. No file write.
      stamp();
      note = "content already current; recorded stamp";
      break;

    case "marker-update": {
      const onDisk = readFileSync(destAbs, "utf8");
      const merged = spliceMarkers(onDisk, payload);
      if (merged === null) {
        note = "markers malformed; left untouched";
        break;
      }
      writeFile(destAbs, merged, false);
      // The whole-file hash now differs from payload; stamp the merged hash so a
      // later run sees no drift.
      manifest.files[entry.dest] = { hash: hash(merged), tier: entry.tier };
      note = "updated managed marker region in place";
      break;
    }

    case "drift-sidecar":
    case "coowned-sidecar": {
      const sidecar = destAbs + ".new";
      writeFile(sidecar, payload, entry.tier === "executable");
      // Do NOT change the stamp for the protected file; leave the consumer's
      // copy authoritative.
      note =
        kind === "coowned-sidecar"
          ? "consumer-owned file preserved; new version written alongside as .new"
          : "consumer-modified file preserved; new version written alongside as .new";
      break;
    }

    case "remove": {
      // BOUNDED deletion (rtk `--without-rtk` only). Delete the file if present
      // and drop its manifest stamp so a later run does not treat it as managed.
      if (existsSync(destAbs)) {
        if (!dryRun) rmSync(destAbs, { force: true });
        removed.push(destAbs);
      }
      delete manifest.files[entry.dest];
      note = "rtk file removed";
      break;
    }

    case "remove-noop":
      // Nothing on disk and nothing stamped -> nothing to remove.
      delete manifest.files[entry.dest];
      break;

    default:
      throw new Error(`Unknown action kind: ${kind}`);
  }

  return { dest: entry.dest, kind, wrote, removed, note };
}

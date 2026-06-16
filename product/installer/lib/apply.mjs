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

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hash, hashFile } from "./manifest.mjs";

const MARK_BEGIN = "<!-- ai-dlc:begin -->";
const MARK_END = "<!-- ai-dlc:end -->";

/** Decide the action for one payload entry given current disk + stamp state. */
export function decideAction(entry, repoRoot, manifest) {
  const destAbs = join(repoRoot, entry.dest);
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
    if (onDisk.includes(MARK_BEGIN) && onDisk.includes(MARK_END)) {
      // Opt-in managed region present: update only inside the markers.
      return { ...base, kind: "marker-update" };
    }
    // Marker-less, pre-existing, content differs from payload: NEVER edit in
    // place. Whether stamped or not, the safe move is the sidecar — but if it is
    // stamped and undrifted we could overwrite. Co-owned policy is conservative:
    // only auto-overwrite when on-disk == stamp (we wrote it, consumer didn't
    // touch it). Otherwise sidecar.
    if (stamped && onDiskHash === stamped.hash) {
      return { ...base, kind: "update" };
    }
    return { ...base, kind: "coowned-sidecar", content };
  }

  // kit-owned / executable tiers.
  if (stamped && onDiskHash === stamped.hash) {
    // Consumer hasn't touched it; payload changed -> clean overwrite.
    return { ...base, kind: "update" };
  }
  // Consumer edited a kit-owned file (or it pre-existed un-stamped) AND payload
  // differs -> drift. Do not clobber; write a sidecar.
  return { ...base, kind: "drift-sidecar" };
}

/** Build the full action plan across all payload entries. */
export function planActions(entries, repoRoot, manifest) {
  return entries.map((e) => decideAction(e, repoRoot, manifest));
}

function ensureDir(absFile) {
  mkdirSync(dirname(absFile), { recursive: true });
}

/** Replace the content between markers, preserving the rest of the file. */
function spliceMarkers(onDisk, payload) {
  const begin = onDisk.indexOf(MARK_BEGIN);
  const end = onDisk.indexOf(MARK_END);
  if (begin === -1 || end === -1 || end < begin) return null;
  const before = onDisk.slice(0, begin + MARK_BEGIN.length);
  const after = onDisk.slice(end);
  return `${before}\n${payload.toString("utf8").trim()}\n${after}`;
}

/**
 * Execute one action. `dryRun` => compute the effect/messages but touch nothing.
 * Mutates `manifest.files` for actions that (re)stamp. Returns a result row:
 *   { dest, kind, wrote: [paths], note }
 */
export function executeAction(action, repoRoot, manifest, { dryRun }) {
  const { entry, destAbs, payload, payloadHash, kind } = action;
  const wrote = [];
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

    default:
      throw new Error(`Unknown action kind: ${kind}`);
  }

  return { dest: entry.dest, kind, wrote, note };
}

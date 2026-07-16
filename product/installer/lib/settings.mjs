// Wire the AI-DLC hooks into the consumer's .claude/settings.json.
//
// This is a STRUCTURED MERGE, not a whole-file overwrite: .claude/settings.json
// is consumer-owned. We add hook entries pointing at the installed scripts, and we
// do it IDEMPOTENTLY — re-running never duplicates an entry. We NEVER remove or
// reorder the consumer's other hooks or settings; the only entry we ever remove is
// the rtk hook we ourselves own (identified by its `rtk-wrap.sh` command), during
// an explicit `--without-rtk`. Correctness never depends on array order — every
// entry is a self-contained, separately-matched PreToolUse/Bash block.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SETTINGS_REL = ".claude/settings.json";

// The exact command we register. ${CLAUDE_PROJECT_DIR} is substituted by Claude
// Code at hook time to the consumer's repo root.
export const HOOK_COMMAND =
  'bash "${CLAUDE_PROJECT_DIR}/.ai-dlc/hooks/arbiter-gate.sh"';

// The rtk wrapper hook command (opt-in). Merged as a SEPARATE PreToolUse/Bash
// entry when rtk is enabled; removed (and only this entry) on `--without-rtk`.
export const RTK_HOOK_COMMAND =
  'bash "${CLAUDE_PROJECT_DIR}/.ai-dlc/hooks/rtk-wrap.sh"';

// Substring that uniquely identifies the rtk hook entry we own, used for the
// bounded removal path so the arbiter hook and consumer hooks are never touched.
const RTK_HOOK_MARKER = "rtk-wrap.sh";

const HOOK_MATCHER = "Bash";

/** Read + parse the consumer's settings.json, or return an empty object. */
function readSettings(repoRoot) {
  const abs = join(repoRoot, SETTINGS_REL);
  if (!existsSync(abs)) return {};
  const raw = readFileSync(abs, "utf8").trim();
  if (raw === "") return {};
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `${SETTINGS_REL} is present but not valid JSON (${e.message}). ` +
        "Fix or remove it, then re-run; the installer will not overwrite it blindly."
    );
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`${SETTINGS_REL} must be a JSON object.`);
  }
  return data;
}

/**
 * True if a command hook with EXACTLY `command` is already registered anywhere in
 * PreToolUse (regardless of which block or order it sits in).
 */
function hookCommandPresent(settings, command) {
  const pre = settings?.hooks?.PreToolUse;
  if (!Array.isArray(pre)) return false;
  for (const block of pre) {
    if (!block || !Array.isArray(block.hooks)) continue;
    for (const h of block.hooks) {
      if (h && h.type === "command" && h.command === command) return true;
    }
  }
  return false;
}

/** True if the arbiter-gate hook is already registered in `settings`. */
function hookAlreadyPresent(settings) {
  return hookCommandPresent(settings, HOOK_COMMAND);
}

/**
 * Compute the desired settings.json content with the hook wired in.
 * Returns { changed: boolean, content: string } where `content` is the
 * serialized JSON to write (only meaningful when changed === true).
 * Pure: does not touch disk except reading the current file.
 */
export function planSettingsMerge(repoRoot) {
  const settings = readSettings(repoRoot);
  if (hookAlreadyPresent(settings)) {
    return { changed: false, content: null };
  }

  if (typeof settings.hooks !== "object" || settings.hooks === null) {
    settings.hooks = {};
  }
  if (!Array.isArray(settings.hooks.PreToolUse)) {
    settings.hooks.PreToolUse = [];
  }
  settings.hooks.PreToolUse.push({
    matcher: HOOK_MATCHER,
    hooks: [{ type: "command", command: HOOK_COMMAND, timeout: 30 }],
  });

  return { changed: true, content: JSON.stringify(settings, null, 2) + "\n" };
}

/**
 * Plan the rtk hook merge (OPT-IN). Pure: reads the current settings.json only.
 *
 *   enabled === true  -> ensure a SEPARATE PreToolUse/Bash entry for rtk-wrap.sh
 *                        exists (idempotent; never duplicated). Correctness does
 *                        not depend on where the entry lands in the array.
 *   enabled === false -> REMOVE only the rtk hook entry (any command containing
 *                        `rtk-wrap.sh`), leaving the arbiter hook and every
 *                        consumer-authored hook untouched. A block we empty by
 *                        removing our own entry is dropped; other blocks are never
 *                        modified. Idempotent: absent rtk hook -> no change.
 *
 * Returns { changed, content } where `content` is the JSON to write when changed.
 */
export function planRtkSettings(repoRoot, enabled) {
  const settings = readSettings(repoRoot);

  if (enabled) {
    if (hookCommandPresent(settings, RTK_HOOK_COMMAND)) {
      return { changed: false, content: null };
    }
    if (typeof settings.hooks !== "object" || settings.hooks === null) {
      settings.hooks = {};
    }
    if (!Array.isArray(settings.hooks.PreToolUse)) {
      settings.hooks.PreToolUse = [];
    }
    settings.hooks.PreToolUse.push({
      matcher: HOOK_MATCHER,
      hooks: [{ type: "command", command: RTK_HOOK_COMMAND, timeout: 30 }],
    });
    return { changed: true, content: JSON.stringify(settings, null, 2) + "\n" };
  }

  // Removal path: strip ONLY hook entries whose command names rtk-wrap.sh.
  const pre = settings?.hooks?.PreToolUse;
  if (!Array.isArray(pre)) {
    return { changed: false, content: null };
  }
  let changed = false;
  const nextPre = [];
  for (const block of pre) {
    if (!block || !Array.isArray(block.hooks)) {
      nextPre.push(block);
      continue;
    }
    const hadRtk = block.hooks.some(
      (h) => h && typeof h.command === "string" && h.command.includes(RTK_HOOK_MARKER)
    );
    if (!hadRtk) {
      nextPre.push(block);
      continue;
    }
    changed = true;
    const kept = block.hooks.filter(
      (h) => !(h && typeof h.command === "string" && h.command.includes(RTK_HOOK_MARKER))
    );
    // Preserve a block that still holds other (consumer/arbiter) hooks; drop a
    // block that WE emptied by removing our own rtk entry.
    if (kept.length > 0) nextPre.push({ ...block, hooks: kept });
  }
  if (!changed) {
    return { changed: false, content: null };
  }
  settings.hooks.PreToolUse = nextPre;
  return { changed: true, content: JSON.stringify(settings, null, 2) + "\n" };
}

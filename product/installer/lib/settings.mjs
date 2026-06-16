// Wire the arbiter-gate hook into the consumer's .claude/settings.json.
//
// This is a STRUCTURED MERGE, not a whole-file overwrite: .claude/settings.json
// is consumer-owned. We add exactly one PreToolUse/Bash hook entry pointing at
// the installed arbiter-gate script, and we do it IDEMPOTENTLY — re-running never
// duplicates the entry. We never remove or reorder the consumer's other hooks or
// settings.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SETTINGS_REL = ".claude/settings.json";

// The exact command we register. ${CLAUDE_PROJECT_DIR} is substituted by Claude
// Code at hook time to the consumer's repo root.
export const HOOK_COMMAND =
  'bash "${CLAUDE_PROJECT_DIR}/.ai-dlc/hooks/arbiter-gate.sh"';

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

/** True if the arbiter-gate hook is already registered in `settings`. */
function hookAlreadyPresent(settings) {
  const pre = settings?.hooks?.PreToolUse;
  if (!Array.isArray(pre)) return false;
  for (const block of pre) {
    if (!block || !Array.isArray(block.hooks)) continue;
    for (const h of block.hooks) {
      if (h && h.type === "command" && h.command === HOOK_COMMAND) return true;
    }
  }
  return false;
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

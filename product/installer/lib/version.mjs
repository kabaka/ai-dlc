// Resolve the kit version the installer is applying.
//
// Source of truth: the installer's package.json `version`. It is the single
// SemVer authority — npm owns it and the team bumps it there. The plugin manifest
// (product/.claude-plugin/plugin.json) NO LONGER carries a `version` field, so the
// legacy read below never returns and resolution falls through to package.json;
// it is kept only as a defensive fallback for an older plugin.json that still
// stamps a version. If neither yields one, use "0.0.0-unstamped". The resolved kit
// version is recorded in the consumer's stamp manifest so updates are auditable.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const INSTALLER_ROOT = resolve(HERE, "..");

function readJson(absPath) {
  try {
    return JSON.parse(readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

export function resolveKitVersion(payloadRoot) {
  const pluginManifest = join(payloadRoot, ".claude-plugin", "plugin.json");
  if (existsSync(pluginManifest)) {
    const data = readJson(pluginManifest);
    if (data && typeof data.version === "string" && data.version.trim()) {
      return data.version.trim();
    }
  }
  const pkg = join(INSTALLER_ROOT, "package.json");
  if (existsSync(pkg)) {
    const data = readJson(pkg);
    if (data && typeof data.version === "string" && data.version.trim()) {
      return data.version.trim();
    }
  }
  return "0.0.0-unstamped";
}

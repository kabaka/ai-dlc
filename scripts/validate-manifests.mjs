#!/usr/bin/env node
// Validate the AI-DLC plugin + marketplace JSON manifests. Zero-dependency:
// Node built-ins only (no ajv / no JSON-schema library — the rules are
// hand-rolled from the documented field tables).
//
// Sources of truth for the rules below:
//   - .claude/skills/plugin-packaging/SKILL.md       (plugin.json field table)
//   - .claude/skills/marketplace-publishing/SKILL.md (marketplace.json table)
//
// Manifests validated:
//   product/.claude-plugin/plugin.json   (the kit's plugin manifest)
//   .claude-plugin/marketplace.json      (repo-root marketplace catalog)
//
// Neither file exists yet. This validator SKIPS a manifest that is absent
// (reported, not failed) and genuinely validates it once present. Checks:
//   - JSON parses
//   - required keys present with correct types
//   - optional keys, when present, have correct types
//   - component path fields start with `./`, contain no `..`, and resolve to a
//     real dir/file on disk (relative to the manifest's own root)
//   - marketplace relative-path `source`s start with `./`, no `..`, and resolve
//
// Path resolution note: plugin component paths resolve from the plugin ROOT
// (the dir CONTAINING `.claude-plugin/`), not from `.claude-plugin/`. Likewise a
// marketplace relative `source` resolves from the marketplace root (repo root),
// optionally under `metadata.pluginRoot`.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const skipped = [];
const validated = [];
const fail = (file, reason) => failures.push({ file, reason });

const isString = (v) => typeof v === "string";
const isBool = (v) => typeof v === "boolean";
const isArray = (v) => Array.isArray(v);
const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * A plugin component path (and marketplace relative source) must be a string
 * that starts with `./`, contains no `..` traversal, and resolves on disk
 * relative to `rootDir`. `expect` is "dir" | "file" | "any". Records a failure
 * via `fail(file, ...)` for each problem; returns nothing.
 */
function checkComponentPath(file, label, value, rootDir, expect) {
  if (!isString(value)) {
    fail(file, `${label} must be a string path, got ${typeof value}`);
    return;
  }
  if (!value.startsWith("./")) {
    fail(file, `${label} "${value}" must start with "./"`);
    return;
  }
  if (value.split("/").includes("..")) {
    fail(file, `${label} "${value}" must not contain ".." traversal`);
    return;
  }
  const resolved = resolve(rootDir, value);
  // Defense in depth: the resolved path must stay within rootDir.
  if (resolved !== rootDir && !resolved.startsWith(rootDir + "/")) {
    fail(file, `${label} "${value}" escapes the manifest root`);
    return;
  }
  if (!existsSync(resolved)) {
    fail(file, `${label} "${value}" does not resolve to an existing path`);
    return;
  }
  if (expect === "dir" && !statSync(resolved).isDirectory()) {
    fail(file, `${label} "${value}" must be a directory`);
  } else if (expect === "file" && !statSync(resolved).isFile()) {
    fail(file, `${label} "${value}" must be a file`);
  }
}

/** Validate each entry of a string-or-array path field. */
function checkPathField(file, label, value, rootDir, expect) {
  const items = isArray(value) ? value : [value];
  for (let i = 0; i < items.length; i++) {
    const lbl = isArray(value) ? `${label}[${i}]` : label;
    checkComponentPath(file, lbl, items[i], rootDir, expect);
  }
}

/** Load + JSON-parse a manifest. Returns null and records skip/fail. */
function loadManifest(absPath, relPath) {
  if (!existsSync(absPath)) {
    skipped.push(relPath);
    return null;
  }
  let raw;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch (e) {
    fail(relPath, `cannot read file: ${e.message}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(relPath, `invalid JSON: ${e.message}`);
    return null;
  }
}

// ---- plugin.json ----------------------------------------------------------

function validatePlugin() {
  const rel = "product/.claude-plugin/plugin.json";
  const abs = join(REPO_ROOT, "product", ".claude-plugin", "plugin.json");
  const data = loadManifest(abs, rel);
  if (data === null) return;
  if (!isObject(data)) {
    fail(rel, "manifest must be a JSON object");
    return;
  }
  validated.push(rel);

  // The plugin ROOT is the dir CONTAINING `.claude-plugin/`.
  const pluginRoot = join(REPO_ROOT, "product");

  // `name` is the only required field (per plugin-packaging).
  if (!("name" in data)) {
    fail(rel, "`name` is required");
  } else if (!isString(data.name) || data.name.trim() === "") {
    fail(rel, "`name` must be a non-empty string");
  } else {
    if (!/^[a-z0-9-]+$/.test(data.name)) {
      fail(rel, `\`name\` "${data.name}" must be kebab-case (lowercase/digits/hyphens)`);
    }
    if (/claude|anthropic/i.test(data.name)) {
      fail(rel, `\`name\` must not contain "claude" or "anthropic"`);
    }
  }

  // Optional scalar fields with their expected types.
  const stringFields = [
    "$schema",
    "displayName",
    "version",
    "description",
    "homepage",
    "repository",
    "license",
  ];
  for (const f of stringFields) {
    if (f in data && !isString(data[f])) {
      fail(rel, `\`${f}\` must be a string`);
    }
  }
  if ("author" in data && !isObject(data.author)) {
    fail(rel, "`author` must be an object { name, email, url }");
  }
  if ("keywords" in data && !isArray(data.keywords)) {
    // A string here is a documented LOAD ERROR, not a warning.
    fail(rel, "`keywords` must be an array (a string is a load error)");
  }
  if ("defaultEnabled" in data && !isBool(data.defaultEnabled)) {
    fail(rel, "`defaultEnabled` must be a boolean");
  }

  // Component path fields — must start with `./`, no `..`, resolve on disk.
  const dirPathFields = ["skills", "commands", "agents", "outputStyles"];
  for (const f of dirPathFields) {
    if (f in data) checkPathField(rel, `\`${f}\``, data[f], pluginRoot, "dir");
  }
  // hooks / mcpServers / lspServers may be a path STRING, an array of paths,
  // or an inline object. Only check string/array forms as paths.
  for (const f of ["hooks", "mcpServers", "lspServers"]) {
    if (f in data && (isString(data[f]) || isArray(data[f]))) {
      checkPathField(rel, `\`${f}\``, data[f], pluginRoot, "any");
    }
  }
}

// ---- marketplace.json -----------------------------------------------------

function validateMarketplace() {
  const rel = ".claude-plugin/marketplace.json";
  const abs = join(REPO_ROOT, ".claude-plugin", "marketplace.json");
  const data = loadManifest(abs, rel);
  if (data === null) return;
  if (!isObject(data)) {
    fail(rel, "manifest must be a JSON object");
    return;
  }
  validated.push(rel);

  // Required: name, owner, plugins.
  if (!("name" in data)) {
    fail(rel, "`name` is required");
  } else if (!isString(data.name) || data.name.trim() === "") {
    fail(rel, "`name` must be a non-empty string");
  } else if (!/^[a-z0-9-]+$/.test(data.name)) {
    fail(rel, `\`name\` "${data.name}" must be kebab-case`);
  }

  if (!("owner" in data)) {
    fail(rel, "`owner` is required");
  } else if (!isObject(data.owner)) {
    fail(rel, "`owner` must be an object { name, email? }");
  } else if (!isString(data.owner.name) || data.owner.name.trim() === "") {
    fail(rel, "`owner.name` is required and must be a non-empty string");
  }

  if ("description" in data && !isString(data.description)) {
    fail(rel, "`description` must be a string");
  }
  if ("version" in data && !isString(data.version)) {
    fail(rel, "`version` must be a string");
  }

  // metadata.pluginRoot prepends to relative plugin sources.
  let pluginRootPrefix = "";
  if ("metadata" in data) {
    if (!isObject(data.metadata)) {
      fail(rel, "`metadata` must be an object");
    } else if ("pluginRoot" in data.metadata) {
      if (!isString(data.metadata.pluginRoot)) {
        fail(rel, "`metadata.pluginRoot` must be a string");
      } else {
        pluginRootPrefix = data.metadata.pluginRoot;
        if (!pluginRootPrefix.startsWith("./")) {
          fail(rel, `\`metadata.pluginRoot\` "${pluginRootPrefix}" must start with "./"`);
        }
        if (pluginRootPrefix.split("/").includes("..")) {
          fail(rel, "`metadata.pluginRoot` must not contain \"..\" traversal");
        }
      }
    }
  }

  // plugins: required array of entries; each needs name + source.
  if (!("plugins" in data)) {
    fail(rel, "`plugins` is required");
    return;
  }
  if (!isArray(data.plugins)) {
    fail(rel, "`plugins` must be an array");
    return;
  }

  const seenNames = new Set();
  data.plugins.forEach((entry, idx) => {
    const where = `plugins[${idx}]`;
    if (!isObject(entry)) {
      fail(rel, `${where} must be an object`);
      return;
    }
    if (!isString(entry.name) || entry.name.trim() === "") {
      fail(rel, `${where}.name is required and must be a non-empty string`);
    } else {
      if (!/^[a-z0-9-]+$/.test(entry.name)) {
        fail(rel, `${where}.name "${entry.name}" must be kebab-case`);
      }
      if (seenNames.has(entry.name)) {
        fail(rel, `${where}.name "${entry.name}" is a duplicate`);
      }
      seenNames.add(entry.name);
    }

    if (!("source" in entry)) {
      fail(rel, `${where}.source is required`);
      return;
    }
    validateSource(rel, where, entry.source, pluginRootPrefix);
  });
}

/**
 * A plugin entry `source` is either a relative-path STRING (must start `./`,
 * no `..`, resolve under the marketplace root, optionally via pluginRoot) or an
 * OBJECT keyed by `source` type (github | url | git-subdir | npm). For object
 * sources we type-check the required keys and forbid `..` in any path, but do
 * not hit the network.
 */
function validateSource(file, where, source, pluginRootPrefix) {
  if (isString(source)) {
    if (!source.startsWith("./")) {
      fail(file, `${where}.source "${source}" must start with "./" (relative path)`);
      return;
    }
    if (source.split("/").includes("..")) {
      fail(file, `${where}.source "${source}" must not contain ".." traversal`);
      return;
    }
    // Resolve under metadata.pluginRoot when set (e.g. "ai-dlc" -> ./plugins/ai-dlc).
    const base = pluginRootPrefix
      ? resolve(REPO_ROOT, pluginRootPrefix)
      : REPO_ROOT;
    const resolved = resolve(base, source);
    if (resolved !== base && !resolved.startsWith(base + "/")) {
      fail(file, `${where}.source "${source}" escapes the marketplace root`);
      return;
    }
    if (!existsSync(resolved)) {
      fail(file, `${where}.source "${source}" does not resolve to an existing path`);
      return;
    }
    if (!statSync(resolved).isDirectory()) {
      fail(file, `${where}.source "${source}" must resolve to a directory`);
    }
    return;
  }

  if (!isObject(source)) {
    fail(file, `${where}.source must be a relative path string or a source object`);
    return;
  }

  const kind = source.source;
  const known = ["github", "url", "git-subdir", "npm"];
  if (!isString(kind) || !known.includes(kind)) {
    fail(
      file,
      `${where}.source.source must be one of ${known.join(", ")}`
    );
    return;
  }
  const requireString = (key) => {
    if (!isString(source[key]) || source[key].trim() === "") {
      fail(file, `${where}.source.${key} is required for "${kind}" sources`);
    } else if (source[key].split("/").includes("..")) {
      fail(file, `${where}.source.${key} must not contain ".." traversal`);
    }
  };
  if (kind === "github") requireString("repo");
  if (kind === "url") requireString("url");
  if (kind === "git-subdir") {
    requireString("url");
    requireString("path");
  }
  if (kind === "npm") requireString("package");
}

// ---- Run ------------------------------------------------------------------

validatePlugin();
validateMarketplace();

console.log("Manifest validation");
if (validated.length > 0) {
  console.log(`  validated ${validated.length} manifest(s): ${validated.join(", ")}`);
}
if (skipped.length > 0) {
  console.log(`  skipped ${skipped.length} absent manifest(s): ${skipped.join(", ")}`);
}

if (failures.length === 0) {
  console.log("PASS: manifests valid (or cleanly absent)");
  process.exit(0);
}

console.log(`FAIL: ${failures.length} problem(s):`);
for (const { file, reason } of failures) {
  console.log(`  ${file}: ${reason}`);
}
process.exit(1);

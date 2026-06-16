#!/usr/bin/env node
// Validate local Markdown links and @imports across tracked .md files in the
// AI-DLC repo. Zero-dependency: Node built-ins only.
//
// For every tracked `.md` file it scans:
//   - inline Markdown links `[text](target)`
//   - `@import` references (e.g. CLAUDE.md's `@AGENTS.md`)
// and for each LOCAL target (not http:, https:, mailto:, or a bare `#anchor`),
// it strips any `#anchor` and verifies the file exists relative to the linking
// file. Reports broken links as `file:line -> target`; exits non-zero if any
// link is broken.
//
// TEMPLATE files (under `product/templates/`) are installer/cross-platform
// payloads copied into a CONSUMER repo. They legitimately reference paths that
// only resolve in the consumer's tree (e.g. `AGENTS.md`, `.kiro/steering/...`),
// not in THIS repo. Such a file opts out of in-repo link resolution with an
// explicit, greppable marker anywhere in its body:
//
//     <!-- ai-dlc:link-check-ignore-file -->
//
// This is a per-file opt-out, chosen over a path-based ignore list so the
// exemption is visible at the point of use. To keep it from silently widening
// to cover real skills/agents, the marker ONLY takes effect for files under
// `product/templates/` (its stated purpose). A file outside that directory that
// carries the marker is NOT skipped — its links are still validated, and a
// notice records that the marker was ignored outside the allowed path. So a
// contributor (or injected template-PR content) cannot hide broken links in a
// real skill/agent by dropping the marker into it. Eligible marker files are
// reported as skipped, not validated.

import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Return tracked + untracked-but-not-ignored .md files (repo-relative). */
function listMarkdownFiles() {
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Inline links: [text](target). Capture the target; we trim a trailing title
// like (target "Title"). Skip image-vs-link distinction (both are local refs).
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
// @imports at a token boundary: @path or @./path or @../path.
const IMPORT_RE = /(?:^|\s)@([./A-Za-z0-9_-][^\s)]*)/g;

function isExternal(target) {
  return /^(?:https?:|mailto:|tel:|ftp:)/i.test(target);
}

/**
 * Replace the contents of inline-code spans with spaces of equal length, so
 * a `[text](target)` rendered as literal code (inside backticks) is not chased
 * as a real link. Lengths are preserved so column-based matching is unaffected.
 */
function maskInlineCode(line) {
  return line.replace(/(`+)([^`]*?)\1/g, (full) => " ".repeat(full.length));
}

/**
 * A target is a fill-in placeholder rather than a real path if it contains
 * template metacharacters: `{` `}`, an ellipsis `...`, or a run of the literal
 * fill-in tokens used in the ADR template (`XXXX` / `NNNN`). It must NOT match
 * real filenames that merely contain uppercase (AGENTS.md, CONTRIBUTING.md,
 * LICENSE, CLAUDE.md, README.md, SKILL.md) — those are real links to check.
 */
function isPlaceholder(target) {
  return (
    /[{}]/.test(target) ||
    target.includes("...") ||
    /X{3,}/.test(target) ||
    /N{3,}/.test(target)
  );
}

// Marker that opts a whole file out of in-repo link resolution (see header).
const IGNORE_FILE_MARKER = "ai-dlc:link-check-ignore-file";
// The marker is honored ONLY for files under this path prefix (see header).
const TEMPLATE_PREFIX = "product/templates/";

/** True if a repo-relative path lives under product/templates/. */
function isTemplateFile(fileRel) {
  return fileRel === TEMPLATE_PREFIX || fileRel.startsWith(TEMPLATE_PREFIX);
}

const broken = [];
const ignoredMarkers = [];
let skippedCount = 0;

function checkTarget(fileRel, lineNo, rawTarget) {
  let target = rawTarget.trim();
  // Strip a markdown link title: (path "Title") or (path 'Title').
  const titleMatch = target.match(/^(\S+)\s+["'].*["']$/);
  if (titleMatch) target = titleMatch[1];
  // Strip surrounding angle brackets: <path>.
  target = target.replace(/^<(.*)>$/, "$1");

  if (!target) return;
  if (isExternal(target)) return;
  // Pure anchor / in-page reference.
  if (target.startsWith("#")) return;
  // Skip template / placeholder targets (e.g. ADR template `./XXXX-....md`,
  // `{some-path}`). These are fill-in tokens, not literal files.
  if (isPlaceholder(target)) return;

  // Strip any #anchor and ?query.
  const noAnchor = target.split("#")[0].split("?")[0];
  if (!noAnchor) return;

  const baseDir = dirname(join(REPO_ROOT, fileRel));
  const resolved = resolve(baseDir, noAnchor);

  if (!existsSync(resolved)) {
    broken.push({ file: fileRel, line: lineNo, target });
    return;
  }
  // A link ending in `/` should resolve to a directory.
  if (noAnchor.endsWith("/") && !statSync(resolved).isDirectory()) {
    broken.push({ file: fileRel, line: lineNo, target });
  }
}

function scanFile(fileRel) {
  const abs = join(REPO_ROOT, fileRel);
  if (!existsSync(abs)) return;
  const content = readFileSync(abs, "utf8");
  // Whole-file opt-out for template payloads — honored ONLY under
  // product/templates/ (see header). Outside that path the marker is ignored:
  // the file is still validated, and we record a notice so the misplaced marker
  // is visible rather than silently suppressing real broken links.
  if (content.includes(IGNORE_FILE_MARKER)) {
    if (isTemplateFile(fileRel)) {
      skippedCount++;
      return;
    }
    ignoredMarkers.push(fileRel);
  }
  const lines = content.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Track fenced code blocks; do not chase links inside them.
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Blank out inline-code spans (`...`) so links/imports that appear inside
    // backticks are treated as literal illustrative text, not live references.
    const scan = maskInlineCode(line);

    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(scan)) !== null) {
      checkTarget(fileRel, lineNo, m[1]);
    }
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(scan)) !== null) {
      checkTarget(fileRel, lineNo, m[1]);
    }
  }
}

const files = listMarkdownFiles();
for (const f of files) scanFile(f);

console.log("Link validation");
console.log(
  `  scanned ${files.length} Markdown file(s)` +
    (skippedCount > 0 ? `, ${skippedCount} template file(s) skipped` : "")
);

if (ignoredMarkers.length > 0) {
  console.log(
    `  NOTICE: ${ignoredMarkers.length} file(s) carry the ` +
      `${IGNORE_FILE_MARKER} marker outside ${TEMPLATE_PREFIX}; ` +
      "the marker was IGNORED and links were validated:"
  );
  for (const f of ignoredMarkers) console.log(`    ${f}`);
}

if (broken.length === 0) {
  console.log("PASS: all local links resolve");
  process.exit(0);
}

console.log(`FAIL: ${broken.length} broken local link(s):`);
for (const { file, line, target } of broken) {
  console.log(`  ${file}:${line} -> ${target}`);
}
process.exit(1);

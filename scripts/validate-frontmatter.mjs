#!/usr/bin/env node
// Validate YAML frontmatter for AI-DLC skills and agents (internal kit-builder
// layer). Zero-dependency: Node built-ins only.
//
// Checks:
//   .claude/skills/<dir>/SKILL.md
//     - frontmatter present; non-empty `name` and `description`
//     - `name` is kebab-case (lowercase / digits / hyphens), <=64 chars,
//       contains neither "claude" nor "anthropic"
//     - `name` EQUALS the skill's directory name
//     - `description` <= 1024 chars
//   .claude/agents/<name>.md
//     - frontmatter present; non-empty `name` and `description`
//     - `name` matches /^[a-z0-9-]+$/ and EQUALS filename without `.md`
//     - if `tools` present AND agent is a known read-only agent, `tools` must
//       not include Write or Edit
//     - if `skills:` list present, every entry must be an existing directory
//       under .claude/skills/
//
// Designed to tolerate a half-authored repo: missing directories, empty skill
// directories, and partially-present files are handled without crashing. Only
// files that exist are validated.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(REPO_ROOT, ".claude", "skills");
const AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");

// Agents that must never be able to mutate files (per AGENTS.md roster).
const READ_ONLY_AGENTS = new Set([
  "brainstorm",
  "planner",
  "adversarial-reviewer",
  "qa",
  "security",
  "rca-analyst",
  "researcher",
]);

const failures = [];
const fail = (file, reason) => failures.push({ file, reason });

/**
 * Extract the frontmatter block from a Markdown document.
 * Returns the raw YAML string, or null if there is no leading `---` block.
 */
function extractFrontmatter(text) {
  // Tolerate a leading BOM and blank lines before the opening fence.
  const normalized = text.replace(/^﻿/, "");
  const lines = normalized.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i] !== "---") return null;
  const body = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j] === "---") return body.join("\n");
    body.push(lines[j]);
  }
  return null; // opening fence never closed
}

/**
 * Minimal YAML parser sufficient for these flat documents:
 *   - `key: scalar` (scalar may be quoted with ' or ")
 *   - block lists:   `key:` followed by indented `- item` lines
 *   - inline lists:  `key: [a, b, c]`
 * Returns an object mapping keys to strings or string arrays. Unknown / nested
 * structures we do not need are ignored rather than throwing.
 */
function parseSimpleYaml(yaml) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    // Only treat top-level (unindented) keys as fields.
    const m = raw.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!m) continue;
    const key = m[1];
    let rest = m[2].trim();

    // Block scalar: `key: >`, `key: |`, with optional chomping (`-`/`+`).
    // Collect the following indented lines so length checks see full content.
    const blockMatch = rest.match(/^([|>])([+-]?)$/);
    if (blockMatch) {
      const folded = blockMatch[1] === ">";
      const parts = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const ln = lines[j];
        if (ln.trim() === "") {
          parts.push("");
          continue;
        }
        if (/^\s/.test(ln)) {
          parts.push(ln.trim());
          continue;
        }
        break; // unindented line ends the block scalar
      }
      out[key] = parts.join(folded ? " " : "\n").trim();
      i = j - 1;
      continue;
    }

    rest = stripComment(rest).trim();

    if (rest === "") {
      // Possible block list on following indented lines.
      const items = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const ln = lines[j];
        if (!ln.trim()) continue; // skip blanks within a block
        const item = ln.match(/^\s+-\s+(.*)$/);
        if (item) {
          items.push(unquote(stripComment(item[1]).trim()));
          continue;
        }
        // A new unindented key ends the block; an indented non-list line is
        // a nested map we do not model -> stop here.
        if (/^\S/.test(ln) || !/^\s+-/.test(ln)) break;
      }
      if (items.length > 0) {
        out[key] = items;
        i = j - 1;
      } else {
        out[key] = "";
      }
      continue;
    }

    if (rest.startsWith("[") && rest.endsWith("]")) {
      out[key] = rest
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter((s) => s.length > 0);
      continue;
    }

    out[key] = unquote(rest);
  }
  return out;
}

function stripComment(s) {
  // Drop trailing `# comment` when not inside quotes. Simple but adequate for
  // our flat fields (we never put `#` inside an unquoted scalar here).
  let inS = false;
  let inD = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === "#" && !inS && !inD && (k === 0 || s[k - 1] === " ")) {
      return s.slice(0, k);
    }
  }
  return s;
}

function unquote(s) {
  if (s.length >= 2) {
    const a = s[0];
    const b = s[s.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

function listDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function isSkillDir(name) {
  return existsSync(join(SKILLS_DIR, name)) &&
    statSync(join(SKILLS_DIR, name)).isDirectory();
}

// ---- Validate skills ------------------------------------------------------

function validateSkills() {
  const dirs = listDirs(SKILLS_DIR);
  let checked = 0;
  for (const dir of dirs) {
    const skillFile = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(skillFile)) {
      // Directory exists but SKILL.md not authored yet -> skip gracefully.
      continue;
    }
    checked++;
    const rel = `.claude/skills/${dir}/SKILL.md`;
    const fm = extractFrontmatter(readFileSync(skillFile, "utf8"));
    if (fm === null) {
      fail(rel, "missing or unterminated YAML frontmatter block");
      continue;
    }
    const data = parseSimpleYaml(fm);
    const name = typeof data.name === "string" ? data.name : "";
    const description =
      typeof data.description === "string" ? data.description : "";

    if (!name) fail(rel, "`name` is missing or empty");
    if (!description) fail(rel, "`description` is missing or empty");

    if (name) {
      if (!/^[a-z0-9-]+$/.test(name)) {
        fail(rel, `\`name\` "${name}" is not kebab-case (lowercase/digits/hyphens)`);
      }
      if (name.length > 64) {
        fail(rel, `\`name\` "${name}" exceeds 64 chars (${name.length})`);
      }
      if (/claude/i.test(name)) fail(rel, `\`name\` must not contain "claude"`);
      if (/anthropic/i.test(name)) {
        fail(rel, `\`name\` must not contain "anthropic"`);
      }
      if (name !== dir) {
        fail(rel, `\`name\` "${name}" must equal directory name "${dir}"`);
      }
    }
    if (description && description.length > 1024) {
      fail(rel, `\`description\` exceeds 1024 chars (${description.length})`);
    }
  }
  return checked;
}

// ---- Validate agents ------------------------------------------------------

function validateAgents() {
  if (!existsSync(AGENTS_DIR)) return 0;
  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
  let checked = 0;
  for (const f of files) {
    checked++;
    const rel = `.claude/agents/${f}`;
    const expectedName = basename(f, ".md");
    const fm = extractFrontmatter(readFileSync(join(AGENTS_DIR, f), "utf8"));
    if (fm === null) {
      fail(rel, "missing or unterminated YAML frontmatter block");
      continue;
    }
    const data = parseSimpleYaml(fm);
    const name = typeof data.name === "string" ? data.name : "";
    const description =
      typeof data.description === "string" ? data.description : "";

    if (!name) fail(rel, "`name` is missing or empty");
    if (!description) fail(rel, "`description` is missing or empty");

    if (name) {
      if (!/^[a-z0-9-]+$/.test(name)) {
        fail(rel, `\`name\` "${name}" must match /^[a-z0-9-]+$/`);
      }
      if (name !== expectedName) {
        fail(rel, `\`name\` "${name}" must equal filename "${expectedName}"`);
      }
    }

    // tools: read-only agents must not be able to mutate. An omitted `tools`
    // field inherits ALL tools (including Write/Edit), so a read-only agent
    // MUST declare an explicit allowlist — absence is itself a failure.
    if (READ_ONLY_AGENTS.has(expectedName)) {
      if (!("tools" in data)) {
        fail(
          rel,
          `read-only agent "${expectedName}" must declare an explicit \`tools\` allowlist (omitting it inherits Write/Edit)`
        );
      } else {
        const toolsRaw = Array.isArray(data.tools)
          ? data.tools.join(",")
          : String(data.tools);
        const toolset = toolsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        for (const forbidden of ["Write", "Edit"]) {
          if (toolset.includes(forbidden)) {
            fail(
              rel,
              `read-only agent "${expectedName}" must not list \`${forbidden}\` in tools`
            );
          }
        }
      }
    }

    // skills: every entry must be an existing skills directory.
    if ("skills" in data) {
      const skills = Array.isArray(data.skills)
        ? data.skills
        : data.skills
        ? [String(data.skills)]
        : [];
      for (const s of skills) {
        if (!isSkillDir(s)) {
          fail(rel, `\`skills\` entry "${s}" is not a directory under .claude/skills/`);
        }
      }
    }
  }
  return checked;
}

// ---- Run ------------------------------------------------------------------

const skillsChecked = validateSkills();
const agentsChecked = validateAgents();

console.log("Frontmatter validation");
console.log(
  `  checked ${skillsChecked} SKILL.md file(s), ${agentsChecked} agent file(s)`
);

if (failures.length === 0) {
  console.log("PASS: all frontmatter valid");
  process.exit(0);
}

console.log(`FAIL: ${failures.length} problem(s):`);
for (const { file, reason } of failures) {
  console.log(`  ${file}: ${reason}`);
}
process.exit(1);

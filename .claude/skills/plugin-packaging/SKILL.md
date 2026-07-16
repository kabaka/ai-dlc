---
name: plugin-packaging
description: Reference for authoring a Claude Code plugin — the `.claude-plugin/plugin.json` manifest, the directory layout, and what a plugin can and cannot ship. Use when packaging the kit as a Claude Code plugin, writing or validating plugin.json, choosing component path fields (skills/commands/agents/hooks/mcpServers), or deciding whether something must go in an installer instead of a plugin. Keywords: plugin.json, .claude-plugin, claude plugin validate, plugin manifest, plugin directory layout, CLAUDE.md limitation.
---

# Plugin Packaging (Claude Code)

This is the manifest-and-layout reference for shipping the kit's Claude-native
surface as a Claude Code **plugin**. The kit ships a real manifest at
`product/.claude-plugin/plugin.json`; this skill is the reference behind it. Pair it with
`marketplace-publishing` (how the plugin is distributed and versioned) and
`installer-design` (the primary delivery for everything a plugin provably
cannot ship). Every field, path rule, and command below is verified against the
official reference: https://code.claude.com/docs/en/plugins-reference (mid-2026).

## The one hard constraint — read this first

A plugin **cannot place top-level files into a consumer's repo.** It contributes
only through skills, agents, hooks, MCP/LSP servers, output styles, themes, and
monitors. Two facts make this absolute:

- A `CLAUDE.md` at the plugin root **is not loaded as project context.** Plugins
  contribute context through skills, agents, and hooks. To ship instructions
  that load into Claude's context, encode them as a **skill**, not `CLAUDE.md`.
- Installed (marketplace) plugins are **copied to `~/.claude/plugins/cache`** and
  **cannot reference files outside their own directory.** Paths that traverse out
  (`../shared-utils`) are not copied and will not resolve.

Therefore a plugin **cannot** drop `AGENTS.md`, `CLAUDE.md`,
`.github/copilot-instructions.md`, `.cursor/rules/`, or `.kiro/steering/` into the
consumer's project tree. Those cross-platform, top-level files are the
installer's job (see `installer-design`). Encode kit instructions meant to reach
Claude as **skills**; reserve the plugin for the Claude-native experience.

## What a plugin is

A self-contained directory of components that extends Claude Code: skills,
agents, hooks, MCP servers, LSP servers, output styles, and the experimental
themes and monitors. The manifest is **optional** — without it, Claude Code
auto-discovers components in their default locations and derives the name from
the directory. Author a manifest when you need metadata or custom paths.

## The manifest: `.claude-plugin/plugin.json`

`name` is the **only required field** when a manifest is present. Everything
else is optional.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "ai-dlc",
  "displayName": "AI-DLC",
  "description": "Claude-Code-first, cross-platform development-lifecycle kit",
  "author": { "name": "AI-DLC Team", "email": "team@example.com", "url": "https://example.com" },
  "homepage": "https://example.com/ai-dlc",
  "repository": "https://github.com/example/ai-dlc",
  "license": "Apache-2.0",
  "keywords": ["ai-dlc", "orchestrator", "skills", "agents"],
  "defaultEnabled": true
}
```

`version` is intentionally absent above (it is optional). AI-DLC's shipped
`product/.claude-plugin/plugin.json` **omits `version`** so the git commit SHA is
the plugin's update key; the SemVer source of truth is the installer's
`product/installer/package.json`. See the version gotcha below.

### Field reference

| Field            | Type    | Notes                                                                                                 |
| ---------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `name`           | string  | **Required.** kebab-case, no spaces. Used for namespacing — `ai-dlc:planner`, `/ai-dlc:some-skill`.   |
| `$schema`        | string  | Editor autocomplete/validation only; ignored at load.                                                 |
| `displayName`    | string  | UI label; may contain spaces/casing. Falls back to `name`. Requires Claude Code v2.1.143+.            |
| `version`        | string  | Semver, optional. Cache key for updates — see version gotcha below. **AI-DLC omits it** (git SHA is the update key; `package.json` holds SemVer). |
| `description`    | string  | Brief purpose.                                                                                         |
| `author`         | object  | `{ name, email, url }`.                                                                                |
| `homepage`       | string  | Docs URL.                                                                                              |
| `repository`     | string  | Source URL.                                                                                            |
| `license`        | string  | SPDX identifier (`MIT`, `Apache-2.0`).                                                                 |
| `keywords`       | array   | Discovery tags. A string here instead of an array is a **load error**, not a warning.                 |
| `defaultEnabled` | boolean | Default `true`. Set `false` to install disabled (opt-in). Requires v2.1.154+; earlier versions ignore it. |

### Path fields — ADD vs REPLACE

All paths are **relative to the plugin root and must start with `./`**. Arrays
allowed. Whether a custom path **adds to** or **replaces** the default directory
is per-field — this trips people up:

| Field                   | Default dir              | Behavior                                                                 |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `skills`                | `skills/`                | **ADDS** — default `skills/` is always scanned; listed paths load alongside it. |
| `commands`              | `commands/`              | **REPLACES** — default not scanned. To keep it, list it: `["./commands/", "./extras/"]`. |
| `agents`                | `agents/`                | **REPLACES**.                                                            |
| `outputStyles`          | `output-styles/`         | **REPLACES**.                                                            |
| `experimental.themes`   | `themes/`                | **REPLACES**. (Now under `experimental.*`; top level still loads with a warn.) |
| `experimental.monitors` | `monitors/monitors.json` | **REPLACES**. (Now under `experimental.*`.)                              |
| `hooks`                 | `hooks/hooks.json`       | Own merge rules; path, array, or inline object.                          |
| `mcpServers`            | `.mcp.json`              | Own merge rules; path, array, or inline object.                          |
| `lspServers`            | `.lsp.json`              | Own merge rules; path, array, or inline object.                          |
| `userConfig`            | —                        | Object; values prompted at enable time, substituted as `${user_config.KEY}`. |
| `dependencies`          | —                        | Array of other plugins, optionally semver-constrained: `[{ "name": "x", "version": "~2.1.0" }]`. |

When both a default folder and its manifest key exist, v2.1.140+ flags the
ignored folder in `/doctor` and `claude plugin list`; the plugin still loads
from the manifest paths.

> The task brief lists `themes`/`monitors` as top-level keys. As of mid-2026 the
> reference places them under an `experimental` object (`experimental.themes`,
> `experimental.monitors`); the top-level form still loads but `claude plugin
> validate` warns and a future release will require the `experimental.*` form.
> Prefer `experimental.*`.

### Unrecognized fields

Claude Code **ignores top-level fields it does not recognize** (so one manifest
can double as a `package.json` or VS Code/Cursor manifest). `claude plugin
validate` reports them as **warnings, not errors** — a plugin with only
unrecognized-field warnings still loads. Wrong *types* on recognized fields
still fail. Use `--strict` in CI to turn warnings into errors.

## Directory layout

`.claude-plugin/` holds **only** the manifest. Every component directory lives
at the **plugin root**, never inside `.claude-plugin/` (a top mistake — symptom
is "plugin loads but components are missing"):

```text
ai-dlc/
├── .claude-plugin/
│   └── plugin.json          # ONLY the manifest here
├── skills/
│   └── <name>/SKILL.md      # + optional reference/, scripts/
├── commands/*.md            # flat-file skills (prefer skills/ for new work)
├── agents/*.md              # subagent definitions
├── output-styles/*.md
├── hooks/hooks.json
├── monitors/monitors.json
├── themes/*.json
├── .mcp.json                # MCP servers
├── .lsp.json                # LSP servers
├── bin/                     # executables added to the Bash tool's PATH
├── scripts/                 # hook/utility scripts
├── settings.json            # default plugin settings (agent / subagentStatusLine only)
├── LICENSE
└── CHANGELOG.md
```

A bare `SKILL.md` at the plugin root (no `skills/`, no `skills` key) is
auto-loaded as a single-skill plugin in v2.1.142+; set frontmatter `name` so the
invocation name is stable across updates rather than falling back to the
version-string install directory. For a multi-skill kit, always use the
`skills/<name>/SKILL.md` layout.

### Path variables in components

Reference bundled files with the substitution variables, never absolute or `../`
paths:

- `${CLAUDE_PLUGIN_ROOT}` — the plugin's install dir. Changes on update; treat
  as ephemeral. In shell-form hook/monitor commands, wrap in double quotes:
  `"${CLAUDE_PLUGIN_ROOT}"/scripts/x.sh`.
- `${CLAUDE_PLUGIN_DATA}` — persistent state dir that survives updates
  (`node_modules`, caches). Created on first reference.
- `${CLAUDE_PROJECT_DIR}` — the consumer's project root.

## Validate

Always validate, and use `--strict` in pre-flight/CI:

```bash
claude plugin validate ./ai-dlc --strict
```

Inside a session: `/plugin validate .`. Pointed at a plugin dir, it checks
`plugin.json`, skill/agent/command frontmatter, and `hooks/hooks.json`. See the
`pre-flight-checks` skill for wiring this into the gate.

## Version gotcha (summary)

The resolved version is the cache key for updates. It resolves from, in order:
`plugin.json` `version` → marketplace-entry `version` → git commit SHA. If you
set an explicit `version` you **must bump it every release** or `/plugin update`
reports "already at the latest version". While iterating, **omit `version`** so
every commit counts as new. Never set it in both places — `plugin.json` wins
silently. **AI-DLC's shipped `product/.claude-plugin/plugin.json` omits `version`
on purpose:** the git commit SHA is the plugin's update key, while the installer's
`product/installer/package.json` `version` is the single SemVer source of truth
for the whole kit. Full mechanics live in `marketplace-publishing`.

## Anti-patterns

- Putting component dirs inside `.claude-plugin/` — they must be at the root.
- Expecting a plugin-root `CLAUDE.md` to load — it does not; use a skill.
- Referencing files via `../` — stripped on install; use symlinks within the
  marketplace or restructure.
- Trying to ship `AGENTS.md`/IDE config into a consumer repo from a plugin — not
  possible; that is `installer-design`'s job.
- Absolute paths in path fields — must be relative and start with `./`.

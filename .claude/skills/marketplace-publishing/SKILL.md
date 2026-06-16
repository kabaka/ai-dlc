---
name: marketplace-publishing
description: Reference for publishing a Claude Code plugin marketplace — the `.claude-plugin/marketplace.json` schema, plugin source types, the install/enable/update CLI and slash commands, and the version-propagation gotcha that causes "already at latest". Use when authoring or validating marketplace.json, choosing a plugin source (github/url/git-subdir/npm/relative), wiring team enforcement via extraKnownMarketplaces/enabledPlugins, seeding CI, or debugging why an update did not reach users. Keywords: marketplace.json, /plugin marketplace add, /plugin install, /plugin update, version bump, extraKnownMarketplaces, CLAUDE_CODE_PLUGIN_SEED_DIR.
---

# Marketplace Publishing (Claude Code)

This is the catalog-and-distribution reference for the kit's Claude-native
surface. It is expertise/reference, not a live marketplace — actual publishing
happens in the product phase. It builds on `plugin-packaging` (the plugin
manifest itself) and complements `installer-design` (the primary delivery for
the cross-platform top-level files a marketplace/plugin cannot ship). Every
field, source type, and command is verified against the official reference:
https://code.claude.com/docs/en/plugin-marketplaces (mid-2026).

## What a marketplace is

A catalog (`.claude-plugin/marketplace.json` at the repo root) that lists one or
more plugins and where to fetch each. Hosting it in git gives centralized
discovery, version tracking, and auto-updates. The marketplace name is
**public-facing** — users type `name@marketplace` to install.

## The catalog: `.claude-plugin/marketplace.json`

`name`, `owner`, and `plugins` are required. Minimal example:

```json
{
  "name": "ai-dlc",
  "owner": { "name": "AI-DLC Team", "email": "team@example.com" },
  "description": "AI-DLC Claude Code plugins",
  "metadata": { "pluginRoot": "./plugins" },
  "plugins": [
    {
      "name": "ai-dlc",
      "source": "./plugins/ai-dlc",
      "description": "Claude-Code-first development-lifecycle kit",
      "category": "productivity",
      "tags": ["ai-dlc", "orchestrator"]
    }
  ]
}
```

### Top-level fields

| Field                 | Required | Notes                                                                                  |
| --------------------- | -------- | -------------------------------------------------------------------------------------- |
| `name`                | **Yes**  | kebab-case, no spaces, public. One marketplace per name per user (re-adding replaces). Some names are reserved for Anthropic. |
| `owner`               | **Yes**  | `{ name (req), email (optional) }`.                                                    |
| `plugins`             | **Yes**  | Array of plugin entries (below).                                                       |
| `description`         | No       | Brief marketplace description (validator warns if absent).                             |
| `version`             | No       | Marketplace manifest version.                                                          |
| `metadata.pluginRoot` | No       | Base dir prepended to relative plugin sources — lets `"source": "ai-dlc"` mean `./plugins/ai-dlc`. |
| `$schema`             | No       | Editor autocomplete only; ignored at load.                                             |

### Plugin entry fields

`name` and `source` are required. An entry may also carry any plugin-manifest
field (`description`, `version`, `author`, `homepage`, `repository`, `license`,
`keywords`, `defaultEnabled`, and component path fields) plus the
marketplace-only fields `category`, `tags`, and `strict`.

- `strict` (default `true`): `plugin.json` is the authority; the marketplace
  entry can supplement components. `strict: false` makes the marketplace entry
  the entire definition — then a `plugin.json` that also declares components is a
  conflict and the plugin fails to load.

## Plugin sources

Set in each entry's `source`. (Distinct from the *marketplace* source, which is
where the catalog itself is fetched and supports `ref` but not `sha`.)

| Source        | Syntax                                                                              | Notes                                                                          |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Relative path | `"./plugins/ai-dlc"`                                                                 | Must start with `./`, resolved from marketplace root (not `.claude-plugin/`). No `../`. **Only works for git-added marketplaces, not URL-added ones.** |
| `github`      | `{ "source": "github", "repo": "owner/repo", "ref"?, "sha"? }`                      | `ref` = branch/tag; `sha` = full 40-char commit. When both set, `sha` wins.    |
| `url`         | `{ "source": "url", "url": "https://gitlab.com/team/p.git", "ref"?, "sha"? }`        | Any git URL (`.git` suffix optional).                                          |
| `git-subdir`  | `{ "source": "git-subdir", "url": "...", "path": "tools/plugin", "ref"?, "sha"? }`   | Sparse partial clone of a monorepo subdir. `url` accepts `owner/repo` shorthand. |
| `npm`         | `{ "source": "npm", "package": "@org/plugin", "version"?, "registry"? }`            | Installed via `npm install`. Version resolves to `unknown` for npm sources.    |

> Relative paths fail in **URL-based** marketplaces (only `marketplace.json` is
> downloaded, not the plugin files). For URL distribution, use `github`/`url`/`npm`.

## Install / manage mechanics

Slash commands run inside a session; `claude plugin …` is the scriptable CLI
equivalent. Add a marketplace, then install plugins from it:

```bash
# Add a marketplace (GitHub shorthand, git URL, raw marketplace.json URL, or local path)
/plugin marketplace add owner/repo            # @ref to pin: owner/repo@v2.0
claude plugin marketplace add owner/repo --scope project   # user | project | local

# Install / lifecycle
/plugin install ai-dlc@ai-dlc                 # name@marketplace
claude plugin enable  <plugin> [--scope ...]
claude plugin disable <plugin> [--scope ...]
claude plugin uninstall <plugin> [--scope ...] [--keep-data]
claude plugin list [--json] [--available]
claude plugin details <plugin>                # component inventory + token cost

# Update
/plugin update <plugin>                       # claude plugin update <plugin>
/plugin marketplace update [name]             # refresh catalog(s)
```

Marketplaces support **per-marketplace auto-update** (≈ v2.0.70+). Background
auto-updates need a credential token for private repos (`GITHUB_TOKEN` /
`GL_TOKEN` / `BITBUCKET_TOKEN`). Removing a marketplace from its **last** scope
uninstalls its plugins — use `marketplace update`, not `remove`, to refresh.

## Version-propagation gotcha (the one that bites)

The resolved version is the cache key. Claude Code resolves it from the first
that is set:

1. `version` in the plugin's `plugin.json`
2. `version` in the plugin's marketplace entry
3. The git commit SHA of the plugin's source
4. `unknown` (npm sources, non-git local dirs)

Consequences — internalize these:

- **If you set an explicit `version`, you MUST bump it every release.** Pushing
  new commits without bumping does nothing; `/plugin update` reports "already at
  the latest version" because the version string is unchanged.
- **To treat every commit as new** (simplest while iterating), **omit `version`**
  from both `plugin.json` and the marketplace entry — the commit SHA distinguishes
  releases automatically. Recommended default during active development.
- **Never set `version` in both places.** `plugin.json` wins silently, so a stale
  manifest version can mask a newer marketplace-entry version.

Release channels: point two marketplaces at different `ref`s/SHAs of the same
repo; each channel must resolve to a *different* version or updates are skipped.

## Team enforcement & CI seeding

Make a marketplace appear automatically when teammates trust the project, via
the consumer's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "ai-dlc": { "source": { "source": "github", "repo": "example/ai-dlc" } }
  },
  "enabledPlugins": { "ai-dlc@ai-dlc": true }
}
```

`extraKnownMarketplaces` registers the catalog; `enabledPlugins` turns specific
plugins on by default. For locked-down orgs, admins use `strictKnownMarketplaces`
in managed settings to allowlist sources.

For containers/CI, pre-populate plugins at build time and point
`CLAUDE_CODE_PLUGIN_SEED_DIR` at the directory (mirrors `~/.claude/plugins`:
`known_marketplaces.json`, `marketplaces/<name>/`, `cache/<mkt>/<plugin>/<ver>/`).
Seed marketplaces are read-only and skip auto-update.

## Validate

```bash
claude plugin validate .          # marketplace dir: schema, dup names, path traversal, version mismatch
claude plugin validate ./plugins/ai-dlc   # plugin dir: plugin.json + frontmatter + hooks.json
```

`Plugin name "x" is not kebab-case` is a warning in Claude Code but is
**rejected by the Claude.ai marketplace sync** — keep names kebab-case. Wire
both invocations into `pre-flight-checks`.

## Anti-patterns

- Setting `version` and forgetting to bump it — users silently never update.
- Setting `version` in both `plugin.json` and the entry.
- Relative-path sources in a URL-added marketplace.
- `../` in a source path (validator: `Path contains ".."`).
- Treating the marketplace/plugin as able to deliver top-level cross-platform
  files — it cannot; that is `installer-design`.

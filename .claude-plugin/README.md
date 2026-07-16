# AI-DLC marketplace catalog

`marketplace.json` here is the Claude Code marketplace catalog (per
[ADR-0003](../docs/decisions/0003-deliverable-repository-layout-and-packaging.md)).
It lists one plugin, `ai-dlc`, whose component manifest lives at
`product/.claude-plugin/plugin.json`.

## Plugin source: `./product` vs `git-subdir`

The catalog uses a **relative** plugin source:

```json
"source": "./product"
```

A relative source resolves from the **marketplace root** (this repo's root, the
directory that contains `.claude-plugin/`). It works for **git-added**
marketplaces — `/plugin marketplace add kabaka/ai-dlc` — because the whole repo is
cloned, so `product/` is present alongside the catalog.

A relative source does **not** work for a **URL-added** marketplace, where Claude
Code downloads only `marketplace.json` and never the surrounding repo. For URL
distribution, replace the relative source with a git source that points at the
`product/` subdirectory of the repo:

```json
{
  "name": "ai-dlc",
  "source": {
    "source": "git-subdir",
    "url": "kabaka/ai-dlc",
    "path": "product",
    "ref": "main"
  }
}
```

`git-subdir` does a sparse partial clone of just `product/`. `url` accepts the
`owner/repo` shorthand. Pin `ref` to a tag (or add `sha`) for a stable release
channel.

## Install

This plugin channel is **secondary** — it delivers the Claude-native agents and
skills, but not the top-level files (`AGENTS.md`, `CLAUDE.md`, and the
cross-platform steering). For those, run the primary installer,
`npx @kabaka/ai-dlc init` (see the [product README](../product/README.md)).

**Local Claude Code CLI** (interactive slash commands):

```text
/plugin marketplace add kabaka/ai-dlc
/plugin install ai-dlc@ai-dlc
```

The git-added marketplace clones the whole repo, so the relative `./product`
source resolves.

**Claude Code on the web / cloud.** The interactive `/plugin` commands are **not
available** there. Declare the plugin ahead of time in your target repo's
project-scope `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "ai-dlc": { "source": { "source": "github", "repo": "kabaka/ai-dlc" } }
  },
  "enabledPlugins": { "ai-dlc@ai-dlc": true }
}
```

`enabledPlugins` is an object map of `"name@marketplace": true`, not an array.
Alternatively, run the non-interactive `claude plugin marketplace add kabaka/ai-dlc`
and `claude plugin install ai-dlc@ai-dlc` from the environment's setup script or a
`SessionStart` hook. On the web the plugin channel still does not deliver the
top-level files, so `npx @kabaka/ai-dlc init` (or the setup script) is still
needed for those.

## Versioning

`plugin.json` **intentionally omits** a `version` field. With no explicit version,
Claude Code keys plugin-channel updates on the plugin source's **git commit SHA**:
every published commit counts as a new release, so `/plugin update` is never
falsely "already at the latest version". The manifest carries no SemVer — the SHA
is the sole plugin-channel update key.

SemVer lives on the **npm package** (`@kabaka/ai-dlc`) instead, which is the
primary installer channel. Versions there are team-owned and automated; consumers
never hand-edit them.

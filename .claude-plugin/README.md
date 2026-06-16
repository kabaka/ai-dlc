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

```bash
# git-added marketplace (relative source works):
/plugin marketplace add kabaka/ai-dlc
/plugin install ai-dlc@ai-dlc
```

## Versioning

`plugin.json` intentionally omits `version` while the kit iterates: with no
explicit version set, Claude Code uses the plugin source's git commit SHA as the
update cache key, so every published commit counts as a new release and
`/plugin update` is never falsely "already at the latest version". When the team
cuts SemVer releases, it owns the version bump — consumers never hand-edit it.

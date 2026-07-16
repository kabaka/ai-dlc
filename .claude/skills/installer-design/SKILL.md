---
name: installer-design
description: Design guidance for the AI-DLC installer — the PRIMARY delivery mechanism, because the kit must ship top-level cross-platform files (AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, .cursor/rules/, .kiro/steering/) that a Claude Code plugin provably cannot manage. Use when designing `npx ai-dlc init`/`update`, choosing a distribution channel, planning idempotent merge/version-stamp update semantics, or weighing npm vs git-submodule vs curl|bash vs copy-.claude. Keywords: installer, npx ai-dlc, scaffold, idempotent update, version stamp, drift detection, cross-platform steering files.
---

# Installer Design (AI-DLC)

This is **design guidance** for how the deliverable kit reaches consumers. The
installer described here **is fully implemented** in `product/installer/` (the
`npx ai-dlc init`/`update` CLI, idempotent merge/version-stamp semantics, and the
opt-in rtk channel below); this skill is the design rationale behind it, kept for
future changes. It sits above `plugin-packaging` and `marketplace-publishing`:
those cover the Claude-native plugin surface; this covers everything that surface
provably cannot deliver. Verified against
https://code.claude.com/docs/en/plugins-reference and the AWS reference
distribution https://github.com/awslabs/aidlc-workflows (mid-2026).

## Why an installer is the primary delivery

A Claude Code plugin **cannot place top-level files into a consumer's repo.**
Installed plugins are copied to `~/.claude/plugins/cache`, `../` paths are
stripped, and a plugin-root `CLAUDE.md` is not loaded as project context (see
`plugin-packaging`). So a plugin cannot write the cross-platform files the kit
depends on:

- `AGENTS.md` — canonical orchestrator, read by Cursor / Copilot / Kiro
- `CLAUDE.md` — Claude Code entry (imports `@AGENTS.md`)
- `.github/copilot-instructions.md`
- `.cursor/rules/`
- `.kiro/steering/`

These are project-tree files, the heart of a cross-platform kit. The AWS
reference, `awslabs/aidlc-workflows`, distributes exactly this way: a release zip
of steering files that users **copy** into `.kiro/steering/`, `.cursor/rules/`,
`.github/copilot-instructions.md`, `CLAUDE.md`, etc. — there is no plugin. AI-DLC
improves on the manual copy with a real installer.

**Decision: ship BOTH.**

- The **installer owns** the top-level / cross-platform files. **Mandatory** — it
  is the only thing that can place them.
- The **plugin + marketplace** is the value-add for Claude Code users:
  discovery, one-line install, and auto-update of the Claude-native skills and
  agents. **Secondary**, but worth shipping for the Claude-Code-first audience.

## Recommended channel: npm + `npx`

npm gives free semantic versioning and a one-line, no-clone install. Two
commands:

- `npx ai-dlc init` — **scaffold.** Detect which platforms the repo targets,
  write the top-level files, and record a version stamp. Idempotent: re-running
  on an already-initialized repo behaves like `update`.
- `npx ai-dlc update` — **re-apply + merge.** Bring an existing install up to the
  current kit version deterministically, without clobbering user edits.

### Idempotent, merge-aware update semantics

The update path is the hard part. Make it deterministic and non-destructive:

1. **Version stamp.** On `init`, write a stamped marker recording the installed
   kit version and a hash (or per-file hashes) of each file as the installer
   wrote it — e.g. `.ai-dlc/manifest.json` (kit version, file list, hashes).
2. **Drift detection.** On `update`, for each managed file compare three states:
   the **installed** content, the **stamped** baseline (what the installer last
   wrote), and the **new** kit version.
   - Unchanged by the user (installed hash == stamped hash) → overwrite cleanly
     with the new version and re-stamp.
   - User-edited (installed hash != stamped hash) → **do not clobber.** Detect
     the conflict and prompt: keep, overwrite, write the new version alongside
     (e.g. `AGENTS.md.new`), or show a diff. Re-stamp only the files actually
     updated.
3. **Idempotence.** Running `update` twice with no kit change is a no-op (hashes
   match the stamp). `init` on an initialized repo routes to `update`.
4. **Managed vs user regions.** Where a file is partly generated and partly
   user-owned, delimit the generated region with stable markers
   (`<!-- ai-dlc:begin -->` … `<!-- ai-dlc:end -->`) and merge only inside them,
   leaving the rest of the file untouched. Prefer whole-file stamping for files
   the kit fully owns; use marker regions only where the consumer co-owns a file.
5. **Dry run + report.** Support `--dry-run` and always report what changed,
   what was skipped due to drift, and what needs the user's attention.

Security note: an installer runs on the consumer's machine. It is in scope for
the `security` agent and `security-review` skill — no `curl | bash` of unpinned
remote code, validate inputs, least privilege, no surprise network calls.

## Optional feature channel: rtk (opt-in, Claude-Code-only)

The installer also gates an **optional** integration behind a flag: `--with-rtk`
(equivalently `AIDLC_ENABLE_RTK=1` in the install-time environment) lands the
opt-in rtk output-compression hook and files; `--without-rtk` removes them. The
default path lands **nothing** rtk-related and stays byte-for-byte unchanged, and
`update` preserves a prior `--with-rtk` choice via an `rtk` block in the manifest.
Note the design split: the installer only makes rtk *available*; the authoritative
**runtime** activation gate is the `AIDLC_ENABLE_RTK` env var read inside the hook
(a committed hook fires for everyone, so opt-in must hold where the hook runs, not
just at install time). See ADR 0013 for the full rationale.

## Channel tradeoffs

| Channel              | Ships top-level files? | Updatable?                          | Discoverability | Friction                                  |
| -------------------- | ---------------------- | ----------------------------------- | --------------- | ----------------------------------------- |
| **npm + `npx`** (rec) | Yes                    | Yes — versioned, merge-aware `update` | Medium (npm)    | Low — one line, no clone, no global install |
| git submodule        | Indirect (symlink/copy step) | Yes (`git submodule update`)   | Low             | High — submodule UX, manual wiring         |
| `curl \| bash`       | Yes                    | Re-run script (versioning is DIY)   | Low             | Low to run, but a supply-chain/trust risk  |
| Copy `.claude/` by hand | Partial — misses non-Claude files | No — manual re-copy, drift unmanaged | Low | High, error-prone (the AWS-zip baseline)   |
| Claude Code plugin   | **No** (cannot)        | Yes (marketplace auto-update)       | High (`/plugin`) | Lowest — but Claude-native scope only      |

Reading: npm is the only channel that ships top-level files **and** gives clean
versioned, idempotent updates at low friction. The plugin scores highest on
discoverability/updatability but cannot ship the files — which is exactly why
both are shipped.

## How the two channels divide the kit

| Artifact                                                        | Delivered by                  |
| --------------------------------------------------------------- | ----------------------------- |
| `AGENTS.md`, `CLAUDE.md`, `.github/`, `.cursor/`, `.kiro/`      | **Installer** (only option)   |
| `.claude/skills/`, `.claude/agents/` for Claude Code users      | Installer **and** plugin      |
| Claude Code discovery, one-line install, auto-update            | **Plugin + marketplace**      |
| Version stamp / drift manifest in the consumer repo             | **Installer**                 |

Keep a single source of truth in this repo (`AGENTS.md` canonical; `.claude/`
assets shared) per `cross-platform-config`; both channels build their payloads
from it rather than maintaining parallel copies.

## Anti-patterns

- Treating the plugin as the primary delivery — it cannot ship top-level files.
- A non-idempotent installer that re-running breaks or duplicates content.
- Clobbering user edits on `update` — always detect drift via the stamp and
  prompt.
- Versioning by hand — npm + semver gives it for free; the team owns version
  bumps (the product owner never hand-edits versions).
- `curl | bash` of unpinned remote code as the recommended path — pin and review.
- Building installer and plugin payloads from divergent sources instead of the
  single source of truth.

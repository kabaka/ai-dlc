# ai-dlc installer

Scaffolds and updates the AI-DLC kit in your repository. This is the **primary**
delivery mechanism (ADR-0002): a Claude Code plugin cannot place top-level files
like `AGENTS.md`/`CLAUDE.md` into your repo, so the installer owns them.

```bash
npx ai-dlc init      # scaffold the kit into the current repo
npx ai-dlc update    # update an existing install to the current kit version
npx ai-dlc init --dry-run     # print the plan, write nothing
npx ai-dlc init --with-rtk    # also land the opt-in rtk output-compression hook
npx ai-dlc init --without-rtk # remove the rtk hook + files (arbiter gate kept)
```

Zero runtime dependencies (Node >= 18, built-ins only).

## What it lands

| Path (in your repo)                     | Ownership   | Notes |
| --------------------------------------- | ----------- | ----- |
| `AGENTS.md`, `CLAUDE.md`                | co-owned    | Preserved if you already have them (see below). |
| `.claude/agents/*`, `.claude/skills/*` | kit-owned   | The specialist roster + on-demand skills. |
| `.ai-dlc/templates/artifacts/*`        | kit-owned   | Methodology artifact templates to copy. |
| `.ai-dlc/hooks/arbiter-gate.sh`        | kit-owned   | The arbiter-gate hook (executable). |
| `.ai-dlc/hooks/rtk-wrap.sh`, `.ai-dlc/rtk/*` | kit-owned | The opt-in rtk hook + files — landed **only** with `--with-rtk` (see below). |
| `.github/*`, `.cursor/*`, `.kiro/*`    | kit-owned   | Cross-platform steering (landed only if shipped). |
| `.ai-dlc/manifest.json`                | installer   | Version stamp + per-file hashes. |
| `.claude/settings.json`                | merged      | The hook is wired in idempotently; your other settings are untouched. |

## Idempotent, version-stamped, drift-aware (ADR-0006)

- **Idempotent.** Re-running `init`/`update` with no kit change writes nothing.
  `init` on an already-initialized repo behaves like `update`.
- **Version-stamped.** `.ai-dlc/manifest.json` records the kit version and the
  SHA-256 of each file as the installer wrote it.
- **Drift detection.** On `update`, a kit-owned file you edited (on-disk hash !=
  stamped hash) is **not** clobbered — the new version is written as `<file>.new`
  and flagged for you to merge.
- **Consumer-file preservation.** A pre-existing, marker-less `AGENTS.md` or
  `CLAUDE.md` is **never edited in place**. The new version is written as
  `<file>.new` with merge instructions. To make future updates automatic, wrap the
  kit-managed section in `<!-- ai-dlc:begin -->` / `<!-- ai-dlc:end -->` markers
  (opt-in); the installer then updates only that region.

## The arbiter-gate hook — what it enforces, honestly

The installer wires a Claude Code `PreToolUse` hook
(`.ai-dlc/hooks/arbiter-gate.sh`) into your `.claude/settings.json`.

**It enforces:** before a *phase-transition* Bash command runs, the hook checks
for an **approve** Decision Record under `.ai-dlc/records/`. If none is present,
the command is **denied** with an explicit reason. The transitions it recognizes
are matched by **command word** (anchored, not substring): `git merge`,
`gh pr merge`, and `git push` to a protected branch (construction-to-merge);
`git tag` create, `npm publish`, and a `deploy`/`release` command word
(to-operations). The set of protected branches is configurable via
`AIDLC_PROTECTED_BRANCHES` (default `^(main|master|release/.+)$`). This is the
deterministic enforcement the orchestrator prose cannot give — the model cannot
talk past a missing human decision.

**It cannot enforce:**

- **Gates 1 and 2** (Inception->Construction, design fork) are conceptual
  transitions, not single tool calls; no command marks them. Those rely on the
  orchestrator's "strongly instructed" prose, labeled best-effort.
- A transition performed through a renamed wrapper the hook does not recognize,
  through a non-Bash tool, or outside Claude Code is out of scope.
- It checks only that a human approval *exists* — it never judges or makes the
  decision. **You remain the sole arbiter.**

**`jq` is required.** The hook parses the command with `jq`; if `jq` is absent it
**fails closed** — every gated command is **denied** with a remediation message
(a regex/grep JSON "parser" can be tricked into failing open, so the hook refuses
to guess). Install [`jq`](https://jqlang.github.io/jq/) before you reach a gated
command, or disable the hook in `.claude/settings.json` if you accept losing gate
enforcement.

## Configuration (environment variables)

| Variable                  | Effect |
| ------------------------- | ------ |
| `AIDLC_RECORDS_DIR`       | Where the arbiter-gate hook looks for approve Decision Records (default `.ai-dlc/records`). |
| `AIDLC_PROTECTED_BRANCHES`| Anchored extended-regex of branches that make a `git push`/`git merge` a gated construction-to-merge transition (default `^(main\|master\|release/.+)$`). |
| `AIDLC_INSTALL_RTK`       | **Install-time** opt-in for the rtk hook (see below): `1` is the non-interactive equivalent of `--with-rtk` — lands + wires the (inert) rtk hook. Read only during `init`/`update`. |
| `AIDLC_ENABLE_RTK`        | **Runtime** activation gate for the opt-in rtk hook (see below): `1` enables output compression for the session; unset/`0` leaves the wired hook inert. **Not** read at install time. |
| `AIDLC_PAYLOAD_ROOT`      | Override the installer's payload source (testing / custom builds). |

## Optional: rtk output compression (`--with-rtk`)

rtk ("Rust Token Killer") is an **opt-in, Claude-Code-only** integration that
routes noisy Bash output through [rtk](https://github.com/rtk-ai/rtk) via a
**separate** `PreToolUse` hook, cutting output tokens by ~60–90%. It is **off by
default**: a plain `init`/`update` lands nothing rtk-related and leaves your
install byte-for-byte unchanged.

- **`--with-rtk`** — land the rtk files (`.ai-dlc/hooks/rtk-wrap.sh`,
  `.ai-dlc/rtk/install-rtk.sh`, `.ai-dlc/rtk/RTK.md`) and wire the rtk hook.
  Setting `AIDLC_INSTALL_RTK=1` **at install time** is the non-interactive
  equivalent of the flag. (`RTK.md` is a human-readable reference doc, **not**
  auto-loaded into agent context.) `update` **preserves** a prior `--with-rtk`
  choice (persisted as an `rtk` block in `.ai-dlc/manifest.json`), so a later
  plain `update` keeps rtk wired.
- **`--without-rtk`** — remove the rtk hook entry and rtk files cleanly, and
  record a **sticky opt-out**: a later `update` will **not** bring rtk back, and
  no environment variable silently re-enables it — only an explicit `--with-rtk`
  (or `AIDLC_INSTALL_RTK=1`) re-installs. The arbiter-gate hook and any of your
  own hooks are left intact.

**Two distinct signals.** *Install* (`--with-rtk` / `AIDLC_INSTALL_RTK=1`) lands
the files and wires the (inert) hook; *runtime activation* is the separate,
**runtime-only** `AIDLC_ENABLE_RTK=1`. Landing the files only makes rtk
*available*; the wired hook stays **inert** until `AIDLC_ENABLE_RTK=1` is set in
the environment at **runtime** (the installer never reads it). This is
intentional — a committed hook fires for every contributor who clones the repo, so
activation is enforced where the hook actually runs, and in Claude Code cloud the
cached setup script cannot toggle it. Set `AIDLC_ENABLE_RTK=0` (or unset it) to
disable per session without uninstalling.

The rtk hook is independent of the arbiter gate and never weakens it: Claude Code
runs `PreToolUse` hooks in parallel on the original command and `deny` wins, and
the wrapper both passes transition commands through un-compressed and fails open
if rtk is absent. Full consumer guide: [rtk output compression](../docs/rtk.md).
See [ADR 0013](../../docs/decisions/0013-opt-in-rtk-output-compression.md) for the
rationale.

## Security

The installer runs on your machine and writes files in your repo. It performs no
network calls, pins no remote code, and never overwrites consumer-authored files
in place. It is subject to a mandatory `security` review on every change
(ADR-0006).

<!-- ai-dlc:link-check-ignore-file -->

# ai-dlc installer

Scaffolds and updates the AI-DLC kit in your repository. This is the **primary**
delivery mechanism (ADR-0002): a Claude Code plugin cannot place top-level files
like `AGENTS.md`/`CLAUDE.md` into your repo, so the installer owns them.

```bash
npx ai-dlc init      # scaffold the kit into the current repo
npx ai-dlc update    # update an existing install to the current kit version
npx ai-dlc init --dry-run   # print the plan, write nothing
```

Zero runtime dependencies (Node >= 18, built-ins only).

## What it lands

| Path (in your repo)                     | Ownership   | Notes |
| --------------------------------------- | ----------- | ----- |
| `AGENTS.md`, `CLAUDE.md`                | co-owned    | Preserved if you already have them (see below). |
| `.claude/agents/*`, `.claude/skills/*` | kit-owned   | The specialist roster + on-demand skills. |
| `.ai-dlc/templates/artifacts/*`        | kit-owned   | Methodology artifact templates to copy. |
| `.ai-dlc/hooks/arbiter-gate.sh`        | kit-owned   | The arbiter-gate hook (executable). |
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

**It enforces:** before a *phase-transition* Bash command runs (merge, push, tag,
publish, deploy/release — by default; configurable via `AIDLC_GATE_PATTERNS`), the
hook checks for an **approve** Decision Record under `.ai-dlc/records/`. If none is
present, the command is **denied** with an explicit reason. This is the
deterministic enforcement the orchestrator prose cannot give — the model cannot
talk past a missing human decision.

**It cannot enforce:**

- **Gates 1 and 2** (Inception->Construction, design fork) are conceptual
  transitions, not single tool calls; no command marks them. Those rely on the
  orchestrator's "strongly instructed" prose, labeled best-effort.
- Transitions phrased to dodge the patterns, or performed through other tools or
  outside Claude Code, are out of scope. Tune `AIDLC_GATE_PATTERNS` to your tools.
- It checks only that a human approval *exists* — it never judges or makes the
  decision. **You remain the sole arbiter.**

`jq` is used when present for robust JSON parsing; a pure-bash fallback runs
otherwise, so the hook works on a bare machine.

## Configuration (environment variables)

| Variable               | Effect |
| ---------------------- | ------ |
| `AIDLC_RECORDS_DIR`    | Where the hook looks for approve Decision Records (default `.ai-dlc/records`). |
| `AIDLC_GATE_PATTERNS`  | Extended-regex identifying phase-transition Bash commands. |
| `AIDLC_PAYLOAD_ROOT`   | Override the installer's payload source (testing / custom builds). |

## Security

The installer runs on your machine and writes files in your repo. It performs no
network calls, pins no remote code, and never overwrites consumer-authored files
in place. It is subject to a mandatory `security` review on every change
(ADR-0006).

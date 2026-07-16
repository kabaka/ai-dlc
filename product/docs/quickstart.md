# Quickstart

Install AI-DLC into a repo and run one small unit of work through a phase — far
enough to see a Decision Record and a blocking gate. About ten minutes.

Prerequisites: Node 18+, a git repo you can scaffold into, and Claude Code for the
full experience (other tools degrade — see
[cross-platform support](cross-platform.md)). The arbiter-gate hook also needs
[`jq`](https://jqlang.github.io/jq/) on your `PATH`; without it the hook **fails
closed** (denies every gated command) rather than guessing, so install `jq` before
you reach the merge step.

## 1. Install

From the root of your repo:

```bash
npx ai-dlc init
```

Preview first if you like — `npx ai-dlc init --dry-run` prints the plan and writes
nothing.

Optionally add `--with-rtk` to enable the opt-in, Claude-Code-only
[rtk output compression](rtk.md) hook (off by default; it also needs a runtime
env var to activate).

## 2. See what landed

After `init`, your repo has:

```text
your-repo/
├── AGENTS.md                       # canonical Orchestrator definition
├── CLAUDE.md                       # @AGENTS.md import + Claude Code notes
├── .claude/
│   ├── agents/                     # the 12 specialist lifecycle agents
│   └── skills/                     # on-demand procedural playbooks
├── .ai-dlc/
│   ├── templates/artifacts/        # decision-record, unit-of-work, …
│   ├── hooks/arbiter-gate.sh       # the arbiter-gate hook (executable)
│   ├── records/                    # where you store approve Decision Records
│   └── manifest.json               # version stamp + per-file hashes
├── .github/  .cursor/  .kiro/      # cross-platform steering files
└── .claude/settings.json           # the hook wired in (your other settings untouched)
```

If your repo already had an `AGENTS.md` or `CLAUDE.md`, it was **preserved**: the
kit's version was written alongside as `AGENTS.md.new` with merge instructions,
not over your file.

## 3. Start a session and describe one unit of work

Open Claude Code in the repo and talk to the Orchestrator as the product owner —
you describe outcomes, it does the work. Keep the first one tiny, for example:

> Add a `--version` flag to the CLI that prints the package version and exits 0.

The Orchestrator runs **Inception**: `requirements-analyst` turns your request
into a **unit of work** — scope, acceptance criteria, non-goals, dependencies, and
a `risk_tier`. This one is small and reversible, so it triages as **trivial**:
lightweight ceremony, but the gate still applies.

The shape it produces matches `.ai-dlc/templates/artifacts/unit-of-work.md`.

## 4. Record the first arbiter decision (Gate 1)

Inception → Construction is **Gate 1**. Before any building starts, *you* record
the decision. `init` created `.ai-dlc/records/` for exactly this. Copy the template
and fill it:

```bash
cp .ai-dlc/templates/artifacts/decision-record.md .ai-dlc/records/DR-0001.md
```

Set the machine fields the hook reads — `transition`, `chosen_option`, and
`target` — plus the human context:

```text
decision_id:   DR-0001
transition:    inception-to-construction
chosen_option: approve
target:        construction
unit_of_work:  UOW-version-flag
rationale:     trivial, reversible CLI flag; acceptance criteria are clear
approver:      <you>
date:          2026-06-16
risk_tier:     trivial
```

Gate 1 is a **conceptual** transition: no single Bash command marks it, so the
hook **cannot** block it — it is discipline-only. Record it anyway for an auditable
trail; the Orchestrator is strongly instructed not to start Construction without
it. The hook only blocks the two **command-level** gates you meet next: Gate 3
(merge) and Gate 4 (deploy/release).

## 5. Let Construction run, then watch the gate fire

With Gate 1 recorded, the Orchestrator runs **Construction**: `architect` (for
anything structural), `planner` for sequence, `implementer` to build, and
`test-engineer` to own the grading tests derived from your acceptance criteria —
the implementer cannot edit those.

When the unit is ready to merge into a protected branch, that is **Gate 3** — a
command-level transition the **arbiter-gate hook** guards. The hook matches
specific command words: `git merge`, `gh pr merge`, and `git push` whose ref
targets a protected branch (`main`, `master`, or `release/*`). Try one before
recording the merge decision and the hook **denies** it with an explicit reason:

```text
AI-DLC arbiter gate: this command is a 'construction-to-merge' phase transition
(target: 'main'), but no matching approved Decision Record was found under
'.ai-dlc/records/'. Required: a record with machine fields
transition: construction-to-merge, chosen_option: approve, and target: main
(the branch/tag being acted on). ...
```

This is the enforcement the cross-platform doc calls out: on Claude Code Gate 3 is
a real installed hook, not a prompt the model can skip. (A push to an unprotected
feature branch is **not** a gated transition and passes through untouched.)

## 6. Approve the merge (Gate 3) and continue

Record the merge decision the same way. The hook matches three machine fields by
**exact value**: `transition`, `chosen_option: approve`, and `target` set to the
branch you are merging into (here, `main`). The `target` is a freshness check — a
record for a different branch will **not** authorize this merge.

```bash
cp .ai-dlc/templates/artifacts/decision-record.md .ai-dlc/records/DR-0002.md
```

```text
decision_id:   DR-0002
transition:    construction-to-merge
chosen_option: approve
target:        main
unit_of_work:  UOW-version-flag
rationale:     reviewed and approved for integration into main
approver:      <you>
date:          2026-06-16
risk_tier:     trivial
```

Keep `chosen_option` exactly `approve` — the hook compares it literally, so
`approve, pending CI` would **not** open the gate. With the record in place the
merge proceeds.

Deploy/release is **Gate 4** (`to-operations`): `git tag` (create), `npm publish`,
or a `deploy`/`release` command. Record one more Decision Record when you ship —
`transition: to-operations`, `chosen_option: approve`, and `target` set to the tag
you create (e.g. `v1.0.0`) or to `release` for a publish/deploy that has no single
ref.

## What you just saw

- A request became a structured **unit of work**.
- **You** — not the AI — opened each phase with a recorded **Decision Record**.
- The **arbiter-gate hook** mechanically blocked a transition until your decision
  existed.

Next, read the [usage guide](usage.md) for the full phase-by-phase agent and skill
map, complexity triage, the research fan-out workflow, and every artifact
template.

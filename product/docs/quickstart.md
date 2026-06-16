<!-- ai-dlc:link-check-ignore-file -->

# Quickstart

Install AI-DLC into a repo and run one small unit of work through a phase — far
enough to see a Decision Record and a blocking gate. About ten minutes.

Prerequisites: Node 18+, a git repo you can scaffold into, and Claude Code for the
full experience (other tools degrade — see
[cross-platform support](cross-platform.md)).

## 1. Install

From the root of your repo:

```bash
npx ai-dlc init
```

Preview first if you like — `npx ai-dlc init --dry-run` prints the plan and writes
nothing.

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
the decision. Copy the template and fill it:

```bash
cp .ai-dlc/templates/artifacts/decision-record.md .ai-dlc/records/DR-0001.md
```

Set at least:

```text
decision_id:   DR-0001
transition:    inception-to-construction
unit_of_work:  UOW-version-flag
chosen_option: approve
rationale:     trivial, reversible CLI flag; acceptance criteria are clear
approver:      <you>
date:          2026-06-16
risk_tier:     trivial
```

A gate opens **only** on an `approve` decision. No record = closed gate = the
Orchestrator must not proceed to Construction.

## 5. Let Construction run, then watch the gate fire

With Gate 1 recorded, the Orchestrator runs **Construction**: `architect` (for
anything structural), `planner` for sequence, `implementer` to build, and
`test-engineer` to own the grading tests derived from your acceptance criteria —
the implementer cannot edit those.

When the unit is ready to merge, that is a phase transition the **arbiter-gate
hook** guards. Try to merge before recording the merge decision and the hook
**denies** the command with an explicit reason:

```text
ai-dlc arbiter gate: no approve Decision Record found under .ai-dlc/records
for a construction-to-merge transition. Record one, then retry.
```

This is the enforcement the cross-platform doc calls out: on Claude Code the gate
is a real installed hook, not a prompt the model can skip.

## 6. Approve the merge (Gate 3) and continue

Record the merge decision the same way:

```bash
cp .ai-dlc/templates/artifacts/decision-record.md .ai-dlc/records/DR-0002.md
# transition: construction-to-merge ; chosen_option: approve
```

Now the merge proceeds. Deploy/release is **Gate 4** — record one more Decision
Record when you ship.

## What you just saw

- A request became a structured **unit of work**.
- **You** — not the AI — opened each phase with a recorded **Decision Record**.
- The **arbiter-gate hook** mechanically blocked a transition until your decision
  existed.

Next, read the [usage guide](usage.md) for the full phase-by-phase agent and skill
map, complexity triage, the research fan-out workflow, and every artifact
template.

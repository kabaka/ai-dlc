# Usage guide

This is the working manual for running the AI-DLC lifecycle on your own code or
research. The [quickstart](quickstart.md) gets you to a first gate; this guide
covers the whole loop, the gates, triage, research, and the artifacts. The
canonical Orchestrator definition is `AGENTS.md`; procedures live in the installed
skills. This guide points to them rather than restating them.

## The loop, phase by phase

You talk to the **Orchestrator** (your main session). It runs three phases and
gates each transition on **your** recorded decision. You are the product owner and
**sole arbiter** — you decide; you do not implement.

| Phase | Question | Lead agents | Driving skills |
| ----- | -------- | ----------- | -------------- |
| **Inception** | WHAT / WHY | `requirements-analyst`, `researcher`, `research-synthesizer` | `requirements-elaboration`, `research-method`, `citation-verification` |
| **Construction** | HOW | `architect`, `planner` (×2), `implementer`, `test-engineer`, `code-reviewer`, `debugger` | `architecture-design`, `implementation-planning`, `testing-strategy`, `code-review`, `rca-investigation` |
| **Operations** | run it | `devops`, `security` | `delivery-operations`, `security-review` |

Routing boundaries keep delegation unambiguous: `architect` owns **structure**,
`planner` owns **sequence**; `code-reviewer` is the **pre-merge gate** and
`debugger` is **post-failure diagnosis**; `researcher` **gathers** and
`research-synthesizer` **synthesizes**. The full mechanics — Solo Mob rounds,
agent scaling, tool-call budgets — are in the `aidlc-workflow` skill; the concepts
and vocabulary (bolts, units of work, the arbiter) are in `aidlc-methodology`.

## The arbiter gates (Decision Records)

Four phase transitions require a recorded human **Decision Record** before work
may proceed:

1. **inception-to-construction** — requirements + units of work approved.
2. **design-fork** — architecture/plan approved, before implementation.
3. **construction-to-merge** — the implemented unit approved for integration.
4. **to-operations** — the change authorized for deploy/release.

A gate opens **only** when a Decision Record for that transition has
`chosen_option` set to an approval. Absence of a record means a closed gate, and
the AI must not proceed. Copy
`.ai-dlc/templates/artifacts/decision-record.md`, fill every field
(`decision_id`, `transition`, `unit_of_work`, `chosen_option`, `rationale`,
`approver`, `date`, `risk_tier`), and store it where the hook looks
(`.ai-dlc/records/` by default).

### What the hook enforces — honestly

On Claude Code the installer wires a `PreToolUse` hook that **denies**
phase-transition Bash commands (merge, push, tag, publish, deploy/release) until
an approve Decision Record exists. That covers **Gate 3 and Gate 4** mechanically.

**Gates 1 and 2** are conceptual transitions, not single commands — no shell call
marks them — so they rely on the Orchestrator's honestly-labeled "strongly
instructed" prose, not a hook. The hook also only checks that an approval
*exists*; it never judges or makes the decision. **You remain the sole arbiter.**
On non-Claude tools there is no hook at all — record your decisions by discipline.
See the [cross-platform contract](cross-platform.md) and the
[installer reference](../installer/README.md) for the exact boundaries and the
`AIDLC_GATE_PATTERNS` / `AIDLC_RECORDS_DIR` configuration.

## Complexity triage

Scale ceremony **depth** to each unit's `risk_tier` — never the gate.

| Tier | When | Ceremony | Decision Record |
| ---- | ---- | -------- | --------------- |
| **trivial** | low-risk, reversible, narrow | single proposer, inline approval | may be terse |
| **standard** | typical feature | full Solo Mob: lead proposes, ≥1 challenge agent contests | full |
| **high-risk** | irreversible, security-sensitive, broad blast radius, high ambiguity | deepest: multiple challengers incl. `security`, options surfaced and recorded | full + high-risk addendum; consider an ADR |

Triage reduces ceremony, **never the arbiter gate** — even a trivial unit crosses
a recorded human decision point. The high-risk addendum (alternatives considered,
risk note) is part of the decision-record template.

## The research workflow

Research is a first-class peer to software development, with a different shape:
**research parallelizes; software development is linear.**

- **Fan out.** Dispatch many `researcher` agents concurrently to gather across
  sources (`research-method` skill).
- **Synthesize through the citation gate.** `research-synthesizer` collapses the
  findings and runs the **citation-verification gate** (`citation-verification`
  skill): one row per load-bearing claim in a **citation ledger**, each row naming
  the specific source URL, the date it was **re-fetched and read**, whether it
  `supports` the claim as stated, and a confidence level. No report emits until
  the ledger is complete, and **no claim may assert more strongly than its weakest
  supporting citation.**

Use `.ai-dlc/templates/artifacts/citation-ledger.md` for the ledger. Software-dev
hand-offs, by contrast, are **sequential with full-context transfer**: each phase
hands the next a complete artifact, so the downstream agent needs nothing the
brief doesn't carry.

## Don't edit the oracle

The `test-engineer` owns the **test oracle** — the grading tests derived from a
unit's `acceptance_criteria` — as an independent verifier. The `implementer` may
**not** weaken, delete, or rewrite those tests to make work pass. Passing must
mean the code is right, not that the test was bent. `code-reviewer` checks
intent-versus-letter at the pre-merge gate and emits one enumerated verdict
(`APPROVE`, `REQUEST_CHANGES`, `ESCALATE_SECURITY`, `BLOCK`); even `APPROVE` does
not open Gate 3 — your Decision Record does.

## The artifact templates

The installer lands these under `.ai-dlc/templates/artifacts/`. Copy one, fill it,
and store the completed copy where your project keeps such records. Each is a
**contract**, kept compact and structured — not narrative.

| Template | Produced by | Role |
| -------- | ----------- | ---- |
| `unit-of-work.md` | `requirements-analyst` | The Inception output and the Inception → Construction handoff contract: scope, acceptance criteria, non-goals, dependencies, `bolt_time_box` (intent only — no timer), `risk_tier`, and the Gate 1 sign-off reference. |
| `decision-record.md` | you (the arbiter) | The approval at each of the four gates. |
| `phase-handoff.md` | each Construction stage | The architecture, plan, diff+tests, review-verdict, and operations-record handoffs that carry work across phase boundaries. |
| `citation-ledger.md` | `research-synthesizer` | The blocking evidence gate for research deliverables. |

The handoff chain is `requirements → architecture → plan → diff+tests → review
verdict → ops record`; each receiving stage consumes the producing stage's whole
output. The templates carry inline field-by-field guidance — read them in place
rather than memorizing them here.

## Updating the kit

```bash
npx ai-dlc update
```

Updates are idempotent and version-stamped. A kit-owned file you edited is not
clobbered — the new version arrives as `<file>.new` for you to merge — and your
own `AGENTS.md` / `CLAUDE.md` content is preserved. To make future updates of the
managed region automatic, wrap it in `<!-- ai-dlc:begin -->` /
`<!-- ai-dlc:end -->` markers (opt-in). Full semantics are in the
[installer reference](../installer/README.md).

## Other platforms

The kit is **Claude-Code-first** and degrades — not at parity — onto GitHub
Copilot, Cursor, Kiro, and other `AGENTS.md` readers. The specialist roster works
on Claude Code and Copilot (both read `.claude/agents/`); skills auto-load and the
arbiter gate is enforced **only** on Claude Code. The
[cross-platform contract](cross-platform.md) is the authoritative per-tool table —
believe it over any impression a steering file's tone might give.

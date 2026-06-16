# The arbiter gate & Decision Record

Detail on the four blocking gates, the Decision Record artifact, and the
blocking-gate semantics. The human is the **sole arbiter** at every gate.

## The four gates

A gate is a phase-transition point where "AI proceeds only after human validation"
takes concrete form. Between gates AI proposes and contests freely; **at** a gate
work is **blocked** until the human records a decision.

| # | Transition | What is approved |
| --- | --- | --- |
| 1 | **Inception → Construction** | Requirements + units of work. |
| 2 | **Construction · design fork** | Architecture / plan, *before* implementation. |
| 3 | **Construction → merge** | The implemented unit, for integration. |
| 4 | **→ Operations (deploy/release)** | The change, for deployment. |

These are the **only** points where work is blocked pending a recorded human
decision. The two intra-Construction forks (Gate 2 design, Gate 3 merge) are why
Construction has two gates, not one.

## Decision Record — fields

The artifact the arbiter produces at each gate:

| Field | Meaning |
| --- | --- |
| `decision_id` | Stable identifier. |
| `transition` | Which of the four gates. |
| `unit_of_work` | The unit(s) this decision covers. |
| `chosen_option` | What the human decided (e.g. "approve plan A", "request changes"). |
| `rationale` | Why — the business/technical reasoning the human owns. |
| `approver` | The human arbiter (one human in the solo model). |
| `date` | When recorded. |
| `risk_tier` | Carries the triage tier (see `triage.md`) so depth is auditable. |

For **high-risk** units, the record additionally carries recorded alternatives and
an explicit risk note (see `triage.md`); consider also writing an ADR.

## Blocking-gate semantics

Methodology meaning (not mechanism):

- A gate is **open only when** a Decision Record exists for that transition with
  `chosen_option = approve`.
- **Absence of a record = closed gate = AI must not proceed.**
- A non-approve record (e.g. "request changes") leaves the gate **closed**; the
  prior phase iterates and a new record is produced.

## Enforcement vs. authority — keep these separate

- **Authority:** the **human is the sole arbiter.** Agents propose and contest;
  they never decide. The record carries the human's reasoning and approval.
- **Enforcement:** a real **Claude Code hook** (wired by the installer) checks that
  a present, valid approve-record exists before a transition action. Where a hook
  cannot reach a given action, the product uses honest **"strongly instructed"
  prose** — labeled as best-effort, never as enforcement, and **never prose alone
  for the gate itself**.

The hook **checks for** the human's decision; it never **makes** one. Do not
document the hook's implementation in consumer-facing material — only this meaning.
(Rationale and the two-tier eval strategy: ADR-0005.)

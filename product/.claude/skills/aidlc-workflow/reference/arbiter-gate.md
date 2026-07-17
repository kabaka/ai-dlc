# The arbiter gate & Decision Record

Detail on the four blocking gates, the Decision Record artifact, and the
blocking-gate semantics. The human is the **sole arbiter** at every gate.

## The four gates

A gate is a phase-transition point where "AI proceeds only after human validation"
takes concrete form. Between gates AI proposes and contests freely; **at** a gate
work is **blocked** until an **authorizing record is present** — recorded by the
human, or scribed by an agent from the human's standing authorization (see
"Enforcement vs. authority" and the guard block below).

| # | Transition | What is approved | Enforcement |
| --- | --- | --- | --- |
| 1 | **Inception → Construction** | Requirements + units of work. | Discipline only — no command to intercept. |
| 2 | **Construction · design fork** | Architecture / plan, *before* implementation. | Discipline only — no command to intercept. |
| 3 | **Construction → merge** | The implemented unit, for integration. | **Hook-enforced** (command-level). |
| 4 | **→ Operations (deploy/release)** | The change, for deployment. | **Hook-enforced** (command-level). |

These are the **only** points where work is blocked pending a recorded human
decision. The two intra-Construction forks (Gate 2 design, Gate 3 merge) are why
Construction has two gates, not one.

**Hook-enforced vs. discipline-only.** Gates **3 and 4** map to concrete commands,
so the installed hook can intercept and block them (see "Enforcement" below). Gates
**1 and 2 are conceptual** — there is no command that marks the Inception →
Construction transition or the design fork, so **the hook cannot reach them.** They
rely on the recorded Decision Record and on the orchestrator's discipline, not on
interception. State this honestly: the methodology gate exists at all four points;
*mechanical* enforcement exists only at 3 and 4.

## Decision Record — fields

The artifact the arbiter produces at each gate:

| Field | Meaning |
| --- | --- |
| `decision_id` | Stable identifier. |
| `transition` | Which of the four gates. |
| `unit_of_work` | The unit(s) this decision covers. |
| `chosen_option` | What the human decided (e.g. "approve plan A", "request changes"). |
| `rationale` | Why — the business/technical reasoning the human owns. For a **standing/upfront** authorization, it must **cite the authorizing instruction** and state the scope. *(Discipline only — the hook never reads it.)* |
| `approver` | The **human** arbiter (one human in the solo model) — the human even when an agent **scribed** the file. *(Discipline only — the hook never reads it.)* |
| `date` | When recorded. |
| `risk_tier` | Carries the triage tier (see `triage.md`) so depth is auditable. |

For **high-risk** units, the record additionally carries recorded alternatives and
an explicit risk note (see `triage.md`); consider also writing an ADR.

## Blocking-gate semantics

Methodology meaning (not mechanism):

- A gate is **open only when** a Decision Record exists, under `.ai-dlc/records/`,
  for that transition with `chosen_option == approve`.
- **Absence of a record = closed gate = AI must not proceed.**
- A non-approve record (`request-changes` / `reject` / "do not approve") leaves the
  gate **closed**; the prior phase iterates and a new record is produced.

## Enforcement vs. authority — keep these separate

**Authority (the source of the decision).** The **human is the sole source of
authority** at every gate. Agents propose, contest, and surface options; **they
never decide a fork.** The choice among genuine alternatives is always the human's.

**The record artifact vs. the decision — not the same thing.** The *decision* is
the human's and only the human's. The *record* is a file. **An agent MAY scribe
that file** when the human has genuinely authorized the transition — with
`approver` naming the **human** and `rationale` **citing the authorizing
instruction** it transcribes. Scribing a genuine authorization is fine.
**Fabricating or inferring an authorization the human never gave is the breach**
(see the guard block below).

**Enforcement (what the machine actually blocks).** A real **Claude Code hook**
(wired by the installer) intercepts the two **command-level** transitions and
blocks them unless a matching approve-record exists. It enforces exactly:

- **Gate 3 (merge/integration):** `git merge`, `gh pr merge`, or `git push` to a
  protected branch (`main`/`master`/`release/*`).
- **Gate 4 (deploy/release):** `git tag` create, `npm publish`, or `deploy` /
  `release` as a command word.

Non-transition commands pass through untouched. **Gates 1–2 have no command to
intercept, so the hook cannot reach them** — they rely on the recorded Decision
Record and orchestrator discipline. Do not claim the hook enforces all four gates.

The hook **checks for the existence** of the human's decision; it **never makes**
one. **Absence of a record = closed gate = AI must not proceed.**

### Enforced vs. discipline — be honest about which is which

The gate is part machine, part honor-system. State plainly which is which; never
dress a discipline property up as a mechanical guarantee.

**ENFORCED (mechanical — the hook).** For the two command-level transitions
`construction-to-merge` and `to-operations` **only**, the hook denies the command
unless a record exists with a matching `transition`, `chosen_option: approve`, and
`target`. Here `target` bounds **branch/tag identity only** — the ref the command
acts on (or `release`/`deploy`/`operations`/`merge` for a deploy/release/publish).
Without `jq` the hook **fails closed**. Gates 1–2 are **not hook-reachable**. That
existence-and-`target`-identity check is the whole of what is deterministic.

**DISCIPLINE (honor-system — the hook reads NONE of these).** Everything that makes
the record *mean* what it says is discipline, not mechanism:

- that the record reflects a **genuine human authorization**;
- that `approver` is a **human**;
- that `rationale` **cites the authorizing instruction**;
- per-unit / per-risk / per-time **scoping**, and the **scope-boundary stop** below.

**Honest facts you must not paper over:** a single `approve` record is keyed to its
`transition` + `target` **identity**, so it authorizes **every** future command of
that transition that resolves to the same target (for example, every `git push` to
`main`) — it is **non-expiring** and stays valid **until deleted**, and is not scoped
to one unit of work, diff, or point in time; and `risk_tier` is **never** read by the
hook (nor are `unit_of_work`, `rationale`, or `approver`). Never present a discipline
property as
"deterministic" or "fail-closed" — only the existence-and-`target`-identity check
is.

### Scoped upfront authorization (legitimate) vs. self-approval (breach)

The human need not be present at the instant of every forward action. A human may
**pre-authorize** a bounded class of routine, low-risk forward actions ahead of
time, and an agent may then scribe the record that satisfies the gate. This
delegates *timing*, never *authority*.

**Authorship vs. timing.** An agent MAY scribe the record artifact; the human still
**decides** every genuine fork. Genuine forks are timing-constrained — "only after
receiving your validation", "you decide at the forks". Only **routine, low-risk,
reversible forward actions** may be pre-authorized.

**The scope-boundary stop.** A standing authorization covers only what the human
actually named — a specific target (branch/tag), a maximum risk tier, a class of
unit. When an action would **exceed that scope** (a different target, a higher risk
tier, an irreversible step, or a genuine design fork with real alternatives), the
agent **stops and returns to the human**. It does not stretch a narrow
authorization to cover a decision the human never delegated. Because the hook reads
only existence + `target` identity, this boundary is **yours to hold** — the
machine will not catch you crossing it.

> **Scribing is not deciding.** You may draft and write a Decision Record; you may
> not create, on your own judgment, an authorization the human did not give. A
> record you author authorizes a forward action only when ALL hold — else stop and
> ask (resolves CLOSED): (1) transition is `construction-to-merge` (never a
> deploy/release `to-operations`, never the Gate-2 design fork, never Gate 1); (2)
> the target branch/tag was explicitly named by the human; (3) the unit is trivial
> or low-risk and reversible (high-risk/irreversible requires the human to record
> options-considered first); (4) no genuine design fork with real alternatives is
> being resolved — if real options exist, surface them and return to the human; (5)
> it traces to a specific human instruction naming the target(s) and maximum risk
> tier. Enforcement note: the hook checks only that a record with matching
> `transition`, `chosen_option: approve`, and `target` identity exists — it never
> reads `risk_tier`, `unit_of_work`, `rationale`, or `approver`, and records do not
> expire. Rules 2-5 are discipline, not something the hook catches. Fabricating or
> inferring an authorization is a breach even though the hook would allow it.

### What the hook treats as a valid approve-record (Gates 3–4)

A gated command is allowed **only** when a Decision Record under `.ai-dlc/records/`
matches, by **exact value**:

- `transition` == the matched gate class (Gate 3 merge, or Gate 4 deploy/release), **and**
- `chosen_option` == `approve`, **and**
- `target` == the current target — the branch, tag, or release the command acts on.

A stale record, a record for the wrong transition, or a
`request-changes` / `reject` / "do not approve" record does **not** open the gate.

**`jq` is required.** The hook depends on `jq` to read records; if `jq` is absent it
**fails closed** — it denies the command with a remediation message rather than
letting the transition through.

The hook **checks for** the human's decision; it never **makes** one. It is fine to
document **what the hook enforces** — this contract (the gate classes, the matched
commands, the record fields, the jq requirement) — in consumer-facing material; that
is the user's safety guarantee. What stays out of the docs is internal
implementation detail, not the enforced contract. (Rationale and the two-tier eval
strategy: ADR-0005.)

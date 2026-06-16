# Consumer Methodology Mapping Spec (internal build spec)

Authoritative source for how the **deliverable AI-DLC product (layer 2)** embodies
AWS AI-DLC for a **solo human + AI** consumer. The orchestration-designer and
skill-authors build from this. Faithfulness to the source (Core Principle 1) is the
binding constraint. Grounded in `.claude/skills/aidlc-methodology/SKILL.md` and
`reference/phases.md`.

Status: build spec, not consumer-facing copy. Where wording is quoted as "exact",
authors must use it (or an equivalent that preserves the same claims and the same
limitation).

---

## 1. RULING — the "solo-mob" faithfulness issue (binding)

**Finding (upheld).** In AWS AI-DLC, **Mob Elaboration** and **Mob Construction**
are ceremonies where **multiple humans** validate AI proposals and make decisions
**collectively, in real time** ("extreme decision-making via mob work"). Our
consumer product targets **one human + AI**. Presenting our **specialist agents
(dual-planner + adversarial-review)** as *being* the AWS mob ceremony would
misrepresent the methodology — the defining property of the mob (multiple human
minds in the room) is absent. That is a defect under Core Principle 1.

**Ruling.** We **adapt** the mob ceremonies for solo use; we do **not** claim to
reproduce them. The adaptation is honest only if it states both halves:

1. AI specialist agents stand in for the **absent human mob members** — they
   provide the *diverse challenge and collective-intelligence pressure* the mob
   supplies, mechanized.
2. The single human remains the **sole arbiter**. Agents propose and contest; they
   never decide. Critical decisions still defer to the one human.

And it must carry the limitation **explicitly**: agent diversity is **not** a
substitute for genuinely independent human stakeholders. Agents share a model and
a context; they can share blind spots. The solo adaptation trades the mob's
independent-human diversity for speed and availability, and the human arbiter
carries the full accountability that a multi-human mob would have distributed.

**Naming rule.** Use **"Solo Mob Elaboration"** and **"Solo Mob Construction"** (or
"the mob ceremony, adapted for solo use"). Never the bare AWS terms for our agent
loop, and never imply our agents equal a human mob.

### Exact wording authors must use

Canonical one-liner (skills, agent bodies, orchestrator, docs):

> In AWS AI-DLC the mob ceremonies put **multiple humans** on a decision together
> in real time. AI-DLC for a solo developer adapts this: **AI specialist agents
> stand in for the absent human mob members to supply diverse, independent
> challenge, while you remain the sole arbiter who decides.** This is an
> adaptation, not a reproduction — agents can share blind spots that independent
> human stakeholders would not, so the diversity is weaker than a true human mob.

Short form (where space is tight, e.g. an agent description or table cell):

> Solo Mob Elaboration/Construction: specialist agents stand in for absent human
> mob members; the human is the sole arbiter. An adaptation of the AWS ceremony,
> not the multi-human ceremony itself.

### Operations — do NOT invent a ceremony

The source names **no** ceremony for Operations (`reference/phases.md`: "No
distinct mob ceremony is named for Operations"). Authors of the `devops` /
Operations path **must not** invent a "Mob Operations" or any mob ceremony there.
Operations is governed by **standing human oversight**, not a ceremony. State this
absence positively: "Operations has no mob ceremony in AI-DLC; human oversight is
the constant."

---

## 2. Phase → agent / skill mapping

Three phases (source-faithful): **Inception → Construction → Operations**. The
consumer roster maps as follows. "Lead" = primary proposer; "challenge" = agents
that supply the solo-mob diverse-challenge function.

| Phase | Question | Ceremony (solo-adapted) | Lead agents | Challenge agents (solo-mob stand-ins) | Arbiter decision point |
| --- | --- | --- | --- | --- | --- |
| **Inception** | WHAT / WHY | **Solo Mob Elaboration** | `requirements-analyst`, `researcher` + `research-synthesizer` | a second `requirements-analyst` pass and/or `adversarial-reviewer` contesting the requirements/units of work | **Requirements & units-of-work sign-off** (gate into Construction) |
| **Construction** | HOW | **Solo Mob Construction** | `architect`, `planner`, `implementer`, `test-engineer` | dual `planner`, `adversarial-reviewer`, `security`, `code-reviewer` contesting design/code | **Architecture/plan approval** (before implementation) and **merge approval** (before integration) |
| **Operations** | run it | none (standing oversight) | `devops` | `security` (review), `debugger` (incident RCA) | **Deploy/release authorization** (per change) |

Skill mapping (consumer skills the authors will create map per phase):

- **Inception**: requirements-elaboration skill, unit-of-work definition skill,
  the **Solo Mob Elaboration** ceremony skill. Methodology reference skill (a
  consumer-facing descendant of `aidlc-methodology`) underpins all phases.
- **Construction**: architecture/design skill, implementation-planning skill,
  testing skill, the **Solo Mob Construction** ceremony skill, code-review &
  security-review skills.
- **Operations**: deployment/release skill, monitoring skill, incident-RCA skill.
  **No ceremony skill** (see §1).

Human-arbiter decision points fall **at every phase transition** and at the two
intra-Construction forks (design approval, merge approval). These are the only
points where work is *blocked* pending a recorded human decision (§4).

---

## 3. Bolts & units of work as real artifacts

These are methodology-core (renamed from epic and sprint) and must be **modeled**,
not just mentioned.

### Unit of Work — definition / output contract (a phase-handoff template)

A **Unit of Work** is the Inception output: a parallelizable chunk of value, sized
to fit a bolt. It becomes the **Inception → Construction handoff template**. Fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable identifier for the unit. |
| `title` | yes | One-line name of the value delivered. |
| `scope` | yes | What is in this unit — the WHAT, concretely. |
| `acceptance_criteria` | yes | Testable conditions that define "done". Drive the test-engineer's work. |
| `non_goals` | yes | What is deliberately excluded — prevents scope creep; faithful to "sized to be parallelizable". |
| `dependencies` | yes (may be empty) | Other units this one needs; supports parallelization decisions. |
| `bolt_time_box` | yes | The intended bolt window (hours–days) for this unit. Documentation/intent field — see below. |
| `risk_tier` | yes | trivial / standard / high-risk (§5) — sets ceremony depth. |
| `arbiter_signoff` | yes | Reference to the Inception decision record approving this unit (§4). |

This template is the concrete realization of "units of work" — authors must ship it
as a real artifact (the requirements skill produces it; the Construction phase
consumes it), not as prose.

### Bolts — how modeled

**Bolts are a documentation-and-intent concept, not an enforced mechanism.** The
methodology defines a bolt as an hours-to-days time-box; AI-DLC does not specify
machinery that *enforces* the box. We therefore model the bolt as:

- the `bolt_time_box` field on each unit of work (intent), and
- vocabulary used consistently across ceremonies and docs ("this bolt", "scoped to
  a bolt").

We **do not** invent a bolt-timer, burndown, or automated cutoff — none exists in
the source, and inventing one would be unfaithful. Authors state plainly: "a bolt
is the intended hours-to-days cadence for a unit of work; AI-DLC does not prescribe
enforcement, so it is a planning intent, not a gate." If a future consumer wants
enforcement, that is an extension, labeled as such — not part of the methodology.

---

## 4. Arbiter decision points & blocking-gate semantics

Methodology meaning only; **enforcement is a hook owned by tooling.** We define
*which* transitions require a recorded human decision and *what the record carries*.

**Transitions that require a recorded human decision artifact (a "Decision Record"):**

1. **Inception → Construction**: requirements + units of work approved.
2. **Within Construction — design fork**: architecture/plan approved before
   implementation begins.
3. **Construction → integration (merge)**: implemented unit approved for merge.
4. **→ Operations (deploy/release)**: change authorized for deployment.

Each is a point where "AI proceeds only after human validation" (the human-as-
arbiter loop) takes concrete form. Between these points AI proposes and contests
freely; **at** these points work is **blocked** until the human records a decision.

**Decision Record — fields (the artifact the arbiter produces):**

| Field | Meaning |
| --- | --- |
| `decision_id` | Stable identifier. |
| `transition` | Which gate (one of the four above). |
| `unit_of_work` | The unit(s) this decision covers. |
| `chosen_option` | What the human decided (e.g. "approve plan A", "request changes"). |
| `rationale` | Why — the business/technical reasoning the human owns. |
| `approver` | The human arbiter (single human in the solo model). |
| `date` | When recorded. |
| `risk_tier` | Carries the §5 tier so depth is auditable. |

**Blocking-gate semantics (methodology, not mechanism):** a gate is *open* only
when a Decision Record for that transition exists with `chosen_option` = approve.
Absence of a record = closed gate = AI must not proceed. The hook (tooling's job)
checks for the record's presence; **this spec defines what "present and valid"
means, tooling enforces it.** Authors must not describe the hook's implementation,
only this meaning.

---

## 5. Complexity-triage tiers (right-sizing ceremony depth)

AWS names a **"one-size-fits-all rigidity"** anti-pattern. We avoid it by
right-sizing ceremony depth to the unit's `risk_tier`. This is a methodology
position (proportionality), not an invented ceremony — the ceremonies are the same;
only their **depth** scales.

| Tier | When | Ceremony depth | Decision Record |
| --- | --- | --- | --- |
| **Trivial** | Low-risk, reversible, narrow scope (e.g. copy fix, isolated config). | Lightweight: single proposer, no full mob round; arbiter may approve inline. | Still required for the gate it crosses, but may be terse (one-line rationale). |
| **Standard** | Typical feature unit of work. | Full Solo Mob ceremony: lead proposes, ≥1 challenge agent contests, arbiter decides. | Full Decision Record at each transition. |
| **High-risk** | Irreversible, security-sensitive, broad blast radius, or high ambiguity. | Deepest: multiple challenge agents incl. `security`/`adversarial-reviewer`, explicit options surfaced, arbiter must record options-considered. | Full Decision Record **plus** recorded alternatives and explicit risk note; consider an ADR. |

**Rules for authors:**

- The tier is assigned on the unit of work at Inception (`risk_tier`) and can be
  escalated (never silently downgraded) if Construction reveals more risk.
- Triage **reduces ceremony, never the arbiter gate.** Even trivial units cross a
  human decision point; triage changes *how much challenge*, not *whether the human
  decides*. This keeps the human-as-arbiter principle intact at all tiers.
- Do not present triage as an AWS-named tiering scheme — it is **our faithful
  application** of AWS's "avoid one-size-fits-all rigidity" guidance. Describe it
  that way.

---

## Faithfulness flags (deviations stated honestly)

Where our adaptation departs from AWS's literal model, here is exactly how authors
describe it:

1. **Solo mob (§1)** — *Deviation:* multi-human ceremony rendered with agents +
   one human. *Honest framing:* "an adaptation; agents stand in for absent human
   mob members; weaker diversity; human is sole arbiter." Never claim parity.
2. **Bolts as intent, not enforcement (§3)** — *Deviation:* we add a `bolt_time_box`
   field. *Honest framing:* AI-DLC defines the bolt but prescribes no enforcement;
   our field is planning intent; any timer/cutoff is a labeled extension.
3. **Decision Record artifact (§4)** — *Deviation:* AWS states the human-as-arbiter
   principle but does not specify a record schema. *Honest framing:* "the Decision
   Record is our concrete realization of AI-DLC's 'human validates before AI
   proceeds' loop," not a quoted AWS artifact.
4. **Triage tiers (§5)** — *Deviation:* explicit trivial/standard/high-risk tiers.
   *Honest framing:* "our application of AWS's anti-rigidity guidance," not an
   AWS-named scheme.
5. **No Operations ceremony (§1, §2)** — *Not a deviation; a fidelity guardrail.*
   Authors must not add one.

All four phases, ceremonies, and vocabulary terms (bolt, unit of work, mob
elaboration/construction, arbiter) are otherwise used exactly as the canonical skill
defines them.

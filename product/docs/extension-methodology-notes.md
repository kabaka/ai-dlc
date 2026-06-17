# Extension Methodology Notes — binding ruling for authors (internal build spec)

Binding methodology ruling on how three new capabilities fit the AI-DLC model
**without** violating its guardrails. Authors of `kit-extender`, `observability`,
and the dependency-compliance / observability-checklist content **must follow this**.
Grounded in `methodology-spec.md` (§1 lines 61-69, §4 lines 145-195, §5 lines
199-221, faithfulness flag line 243) and `AGENTS.md` (the four-gate model + phases).
Faithfulness to the source (Core Principle 1) is the binding constraint.

The single load-bearing invariant: **AI-DLC has exactly three phases (Inception →
Construction → Operations), exactly two ceremonies (Solo Mob Elaboration /
Construction, neither in Operations), and exactly four blocking arbiter gates.**
None of these three capabilities may add a phase, a ceremony, or a gate.

---

## 1. RULING — `kit-extender` is an on-demand authoring activity, not a phase

**Ruling.** "Assess & extend the kit" is an **on-demand authoring activity that sits
OUTSIDE the Inception → Construction → Operations phase model** — exactly the way
`documentation` and `security` are framed in `AGENTS.md` as escalation targets the
arbiter invokes when needed, not phases of the lifecycle. It is **not a new phase,
not a fifth gate, not a ceremony, not mandatory.** The human arbiter invokes it
on demand; when its output is *applied* to a consumer repo, that work re-enters the
normal lifecycle and is gated by the existing four gates like any other change.

### Exact framing authors must use

> `kit-extender` is an **on-demand capability**, invoked by the human arbiter when
> they want to assess or extend the kit — analogous to how `documentation` and
> `security` are summoned for a focused task. It is **not a lifecycle phase, not a
> ceremony, and not an arbiter gate.** It runs alongside the lifecycle, not inside
> it. Any change it proposes is adopted only through the normal phases and the four
> existing gates; `kit-extender` itself blocks nothing and decides nothing.

Short form (agent description / table cell):

> On-demand authoring capability the arbiter invokes to assess/extend the kit.
> Outside the three-phase model; not a phase, ceremony, or gate; proposes only.

### Anti-patterns (do NOT do)

- Do **not** call it a phase, a "fourth/fifth phase," a stage, or a step in the
  lifecycle loop. The phases are fixed at three (`methodology-spec.md` §2).
- Do **not** call it a ceremony or a "mob" of any kind. The only ceremonies are
  Solo Mob Elaboration and Solo Mob Construction (§1).
- Do **not** introduce a fifth gate or any "extension gate." The gates are fixed
  at four (§4); see ruling 3.
- Do **not** make it mandatory or auto-triggered. The arbiter invokes it; AI
  proposes, the human decides (`aidlc-methodology`: human-as-arbiter).
- Do **not** let it self-approve its own output — applying an extension is normal
  gated work.

---

## 2. RULING — `observability` is Operations, instrumented from Construction; NO ceremony

**Ruling (placement confirmed).** Observability is an **Operations-phase concern**
(it serves "run it" — deploy, infrastructure, and **monitoring** per `AGENTS.md`
Operations and `aidlc-methodology`) that **begins in Construction**: you instrument
as you build. It is **standing instrumentation and measurement work**, not a
ceremony. This placement is faithful and authors must use it.

**CRITICAL fidelity guardrail.** Authors must **not** invent an Operations ceremony
to host observability. The source names none. `methodology-spec.md` §1 (lines
63-68), drawing on `reference/phases.md`, is explicit:

> "No distinct mob ceremony is named for Operations" … "Operations is governed by
> **standing human oversight**, not a ceremony. State this absence positively:
> 'Operations has no mob ceremony in AI-DLC; human oversight is the constant.'"

And the faithfulness flag (line 243): *"No Operations ceremony — **Not a deviation;
a fidelity guardrail.** Authors must not add one."*

### Exact framing authors must use

> Observability is an **Operations-phase** concern that **begins in Construction —
> instrument as you build.** It is **standing instrumentation and measurement
> work**, not a ceremony: Operations has **no mob ceremony** in AI-DLC; human
> oversight is the constant. Instrumentation is added during Construction so it is
> in place when the change reaches Operations.

### Anti-patterns (do NOT do)

- Do **not** name or imply an "Observability ceremony," "Mob Operations," an "ops
  mob," a monitoring review meeting, or any recurring ceremony in Operations.
- Do **not** describe observability as a *gate*; see ruling 3.
- Do **not** push all observability into Operations only — say plainly it **starts
  in Construction** (instrument as you build) and **lives in Operations**.

---

## 3. RULING — "recommended checks" stay non-blocking; the four gates are unchanged

**Ruling.** The new **dependency-compliance check** (license / SBOM) and the
**observability pre-release checklist** are **RECOMMENDED, NON-BLOCKING inputs that
live INSIDE existing checklists** — not new gates. Specifically:

- Dependency-compliance (license/SBOM) lives inside the **`delivery-operations`
  pre-deploy checklist** and the **`security-review` supply-chain lens** as a
  recommended item.
- The observability pre-release checklist lives inside the **`delivery-operations`
  pre-deploy checklist** as a recommended readiness item.

Neither is a blocking gate. `methodology-spec.md` §4 fixes the blocking set at
**exactly four gates** ("These are the only points where work is *blocked*", line
96-97), and only Gates 3-4 are mechanically enforced by the hook (lines 185-195).
A recommended check that read as a fifth gate would be a faithfulness defect.

### Exact wording authors must use

> This is a **recommended, non-blocking** check. It informs the arbiter's decision
> at an **existing** gate; it does **not** add a gate of its own. **AI-DLC ships
> exactly four blocking arbiter gates** (Inception → Construction; the design fork;
> Construction → merge; → Operations deploy/release) and **these additions do not
> change that** — they are inputs inside the relevant checklist, surfaced for the
> human, never a blocker the tooling enforces.

### Anti-patterns (do NOT do)

- Do **not** call either check a gate, "fifth gate," "release gate," or "compliance
  gate," and do **not** wire either into the arbiter-gate hook (the hook enforces
  Gates 3-4 only, `methodology-spec.md` lines 185-195).
- Do **not** word them so they *read* as blocking ("must pass before deploy",
  "deploy is blocked unless…"). Use "recommended", "surface to the arbiter",
  "checklist item".
- Do **not** create a standalone checklist for them — they nest inside the existing
  `delivery-operations` pre-deploy checklist and the `security-review` supply-chain
  lens.
- The arbiter may still *choose* to treat a finding as decisive at an existing gate;
  that is the human deciding, not a new automated gate. Frame it that way.

---

## Summary table

| New capability | Where it fits | What it is NOT |
| --- | --- | --- |
| `kit-extender` | On-demand authoring capability, outside the 3 phases (like `documentation`) | not a phase / ceremony / gate; not mandatory |
| `observability` | Operations concern, instrumented from Construction; standing work | not a ceremony; not a gate |
| dependency-compliance (license/SBOM) | Recommended item in `delivery-operations` pre-deploy checklist + `security-review` supply-chain lens | not a gate |
| observability pre-release checklist | Recommended item in `delivery-operations` pre-deploy checklist | not a gate |

The four blocking gates and the three phases are unchanged. Verify any authored
copy against this memo before it ships.

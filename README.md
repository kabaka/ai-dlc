# AI-DLC

**AI-DLC** is an installable, **Claude-Code-first** development-lifecycle kit for
your own software and research work. It turns your main AI session into an
**Orchestrator** that coordinates a roster of specialist lifecycle agents through
the **AI-Driven Development Lifecycle** AWS introduced — Inception → Construction →
Operations — with **you as the product owner and sole arbiter** of every decision
that matters.

You describe an outcome. The Orchestrator breaks it into units of work, delegates
to specialists, makes them contest each other's proposals, and stops at each phase
transition until an authorizing decision is on record — recorded by you, or scribed
from your standing authorization. The same loop that builds a feature also
produces a verified, cited research report — writing code and running down evidence
are the same lifecycle here, not two different tools.

You do not clone this repository to use it. You install the kit into your own
project with a single command:

```bash
npx @kabaka/ai-dlc init
```

It runs first-class on Claude Code and **degrades gracefully** — not at parity — to
GitHub Copilot, Cursor, Kiro, and any [`AGENTS.md`](https://agents.md) reader.

## Two layers, and your path in

This repository holds two distinct things. Point yourself at the right one:

- **To USE the kit** — install it into your project and let it run your
  lifecycle — you want the **deliverable product** under
  [`product/`](product/README.md). Everything a consumer needs starts at the
  [product README](product/README.md). Install with `npx @kabaka/ai-dlc init`;
  again, you do **not** clone this repo.
- **To BUILD the kit** — contribute to AI-DLC itself — you want the **internal
  kit-builder** at this repo root: [`AGENTS.md`](AGENTS.md) (the canonical
  Orchestrator definition) and the agents and skills under `.claude/`.

A note on the docs you are reading: the pages under `product/docs/` are reference
material meant to be read here on GitHub or on npm. The installer does **not** copy
them into your repo — it lands the working kit (agents, skills, steering files, the
arbiter hook), not this documentation.

### Choose your path

The rest of this page is written for four different readers. Jump to yours:

- **Skeptical of AI writing code?** Start with
  [What is real and what it costs you](#what-is-real-and-what-it-costs-you).
- **New to agentic workflows?** Start with
  [The mental model](#the-mental-model), then
  [A session from request to merge](#a-session-from-request-to-merge).
- **Want the mechanism and the "why"?** Read
  [Design and philosophy](#design-and-philosophy).
- **An AI agent installing this for a human?** Go straight to
  [Install and get started](#install-and-get-started); the block addressed to you
  is there.

## The mental model

Three pieces, and one rule.

**The Orchestrator.** You talk to exactly one thing: the Orchestrator, your main AI
session. It never does the substantive work itself. It decomposes the request,
delegates to specialists, has them review each other, and reports back to you. Think
of it as a tech lead who never touches the keyboard — it coordinates and integrates,
you arbitrate.

**The specialist lifecycle agents.** Behind the Orchestrator sits a roster of
single-purpose agents, each with a narrow job: eliciting requirements, gathering
evidence, designing structure, sequencing the build, implementing, owning the test
oracle, reviewing before merge, deploying, diagnosing incidents. They are dispatched
only when their phase needs them, and independent work runs in parallel.

**The three phases.** Work flows through the lifecycle AWS defined:

- **Inception (what / why).** Your intent becomes **units of work** — a unit of
  work is a parallelizable chunk of value with acceptance criteria, non-goals, and a
  risk tier. (In the Agile vocabulary AI-DLC compresses, the *unit of work* replaces
  the *epic*.) Units are sized to fit a **bolt** — the intended hours-to-days
  cadence that replaces the *sprint*. A bolt is an intent and a vocabulary, **not**
  an enforced timer: nothing cuts your work off at a deadline.
- **Construction (how).** Structure, sequence, implementation, and an independent
  test oracle the implementer may not edit — so a passing test means the code is
  right, not that the test was bent.
- **Operations (run it).** Deploy, release, observe, and diagnose under your
  standing oversight.

**The rule: you are the sole arbiter.** At four phase transitions, work stops until
an authorizing Decision Record is present — your chosen option, rationale, and risk
tier. You may grant that authorization at the gate itself, or, for a routine low-risk
merge to a branch you have named, in advance; either way the record must be on disk
and its authority must be yours. Between gates the agents move freely, and an agent
may even scribe the record's artifact — but a genuine design fork with real
alternatives, and every high-risk or deploy decision, still comes to you to decide.

One honest caveat about the ceremonies. AWS's original "mob" ceremonies put
*multiple humans* on a decision together. AI-DLC adapts that for a solo developer as
**Solo Mob Elaboration** and **Solo Mob Construction**: specialist agents stand in
for the absent human mob to supply independent challenge while you decide. This is an
**adaptation, not a reproduction** — agents can share blind spots that independent
humans would not, so the diversity is genuinely weaker than a real mob. The kit
names it honestly and never implies the agents equal a human team.

For the phase-by-phase agent-and-skill map, the four gates, complexity triage, and
the research fan-out workflow, read the [usage guide](product/docs/usage.md).

## What is real and what it costs you

Grounding recap: AI-DLC runs your work through an Orchestrator and a roster of
specialist agents across three phases, and *you* are the sole arbiter — the human who
authorizes the decisions that matter (this is [the mental
model](#the-mental-model) just above). This section is the skeptic's cut: what the
kit mechanically enforces, what it leaves to your discipline, and what it costs —
stated without the marketing gloss, including where the guarantees stop.

**What the hook enforces (mechanical).** The centerpiece is not a prompt that asks
the model nicely to wait for your approval. On Claude Code, the installer wires a
real `PreToolUse` hook that intercepts the two *command-level* phase transitions —
merging or pushing to a protected branch (`construction-to-merge`, Gate 3) and
tagging, publishing, or deploying (`to-operations`, Gate 4). Before it lets one of
those commands run, the hook **denies** it unless a Decision Record already exists on
disk whose machine fields match: the right `transition`, `chosen_option` set literally
to `approve`, and a `target` matching — by **identity only** — the branch or tag being
acted on. No matching record means a closed gate means a denied command. The hook
needs [`jq`](https://jqlang.github.io/jq/) and **fails closed** without it: no `jq`,
and every gated command is denied rather than waved through, because a parser that
guesses can be tricked into failing open. This much is deterministic and unskippable —
the model cannot talk past a missing record — and that guarantee, on its own, is the
real and non-trivial thing the kit provides.

**What the hook does not check (discipline).** Be just as precise about the edge of
that guarantee, because a fail-closed claim that quietly smuggles in more than the
hook delivers would itself be a defect. The hook proves only that a *matching record
exists*. It cannot tell who authored the record or when, and it never reads
`risk_tier`, `unit_of_work`, `rationale`, or `approver`. Records do not expire, and
`target` matches identity only — so a single `approve` record is keyed to its
`transition` + `target` identity, authorizing *every* future command of that
transition that resolves to the same target (for example, every `git push` to
`main`), non-expiring, until you delete the record — not scoped to one unit of work,
diff, or point in time. That the record
reflects an authorization you genuinely gave, that its `approver` is you, that its
rationale cites the instruction you issued, that its scope is honored per unit and per
risk tier — all of that is **discipline the Orchestrator upholds, not something the
hook catches.** This is stated as strength, not apology: the enforcement is an honest,
narrow, deterministic check, and it is worth more precisely because it does not
pretend to be broader than it is.

**Only two gates are hook-reachable.** The hook guards Gates 3 and 4 only. Gates 1
and 2 (opening Construction, and the design fork inside it) are conceptual transitions
with no single command to intercept, so they are **discipline-only** — honored because
the Orchestrator is strongly instructed to, never because anything blocks them.

**What is different.** You are the **sole arbiter**. Agents propose and argue; they
never decide a gate. Instead of one model producing one answer, specialists contest
each other's work through the Solo Mob ceremonies (below), and research is a
first-class peer to code — held to a citation gate where every load-bearing claim
must trace back to a source that actually supports it.

**What it costs you.** Two honest scopes here, because a vague privacy claim would
itself be a defect:

- **The installer** performs no network calls and pins no remote code — it runs on
  your machine and writes only into your repo. That is a claim about the
  *installer*, not about the model. Using the kit still runs your work through your
  AI provider, which necessarily sees the code you are working on, and the
  `researcher` / `research-synthesizer` agents reach the open web (via web search
  and fetch) whenever you ask for evidence. "Nothing leaves your machine" is true of
  the install step and nothing more.
- **Time and tokens.** A first, deliberately tiny unit of work takes
  [about ten minutes](product/docs/quickstart.md) end to end. There is no honest
  single figure for the token or wall-clock cost of a full lifecycle — it depends
  entirely on the work — so this doc will not invent one. If output-token cost is a
  concern, an optional, Claude-Code-only [rtk](product/docs/rtk.md) add-on (`init
  --with-rtk`) routes noisy command output through a compressor and cuts those
  tokens by roughly 60–90%.

## A session from request to merge

Here is the shape of a real session, told conceptually. (For an actual runnable
transcript with the exact commands and the exact hook output, follow the
[quickstart](product/docs/quickstart.md) — this section is the narration, not a
substitute for it.)

1. **You describe a unit of work.** You open Claude Code in your repo and tell the
   Orchestrator an outcome — say, adding a `--version` flag to a CLI. You are the
   product owner; you describe *what*, not *how*.
2. **Inception turns it into a unit of work.** The requirements agent produces a
   scoped unit — acceptance criteria, non-goals, dependencies, a risk tier. A small,
   reversible change triages as trivial: lighter ceremony, but the gate still applies.
3. **Solo Mob contests the work.** Through Construction, specialists propose and
   challenge each other — structure, sequence, implementation, and an independent
   test oracle the implementer is not allowed to touch. Disagreement is the feature,
   not a failure; it surfaces the trade-offs for you to arbitrate.
4. **A gate blocks the merge.** When the change is ready to merge into a protected
   branch, that is Gate 3. If you try to merge before recording your decision, the
   arbiter hook **denies** the command with an explicit, actionable reason. The
   quickstart shows the exact denial text the hook prints —
   see [quickstart.md](product/docs/quickstart.md) rather than trusting a paraphrase
   here.
5. **You authorize.** In the interactive posture, you copy the Decision Record
   template, set `transition`, `chosen_option: approve`, and `target` to the branch,
   add your rationale, and save it. That is one valid posture; a standing, scoped
   authorization you gave up front — for exactly this routine, low-risk merge to this
   named branch — is equally valid, and an agent may scribe it into the record on your
   behalf. Either way, the reviewer's own verdict (its vocabulary runs `APPROVE`,
   `REQUEST_CHANGES`, `ESCALATE_SECURITY`, `BLOCK`) is *input* to the decision — an
   `APPROVE` on its own does **not** open the gate. **The Decision Record does.**
6. **The merge proceeds.** With a matching record on disk, the hook lets the command
   through. Deploy or release is the same story one gate later (Gate 4).

The takeaway: a request became a structured unit of work, and *you* — not the AI —
opened each guarded transition with a recorded decision that a mechanical hook
verified was present.

## Design and philosophy

Why the kit is shaped the way it is. Each pillar below is a deliberate choice with a
cost, not a feature list.

**A fail-closed arbiter, not an honor system.** The single most important design
stance is that the human gate is *enforced*, not *requested*. Prose that says "ask
the human before merging" is only as reliable as the model's willingness to comply,
and a sufficiently confident model will rationalize its way past it. So the merge and
deploy gates are a real hook that denies the command outright, and it fails **closed**
when its dependency is missing — a broken gate that blocks everything is safe, a
broken gate that lets everything through is not. The model cannot talk past a missing
decision. That is the whole point — and the honest edge of it is that the hook proves
a *matching record exists*, not who authored it or when: a narrow, deterministic
check, deliberately not a broad one.

**One source of truth, everything else derived.** `AGENTS.md` at the repo root is the
canonical Orchestrator definition. `CLAUDE.md` does not restate it — it *imports* it
with `@AGENTS.md` and adds only Claude-specific notes. Every other steering file the
kit lands (`.github/`, `.cursor/`, `.kiro/`) is a derived summary that points back to
`AGENTS.md`. There is exactly one place to edit guidance, which means no second copy
can silently drift into a contradictory second truth. Cross-platform reach is bought
without cross-platform inconsistency.

**No deferral, and "done" is checked — not gated separately.** A standing delivery
rule binds every agent: when you state requirements, all of them are met in the same
effort, with no "good enough for now" and no orphaned capability wired to nothing.
Rather than bolt on a new gate to police this, the completeness convention
(requirement coverage, end-to-end reachability, companion docs and tests kept fresh)
is folded **into the code reviewer's existing verdict** — unmet or silently deferred
work simply becomes a change-request. Fewer gates, same rigor.

**Least privilege, stated precisely.** Agents carry only the tools their job needs,
and the distinction is finer than "read-only vs not." **Non-authoring reviewers**
(the code reviewer, the security reviewer, the debugger) hold no `Write`/`Edit`, so
they cannot author files — but they *do* carry `Bash` and can run commands with real
side effects. Only the planner and the researcher are **strictly read-only**, with no
`Bash` at all. Calling the reviewers "read-only" would be wrong and would understate
what they can do; the kit draws the line where it actually falls.

**Self-extension behind a propose-for-approval gate.** The shipped roster is
general-purpose. When you want it to know your stack, the `kit-extender` agent
inventories the repo, finds where the kit is silent, and authors tailored skills to
the kit's own standards — but it writes to an `ai-dlc-proposed/` staging directory and
promotes **nothing** into the live `.claude/` roster until you approve. AI proposes;
the human adopts. Extension is a capability, never an autonomous act.

**Research as a first-class, parallel peer.** Building software is linear —
each phase hands the next a complete artifact. Research is not: it fans out. The kit
dispatches many `researcher` agents concurrently to gather across sources, then a
synthesizer collapses them through a **citation-verification gate** — every
load-bearing claim is re-fetched and confirmed to support the point before the report
can ship. Evidence work gets the parallelism it wants and a hallucination check the
prose alone could not enforce.

## Install and get started

The installer is the primary way in. It needs only Node 18+ and writes only into
your own repo.

```bash
npx @kabaka/ai-dlc init          # scaffold the kit into the current repo
npx @kabaka/ai-dlc update        # bring an existing install up to the current version
npx @kabaka/ai-dlc init --dry-run   # print the plan, write nothing
```

Re-running is safe: the installer is idempotent and version-stamped, and `update`
never clobbers a kit file you edited. That is the whole of what most people need to
get started. The **full** picture — every flag, the plugin/marketplace channel, the
Claude Code web setup, and what exactly lands in your repo — lives in the
[product README](product/README.md) and its
[install-channels reference](product/README.md#install-channels); this page does not
duplicate that matrix. For a guided first run, use the
[quickstart](product/docs/quickstart.md); for what each tool does and does not get,
see [cross-platform support](product/docs/cross-platform.md).

### If you are an AI agent installing this for a human

If you are an autonomous agent setting this kit up on a human's behalf, one rule
governs how you may ever touch the arbiter's Decision Records:

**Scribing is not deciding.** You may draft and write a Decision Record artifact; you
may not create, on your own judgment, an authorization the human did not give. A
record you author authorizes a forward action only when **all** of the following hold
— otherwise stop and ask, and the boundary resolves **closed**:

1. the transition is `construction-to-merge` — never a deploy or release, never the
   Gate-2 design fork, never Gate 1;
2. the target branch or tag was explicitly named by the human;
3. the unit is trivial or low-risk and reversible — a high-risk or irreversible unit
   requires the human to record the options considered first;
4. no genuine design fork with real alternatives is being resolved — if real options
   exist, surface them and return to the human; do not pick one and self-approve;
5. it traces to a specific human instruction that named the target(s) and the maximum
   risk tier.

Be honest about enforcement: the hook checks only that a record with a matching
`transition`, `chosen_option: approve`, and `target` identity exists — it does not
read `risk_tier`, `unit_of_work`, `rationale`, or `approver`, and records do not
expire. Rules 2–5 are discipline you uphold, not something the hook will catch.
Fabricating or inferring an authorization the human never gave is a breach even
though the hook would let it pass — it defeats the only guarantee the kit exists to
provide.

One caution specific to install time: during setup you hold no lifecycle
authorization at all, so record **nothing** — install the kit, then let the human
open each gate.

Beyond that: prefer `npx @kabaka/ai-dlc init` from the repo root; install
[`jq`](https://jqlang.github.io/jq/) so the gate hook can run rather than fail
closed; and consult the [product README](product/README.md) for non-interactive and
Claude Code web install paths.

## Tips

Small, real things that save a first-time user grief:

- **Install `jq` before you reach the merge step.** The gate hook parses commands
  with it and fails closed without it — every gated command is denied until `jq` is
  on your `PATH`.
- **Keep your first unit of work tiny.** A small, reversible change lets you see the
  whole loop — unit of work, gate, Decision Record, merge — in one short session.
- **`chosen_option` must be exactly `approve`.** The hook compares it literally, so
  `approve, pending CI` will **not** open the gate.
- **Preview with `--dry-run` first.** It prints the plan and writes nothing, so you
  can see exactly what `init` would land before it lands it.
- **A push to an unprotected feature branch is not gated.** The hook guards merges
  and pushes to protected branches (`main`, `master`, `release/*`); ordinary
  feature-branch work passes through untouched.
- **A brand-new skill or agent needs a session restart.** An edited skill's text
  hot-reloads mid-session, but a newly added skill *directory* or a new agent is only
  discovered on a fresh session (agents also via `/agents`).

## Cross-platform at a glance

AI-DLC is Claude-Code-first and honest about it: the full experience — Orchestrator,
the specialist roster, on-demand skills, and the enforced arbiter-gate hook — exists
on Claude Code, and coverage **degrades, not reaches parity**, elsewhere. Only Claude
Code enforces the arbiter gate mechanically; on every other tool the four transition
decisions are honored by discipline, with nothing blocking you. GitHub Copilot is
*reported* (as of 2026-06) to read the same `.claude/agents/` roster, but that is
fast-moving third-party behavior you should verify against current Copilot docs;
Cursor and Kiro receive the orchestrator/steering prose only, not the agent team. The
authoritative, per-tool contract — what each platform consumes and what it does not —
is in [cross-platform support](product/docs/cross-platform.md).

## For contributors and repo layout

Everything above is about *using* the product. Contributing to the kit itself is the
other layer. Read [`AGENTS.md`](AGENTS.md) first — it is the canonical operating
definition — and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow. In short: you
do not hand-edit agents and skills; you describe the change to the Orchestrator, which
plans, runs dual planning and adversarial review, delegates to specialists, and ships
through the standard PR → CI → merge flow. Every deliverable passes pre-flight checks
(markdown lint, frontmatter validation, manifest schema validation, link integrity,
`shellcheck`).

Keep the two layers straight — a skill that teaches *us* how to author skills is the
kit-builder layer; a skill we *ship to consumers* is the product layer.

```text
ai-dlc/
├── AGENTS.md            # Canonical kit-builder Orchestrator definition (all tools)
├── CLAUDE.md            # @AGENTS.md import + Claude-Code-specific notes
├── .claude/
│   ├── agents/          # Kit-builder specialist subagents
│   └── skills/          # Kit-builder on-demand procedural playbooks
├── product/             # The deliverable product consumers install (npx @kabaka/ai-dlc)
│   ├── README.md        # Consumer front door — start here to USE the kit
│   ├── docs/            # Quickstart, usage, cross-platform (read on GitHub/npm)
│   └── installer/       # The npx installer
├── docs/decisions/      # Architecture Decision Records (MADR)
├── docs/methodology/    # Internal build/authoring specs (not consumer-facing)
├── scripts/             # Pre-flight validation tooling
└── .github/workflows/   # CI pre-flight checks
```

## License

[MIT](LICENSE).
</content>
</invoke>

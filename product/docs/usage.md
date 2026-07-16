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
| **Operations** | run it | `devops`, `observability`, `security` | `delivery-operations`, `observability-practice`, `security-review` |

Routing boundaries keep delegation unambiguous: `architect` owns **structure**,
`planner` owns **sequence**; `code-reviewer` is the **pre-merge gate** and
`debugger` is **post-failure diagnosis**; `researcher` **gathers** and
`research-synthesizer` **synthesizes**; `observability` designs **what to
measure** while `devops` owns the **deploy/release/rollback mechanics**. The full mechanics — Solo Mob rounds,
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
`AIDLC_PROTECTED_BRANCHES` / `AIDLC_RECORDS_DIR` configuration.

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

## Observability in Operations

Observability is an **Operations-phase** concern that **begins in Construction —
instrument as you build.** Add metrics, structured logs, and traces while the unit
is being built so they are in place when the change reaches Operations. The
`observability` agent designs *what to measure*; `devops` owns the
deploy/release/rollback mechanics. Operations has **no mob ceremony** in AI-DLC;
human oversight is the constant.

- **What to measure.** The three correlated signals (metrics, logs, traces) tied
  together by a shared `trace_id`; the SLIs that reflect user-facing health; and
  the SLOs and **error budgets** that turn them into a policy. **OpenTelemetry** is
  the instrumentation default.
- **SLO targets are surfaced, not set.** The agent proposes SLOs and error-budget
  policy for **you** to approve. You remain the sole arbiter.
- **A pre-release operability check is recommended, not a gate.** It is a
  **non-blocking** readiness item inside the existing `delivery-operations`
  pre-deploy checklist — it informs the arbiter at an **existing** gate; it does
  **not** add a fifth gate. The four arbiter gates are unchanged.

The full playbook is in the `observability-practice` skill.

## Assess & extend the kit (on demand)

Separately from the lifecycle loop, you can ask the Orchestrator at any time to
**assess this repo and propose tailored skills or agents** through the
`kit-extender` agent. This is an **on-demand capability** — analogous to summoning
`documentation` or `security` for a focused task. It is **not a lifecycle phase,
not a ceremony, and not an arbiter gate**, and it is not mandatory. It runs
alongside the lifecycle, not inside it; anything it proposes is adopted only
through the normal phases and the four existing gates.

How it runs (full procedure in the `extending-the-kit` skill):

1. **Assess.** `kit-extender` inventories the repo's languages, frameworks, infra,
   and domain, and what the installed `.claude/` already covers, then lists the
   bounded set of gaps worth filling.
2. **Default to skills.** New capability is a **skill** unless a genuinely new
   *role* is needed. **Per-language / per-framework expertise is always a skill
   plus a `reference/` file — never a fixed shipped-in language agent.** The kit
   ships no language experts; they are generated per repo, on request.
3. **Draft to staging.** Drafts land in a repo-root `ai-dlc-proposed/` directory,
   outside live `.claude/`. (Add it to `.gitignore`.) Staging is **author
   discipline plus your review** — not an enforced sandbox.
4. **Validate mechanically — honestly.** `kit-extender` runs the shipped
   `validate-kit-artifact.mjs` validator, which checks frontmatter and eval-record
   rules and confirms each draft is **well-formed**. A PASS means "worth testing,"
   **not** "verified": the validator **cannot** confirm a skill actually triggers.
   That triggering behavior is checked **by hand in a fresh session** — there is no
   eval-runner harness.
5. **You approve.** `kit-extender` proposes; **you** decide. Nothing is promoted
   into live `.claude/` until you authorize it.

After promotion: a new **skill** hot-reloads (its `SKILL.md` is picked up
mid-session, though a brand-new top-level skill directory is discovered on a
restart), while a new **agent** needs a session restart (or `/agents`) before you
can delegate to it. `kit-extender` complements Claude Code's `/agents` "Generate
with Claude" flow — it adds the staging, validation, eval-record, and
approval discipline.

## Recommended practice skills (guidance, not gates)

Beyond the lifecycle agents, the kit ships practice skills that any agent loads on
demand. Each is **recommended guidance that informs your decisions — never a new
arbiter gate.** The four gates are unchanged.

- **`testing-strategy`** also owns how you *arrive at* the oracle: **TDD by default**
  (red-green-refactor, the strongest pattern for AI-implemented work), with ATDD /
  spec-by-example, exploratory spikes, and property-based testing selected by the
  unit's requirement clarity, risk, and output shape.
- **`dependency-compliance`** covers license compatibility (permissive vs
  copyleft tiers, SPDX identifiers), SBOM generation/reading over direct and
  transitive dependencies, and provenance hygiene before you add a package — a
  recommended item inside the `delivery-operations` pre-deploy checklist and the
  `security-review` supply-chain lens. **Mechanics only; not legal advice.**
- **`ux-design`** covers interaction design, information architecture, usability,
  and a WCAG accessibility baseline — **for UI-bearing work only**, not backend,
  CLI, library, or data work with no human-facing interface.
- **`design-system`** is the **visual** lens for the same UI-bearing work: DTCG
  design tokens, a UI-element inventory with state matrices, app-wide
  empty/loading/error patterns, and a committed aesthetic — producing a visual
  contract for **you** to judge. It never self-certifies that the UI looks good.
- **`spec-conformance`** is the **whole-unit completeness convention**. For every
  unit, completeness — **requirement coverage** (every acceptance criterion met,
  every non-goal honored), **end-to-end reachability** (every capability has a
  named user-reachable path; no orphans), and **companion freshness** (docs, tests,
  and `CHANGELOG` updated in the same effort) — is checked **at merge** by
  `code-reviewer`, which applies `spec-conformance` and **folds the result into its
  existing verdict** (no new gate). Deferred scope is **reopened, not silently
  dropped**, and **only the arbiter approves a descope.** Vertical-slice and
  walking-skeleton discipline in `requirements-elaboration` and
  `implementation-planning` keep reachability holding by construction.

For a unit of work whose `ui_bearing` field is set (agent-proposed,
arbiter-confirmed at **Gate 1**), `requirements-analyst` and `architect` carry the
`ux-design` and `design-system` lenses. The resulting design contract — tokens
plus the UI-element inventory and state matrices — rides inside the architecture
handoff and is approved at the **existing Gate 2** (the design fork); no new gate
is added. **You judge the aesthetics**; the lenses surface the contract, they do
not decide it. The `off-token-lint.mjs` script (see
[the scripts reference](../scripts/README.md)) gives a deterministic, non-blocking
check that the built UI stays on-token.

Read the skills for the full guidance rather than relying on this summary.

## Visual QA (deterministic evidence)

For a `ui_bearing` unit, the `architect` proposes a repo-local
`.ai-dlc/stack-binding.json` — which UI stack, tokens, and run/build commands the
visual-QA tools target — as part of the Gate-2 architecture handoff. You confirm
it **inside the existing Gate-2 Decision Record**; there is **no new gate**.
Approving the handoff approves the binding that rides in it. The visual-QA tools
produce **evidence** for you to weigh — they never decide. **You judge the
aesthetics**; a passing tool means the deterministic check held, not that the UI
looks good.

The suite is **seven tools**. Three run **freely** — they read only files and
caller-provided artifacts and execute nothing:

- **contrast** (`contrast-check.mjs`) — WCAG 2.x contrast ratios for the binding's
  token pairs.
- **patch-coverage** (`patch-coverage.mjs`) — test coverage of changed lines, from
  a coverage report and a diff you provide.
- **changelog** (`changelog-check.mjs`) — that the `Unreleased` section reflects
  the unit's commits.

The other **four audit a rendered UI** — accessibility, responsive layout, pixel
diff, and route reachability:

- **axe-audit** (`axe-audit.mjs`) — WCAG 2 A/AA accessibility audit via
  `@axe-core/playwright`.
- **responsive-check** (`responsive-check.mjs`) — horizontal-overflow / off-viewport
  breaks across breakpoints.
- **pixel-diff** (`pixel-diff.mjs`) — screenshots diffed against repo-local committed
  baseline PNGs (`pixelmatch` / `pngjs`).
- **reachability-runner** (`reachability-runner.mjs`) — every declared route renders
  (2xx/3xx, non-empty body, no page error).

Auditing a rendered UI means running your app and a browser — a real RCE surface —
so those four are **fail-closed**. The model is **build → serve static → audit
loopback**: the kit's harness runs your binding's **build/export command** to emit
static files into a repo-local `static_dir`, the kit serves that directory on
`127.0.0.1` at an **ephemeral kit-chosen port**, and the tools audit only that
loopback origin. To enable them, install your pinned toolchain and the browser
binary (`npx playwright install chromium`), then give a **per-session human
confirmation** bound to the binding's SHA-256 hash — a TTY prompt, or the
`--confirm-exec <token>` flag / `AIDLC_VISUAL_QA_CONFIRM=<token>` env var. A changed
or freshly pulled binding must be **re-confirmed**; with no current confirmation a
tool emits `SKIPPED` (default-deny), and the tools never auto-run on the strength of
a binding alone. The browser tools are validated locally by a 28-check Chromium
smoke test that passes — but that is a **local / Tier-2** step; **CI does not run
Chromium.**

Read the exit codes the way a gate must: `0` PASS (the only green), `1` findings
to fix, `2` tool error, and `3` **SKIPPED — evidence-incomplete, never a pass**.
"No binding" or "no inputs" SKIPs; it must not masquerade as success.

The installer lands these tools in your repo at `.ai-dlc/scripts/`, so you run
them from there — for example, the off-token linter and a contrast check:

```sh
node .ai-dlc/scripts/off-token-lint.mjs --repo .
node .ai-dlc/scripts/visual-qa/contrast-check.mjs
```

The kit ships the tool scripts only; it does **not** bundle a browser or
toolchain. Before the four browser audits can run, install your own pinned
toolchain and the browser binary in your repo (`npx playwright install
chromium`); the tools resolve Playwright, axe, and the rest from your repo's
`node_modules`.

See [the scripts reference](../scripts/README.md) for per-tool detail and the
fail-closed harness, and
[ADR 0012](../../docs/decisions/0012-layer2-visual-qa-tooling-and-stack-auto-binding.md)
for the decision behind this slice.

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
npx @kabaka/ai-dlc update
```

Updates are idempotent and version-stamped. A kit-owned file you edited is not
clobbered — the new version arrives as `<file>.new` for you to merge — and your
own `AGENTS.md` / `CLAUDE.md` content is preserved. To make future updates of the
managed region automatic, wrap it in `<!-- ai-dlc:begin -->` /
`<!-- ai-dlc:end -->` markers (opt-in). Full semantics are in the
[installer reference](../installer/README.md).

## Optional: rtk output compression (Claude Code)

An **opt-in, Claude-Code-only** integration routes noisy Bash output (build logs,
test runners, linters) through [rtk](https://github.com/rtk-ai/rtk) before it
reaches the model, cutting those output tokens by roughly 60–90%. It is off by
default; a plain `init` lands nothing rtk-related. Enabling it is two steps —
install the files, then flip a runtime switch:

```bash
npx @kabaka/ai-dlc init --with-rtk    # 1. land the rtk files + wire the (inert) hook
export AIDLC_ENABLE_RTK=1      # 2. activate it at runtime (hook is inert without this)
```

The two signals are distinct: `--with-rtk` (or `AIDLC_INSTALL_RTK=1`, the
non-interactive install equivalent) **installs and wires** the inert hook, while
the separate runtime-only `AIDLC_ENABLE_RTK=1` **activates** it. Verify with
`rtk --version` (expect `0.43.0`) and `echo "$AIDLC_ENABLE_RTK"` (expect `1`).
Disable for a session with `AIDLC_ENABLE_RTK=0`; remove it entirely — and record
a **sticky opt-out** that a later `update` will not undo — with
`npx @kabaka/ai-dlc init --without-rtk`. rtk never bypasses the arbiter gate — transition
commands are passed through un-compressed and the gate evaluates them
independently. The full guide (the two-step model, the SHA-pinned cloud install,
the crates.io name-collision warning) is in [rtk output compression](rtk.md).

## Other platforms

The kit is **Claude-Code-first** and degrades — not at parity — onto GitHub
Copilot, Cursor, Kiro, and other `AGENTS.md` readers. The specialist roster works
on Claude Code and Copilot (both read `.claude/agents/`); skills auto-load and the
arbiter gate is enforced **only** on Claude Code. The
[cross-platform contract](cross-platform.md) is the authoritative per-tool table —
believe it over any impression a steering file's tone might give.

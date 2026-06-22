# 0012 — Layer-2 visual-QA tooling and Architect-produced stack auto-binding

## Status

Accepted

- Date: 2026-06-21
- Deciders: Product owner (decision authority); Orchestrator + `architect`,
  `tooling-engineer`, `security`, `qa` (recorded faithfully — the product owner
  made the call; this ADR documents it)

## Context and Problem Statement

[ADR-0010](0010-layer2-design-system-and-ui-bearing-completeness.md) and
[ADR-0011](0011-layer2-spec-completeness-convention.md) both **deferred** the
deterministic visual-QA **tooling** and the **stack auto-binding** to "a later
slice" / a possible "follow-up ADR." **This is that slice — Slice 3** of the
multi-slice layer-2 visual-quality effort. Slice 1's off-token-lint tool
explicitly deferred the browser/app-executing RCE surface; Slice 3 takes it on,
**by design, gated**.

The forces are these. Completeness and visual-fidelity checks until now have been
**evidenced / asserted, not deterministically detected** — the reviewer
demonstrates a path and the arbiter confirms it, but no detector proves a contrast
ratio, a WCAG violation, a responsive break, a pixel regression, or a dead route.
Closing that gap means **running the consumer's app** to audit it, which is
genuinely a **remote-code-execution (RCE) surface** a portable Node tool **cannot
OS-sandbox**. And to run the right tools, the **stack the app uses must be known**.
A decision is needed on **WHO** produces the stack binding, **HOW** the
app-executing tools are made safe, and **HOW** all of this is validated honestly
given there is **no browser in CI**.

## Decision Drivers

- **Correctness & faithfulness (Core Principle 1).** Deterministic detectors must
  do what they claim and SKIP honestly when they cannot run; the design must never
  produce a **fake green**. Honesty extends to the threat model — we do not claim
  "no RCE" when an RCE surface exists.
- **Reliable triggering & orchestration (Core Principle 2).** The stack binding
  must be produced at a **real beat** by an agent that already runs there, and the
  tools must follow the established exit-code contract so the lifecycle can route on
  their results.
- **No new ceremony / no new surface (methodology-fidelity constraint, Core
  Principle 5).** Raising visual QA must reuse the **existing** architect and the
  **existing** Gate 2 — no new agent, no new gate, no installer prompt, no
  kit-extender involvement.
- **Reusability & updatability (Core Principle 4).** The kit must prefer the
  **consumer's pinned toolchain** over bundling a heavy, forkable, staleable
  browser; new dependencies must be audited, exact-pinned, and lockfile-committed.
- **Security of consumer-machine execution (Core Principle 1, security
  obligation).** App-executing tools run on a consumer's machine; the harness must
  be **fail-closed**, and capabilities too dangerous even fail-closed must be
  **cut**, with the reason recorded.

## Considered Options

This ADR records **five** decisions, each with the alternative the product owner
rejected:

1. **Stack-binding producer** — the `architect` at the existing Gate 2 **vs.** a
   new agent / new gate / installer prompt / kit-extender.
2. **Visual-QA suite scope** — the full seven-tool suite (three exec-free + four
   app-executing, fail-closed) **vs.** an exec-free-only subset.
3. **Toolchain strategy** — orchestrate the consumer's pinned toolchain and SKIP
   when absent **vs.** bundle a browser.
4. **Security cut list** — cut four capabilities as too dangerous even fail-closed
   **vs.** allow them behind the fail-closed harness.
5. **Tool-delivery mechanism** — the installer ships the design-QA tools to
   `.ai-dlc/scripts/` (allowlisted) and fences OUT the validation-only scaffolding
   **vs.** leaving the tools in `product/scripts/` with no delivery mechanism (the
   reachability defect this decision repairs).

## Decision Outcome

### Decision 1 — The `architect` is the stack-binding producer at the existing Gate 2

The `architect` **auto-detects** the stack from lockfiles / manifests, **proposes**
`.ai-dlc/stack-binding.json`, and the **arbiter confirms it INSIDE the EXISTING
Gate-2 Decision Record**. Rejected: **no new agent, no new gate, no installer
prompt, no kit-extender involvement.** The stack is genuinely an **architecture
decision**, so it belongs to the `architect` at the gate that already exists — no
new surface (Core Principles 2, 5; the methodology no-new-ceremony constraint).

### Decision 2 — Full visual-QA suite with fail-closed app execution

Seven tools, all following the off-token-lint **exit-code contract `0/1/2/3` where
`SKIPPED (3)` ≠ `PASS (0)`**:

- **Three exec-free stdlib tools** (no app execution): `contrast-check`,
  `patch-coverage`, `changelog-check`.
- **Four browser / app tools** behind a **fail-closed harness**: `axe-audit`
  (WCAG), `responsive-check`, `pixel-diff`, `reachability-runner`.

Rejected: an **exec-free-only subset** — it would not catch WCAG, responsive,
pixel, or reachability regressions, which require a **real rendered app** to
detect.

### Decision 3 — Orchestrate, do not bundle

Prefer the **consumer's pinned toolchain** — Playwright / axe via pinned
`devDependencies` + lockfile — and emit an honest **`SKIPPED (3)`** when the
toolchain or browser is absent. **Never bundle a ~150MB browser** and **never risk
a fake green.** The browser is installed by the consumer via an **echoed**
`npx playwright install chromium`. Rejected: **bundle the browser** — bloat, a
stale / forked toolchain, and the standing temptation of a fake green.

### Decision 4 — Security cut list (cut even though the harness is fail-closed)

Four capabilities are **cut as too dangerous even fail-closed**, each with its
reason:

- **(a) No binding-supplied baseline-fetch URLs** — baselines are **repo-local
  only**, so the binding cannot point the tool at an attacker-controlled URL.
- **(b) No binding-chosen browser `executablePath` / Playwright config / reporter /
  setup files** — these are arbitrary-code-load vectors; the binding may not select
  the executable or inject config / setup code.
- **(c) No arbitrary interpreter** — an **allowlist of `node` / `npm` / `pnpm` /
  `yarn` / `npx` only**, so the binding cannot name an arbitrary command to run.
- **(d) No non-loopback `baseURL`** — the tool starts its **own dev server** and
  audits **loopback only**, which blocks **cloud-metadata SSRF** (e.g.
  `169.254.169.254`) and any redirection of the audit to a remote target.

Rejected: allowing these behind the fail-closed harness — fail-closed bounds
injection, but it cannot make an attacker-chosen URL, interpreter, executable, or
config safe; these are removed from the binding's reach entirely.

### Decision 5 — The installer DELIVERS the design-QA tools to `.ai-dlc/scripts/`; the validation-only scaffolding is fenced OUT

The design-QA tools — the Slice-1 off-token-lint, the seven-tool visual-QA suite,
and their shared `lib/` — are **DELIVERED to consumer repos by the installer at
`.ai-dlc/scripts/`** (added to the installer allowlist). The **validation-only**
`package.json` / `package-lock.json` / `node_modules/` / `test/` are **fenced OUT**
of the payload: consumers install their **own pinned** Playwright / axe toolchain
(orchestrate-not-bundle, Decision 3). This **resolves a reachability defect** —
`product/scripts/` was shipped by **NO mechanism**, so the tools were **orphan
features** wired to nothing — and it **retroactively fixes Slice-1's
off-token-lint**, which had been **unreachable to consumers since it shipped**.

Rejected: leaving the tools in `product/scripts/` with no delivery mechanism. A
capability with no named user-reachable path violates the kit's end-to-end
reachability rule (Core Principle 2 / the Non-Negotiable Delivery Rules); the tools
must land where the consumer's lifecycle can actually invoke them.

### Threat closed + residual risk (stated honestly — we do NOT claim "no RCE")

The **fail-closed harness** closes:

- **Command / arg / env injection** — argv-only invocation, `shell: false`, and an
  **env allowlist** (no shell interpolation, no inherited environment leakage).
- **Path traversal** — **path containment on BOTH read and write** (baselines,
  outputs, fixtures stay inside the repo boundary).
- **SSRF** — **loopback-only navigation** plus the tool's **own dev server** and
  **no non-loopback `baseURL`** (Decision 4d).
- **Confirmation-bypass** — a **full-binding-hash, per-session human confirmation**
  that **RE-PROMPTS on ANY change to the binding**, so a silently mutated binding
  cannot be executed under a stale approval.

Resources are **bounded** (time / output limits).

**Irreducible residual — call it T3.** Running the consumer's app **EXECUTES** their
`package.json` / config code. A portable Node tool **CANNOT OS-sandbox this.** It is
**mitigated by — not eliminated by** — the fail-closed confirmation plus an honest
README residual-risk statement: **"only run on repos you would already
`npm install` + run."** Stated plainly: **Slice 3 HAS an RCE surface, by design,
gated.** We do **not** claim "no RCE."

### Validation honesty (mirrors the [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) two-tier precedent)

Following the two-tier eval strategy established in
[ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md):

- The **real chromium smoke test runs LOCALLY / Tier-2 only** (CI has no browser),
  **honestly labeled**, and is **never a fabricated CI green**.
- **CI runs**: the **stdlib fixtures** + `node --check` + the **honest
  SKIPPED-when-absent path**. **CI green never implies the browser tools were
  exercised** — exactly the ADR-0005 rule that the deterministic tier makes no
  behavioral claim the manual tier owns.

### Consequences

- Good, because **deterministic detectors** (contrast, WCAG, responsive, pixel,
  patch-coverage, reachability) now **EXIST** where before there was only an
  evidenced / asserted assertion — closing the honest gap left open by
  [ADR-0011](0011-layer2-spec-completeness-convention.md).
- Good, because the **stack binding lands on the EXISTING `architect` + Gate 2**
  with **no new agent, gate, or prompt** — no new surface (Core Principles 2, 5).
- Good, because **orchestrate-don't-bundle keeps the kit honest** — a real
  `SKIPPED (3)`, never a fake green — and avoids ~150MB of bloat and a forkable,
  staleable toolchain (Core Principle 4).
- Good, because the **cut list + fail-closed harness** close command / arg / env
  injection, path traversal, SSRF, and confirmation-bypass.
- Bad, because **NEW (pinned) dependencies BREAK Slice 1's zero-dependency
  property** — accepted and justified: audited, lockfile-committed, **exact-pinned**.
- Bad, because this is a **HIGH-RISK unit** per the product's own complexity triage,
  so a **mandatory `security` RE-REVIEW is required** before it ships.
- Bad, because the **irreducible T3 RCE residual remains** — mitigated by the
  fail-closed confirmation and the README statement, **not removed**. A portable
  Node tool cannot OS-sandbox executing the consumer's app.
- Bad, because the **installer payload now lands first-party executable `.mjs`**
  (including the **RCE-bearing `app-exec-harness.mjs`**) on consumer machines —
  covered by the fail-closed harness design plus the mandatory `security`
  re-review; **no third-party code is added to the payload** (dependencies stay
  consumer-installed). Note that the earlier framing — "the installer fences
  `product/scripts/` out" — was an **over-broad statement** of the (correct)
  narrower intent to fence only the **validation-only** scaffolding.
- Bad, because **browser tooling cannot gate CI** (Tier-2 only) — the accepted
  limitation carried directly from
  [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md).
- Neutral, because the tooling lives in `.claude/`, so it is **Claude-Code-first**;
  non-Claude tools inherit only the **principle** via the canonical `AGENTS.md`
  (the standard cross-platform degradation).

## Pros and Cons of the Options

### Decision 1 — `architect` at the existing Gate 2 (chosen) vs. a new agent / gate / installer prompt / kit-extender (rejected)

- Good, because the stack is **genuinely an architecture decision**, so it belongs
  to the agent and gate that already own architecture — no new surface.
- Good, because arbiter confirmation **inside the existing Gate-2 Decision Record**
  reuses the methodology's own approval beat (no new ceremony).
- Bad (rejected alternatives), because a **new agent / new gate** bloats the roster
  and adds ceremony the methodology forbids; an **installer prompt** pushes an
  architecture decision to install time, before the stack is even known; and
  **kit-extender involvement** misroutes a per-project architecture artifact into
  kit-authoring.

### Decision 2 — Full seven-tool suite, fail-closed (chosen) vs. exec-free-only subset (rejected)

- Good, because the **four app-executing tools** catch WCAG, responsive, pixel, and
  reachability regressions that **only a real rendered app** reveals — the detectors
  that were missing.
- Good, because **all seven share the `0/1/2/3` exit-code contract** (`SKIPPED ≠
  PASS`), so the lifecycle routes on honest results.
- Bad, because the app-executing four carry the **T3 RCE surface** (accepted, gated,
  fail-closed) and **new dependencies**.
- Bad (rejected alternative), because an **exec-free-only subset** would ship three
  detectors and silently **leave the real visual / accessibility / reachability
  regressions undetected** — a hidden gap, not honest scope.

### Decision 3 — Orchestrate the pinned toolchain, SKIP when absent (chosen) vs. bundle the browser (rejected)

- Good, because the **consumer's pinned, lockfile-committed toolchain** stays
  current and auditable, and an absent toolchain yields an **honest `SKIPPED (3)`**.
- Good, because nothing tempts a **fake green** — a missing browser is reported, not
  faked.
- Bad, because the consumer must run the **echoed** `npx playwright install
  chromium`, so the tools SKIP until they do (an honest, visible prerequisite).
- Bad (rejected alternative), because **bundling a ~150MB browser** adds bloat, a
  **stale / forked toolchain**, and the standing **temptation of a fake green**.

### Decision 4 — Cut the four dangerous capabilities (chosen) vs. allow them fail-closed (rejected)

- Good, because removing **binding-supplied fetch URLs, browser executablePath /
  config / reporter / setup, arbitrary interpreters, and non-loopback `baseURL`**
  from the binding's reach **eliminates** those vectors rather than merely bounding
  them.
- Good, because **repo-local baselines + loopback-only + own-dev-server + an
  interpreter allowlist** are sufficient to run the audit honestly without any of
  the cut capabilities.
- Bad, because consumers lose some configurability (e.g. they cannot point the audit
  at a remote staging URL) — an accepted trade-off for a defensible surface.
- Bad (rejected alternative), because **fail-closed bounds injection but cannot make
  an attacker-chosen URL / interpreter / executable / config safe** — allowing them
  would leave SSRF and arbitrary-code-load vectors open behind a harness that was
  never meant to sanctify them.

### Decision 5 — Installer delivers the tools to `.ai-dlc/scripts/`, fences out validation-only scaffolding (chosen) vs. no delivery mechanism (rejected)

- Good, because the tools land at a **named, user-reachable path** the consumer's
  lifecycle can invoke — closing the reachability defect and retroactively making
  **Slice-1's off-token-lint** reachable for the first time.
- Good, because **only the validation-only** `package.json` / `package-lock.json` /
  `node_modules/` / `test/` are fenced out, so the payload stays clean while the
  consumer keeps **their own pinned toolchain** (consistent with Decision 3).
- Good, because **no third-party code enters the payload** — only first-party
  `.mjs`; dependencies remain consumer-installed and lockfile-pinned.
- Bad, because the payload now carries **first-party executable `.mjs`** — including
  the **RCE-bearing `app-exec-harness.mjs`** — onto consumer machines, which is why
  the fail-closed harness and the mandatory `security` re-review are required.
- Bad (rejected alternative), because leaving the tools in `product/scripts/` with
  **no delivery mechanism** ships **orphan features** wired to nothing — a direct
  violation of the kit's end-to-end reachability rule.

## More Information

- **Slice 3 deliverables:** the `.ai-dlc/stack-binding.json` artifact
  (architect-detected, arbiter-confirmed at the existing Gate 2); the **seven-tool
  visual-QA suite** — three exec-free stdlib tools (`contrast-check`,
  `patch-coverage`, `changelog-check`) and four app-executing tools (`axe-audit`,
  `responsive-check`, `pixel-diff`, `reachability-runner`) behind a fail-closed
  harness, all on the `0/1/2/3` exit-code contract (`SKIPPED ≠ PASS`); the
  fail-closed harness (argv-only / `shell: false` / env allowlist; path containment
  on read and write; loopback-only own-dev-server; full-binding-hash per-session
  confirmation that re-prompts on any binding change); the security cut list
  (Decision 4); the echoed `npx playwright install chromium` prerequisite.
- **Delivery (Decision 5):** the installer ships the off-token-lint tool, the
  seven-tool visual-QA suite, and their shared `lib/` to **`.ai-dlc/scripts/`** (on
  the installer allowlist); the validation-only `package.json` /
  `package-lock.json` / `node_modules/` / `test/` are **fenced OUT** (consumers
  install their own pinned toolchain). This closes the reachability defect and
  retroactively makes Slice-1's off-token-lint reachable to consumers.
- **Reuses, does not add:** the **existing `architect`** and the **existing Gate 2**
  Decision Record — **no new agent, gate, prompt, or kit-extender involvement**.
- **Honest boundary:** Slice 3 **HAS an RCE surface, by design, gated** — the
  irreducible **T3** residual (executing the consumer's app) is **mitigated, not
  removed**; we do **not** claim "no RCE." The README carries the residual-risk
  statement: "only run on repos you would already `npm install` + run." New
  dependencies break Slice 1's zero-dependency property (justified, audited,
  exact-pinned, lockfile-committed). This is a **HIGH-RISK unit** requiring a
  **mandatory `security` re-review**. Browser tooling **cannot gate CI** (Tier-2
  only).
- **Two-tier validation precedent:**
  [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) — the real
  chromium smoke test is **Tier-2 / local only** (honestly labeled, never a
  fabricated CI green); CI runs the stdlib fixtures + `node --check` + the honest
  SKIPPED-when-absent path, and CI green never implies the browser tools ran.
- **Fulfills the deferred direction (does NOT supersede wholesale):** this ADR
  **implements** the "later slice" visual-QA-tooling + stack-auto-binding direction
  recorded in [ADR-0010](0010-layer2-design-system-and-ui-bearing-completeness.md)
  and [ADR-0011](0011-layer2-spec-completeness-convention.md). The **other
  decisions in 0010 and 0011 stand** — 0012 does not replace them; it lands the
  detectors and the binding they deferred. The forward-pointer notes in 0010 and
  0011 are updated to point to this ADR.
- **Related:**
  [ADR-0010](0010-layer2-design-system-and-ui-bearing-completeness.md) (recorded the
  visual-QA-tooling + stack-auto-binding direction as a later slice — this ADR
  implements it);
  [ADR-0011](0011-layer2-spec-completeness-convention.md) (deferred the
  deterministic visual-QA / patch-coverage tooling + stack auto-binding to a later
  slice — this ADR implements that);
  [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) (the two-tier
  eval precedent this validation strategy mirrors).
- **Revisit when:** a model / browser becomes runnable in CI (the browser tools
  could then move toward a CI tier, per ADR-0005), the Playwright / axe toolchain
  contract changes, or the OS-sandboxing options for a portable Node tool change
  such that the T3 residual could be reduced further.

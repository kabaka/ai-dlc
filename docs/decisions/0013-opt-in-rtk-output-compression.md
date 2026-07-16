# 0013 — Opt-in `rtk` (Rust Token Killer) output compression for Claude Code

## Status

Accepted

- Date: 2026-07-16
- Deciders: Product owner (decision authority / arbiter); Orchestrator +
  `distribution-engineer`, `security`, `cross-platform-integrator`,
  `tooling-engineer`

## Context and Problem Statement

`rtk` ("Rust Token Killer", `github.com/rtk-ai/rtk`, Apache-2.0) is a Rust CLI
that compresses noisy dev-command output — build logs, test runners, linters,
package-manager chatter — by roughly 60–90% *before* it reaches the model, wiring
in through a Claude Code `PreToolUse` hook. The product owner asked to integrate
it so it can auto-install for Claude Code **cloud** sessions and be used for all
supported purposes, across **both** kit layers (the internal kit-builder and the
deliverable product).

Integrating it is not free of forces. A hook committed to a repo's
`.claude/settings.json` fires for **every** matching tool call and for every
contributor who clones the repo — so "opt-in" cannot be an install-time choice
alone; it must be enforced at runtime. `rtk` is **pre-1.0** (~242 releases in six
months), so its output-rewrite JSON contract is volatile. The Claude cloud
environment has specific constraints (cached setup scripts, a proxy that 403s
GitHub *release-asset* downloads for non-session repos, a pre-installed Rust
toolchain, a `github.com`+`crates.io` allowlist). And the kit already ships a
**mandatory arbiter-gate `PreToolUse` hook** (see [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md))
that must never be weakened by a second hook sharing the same interception point.
We need a design that is faithful to *current* tool behavior, activates reliably
and only on purpose, and preserves cross-platform integrity.

## Decision Drivers

- **Correctness & faithfulness to current behavior (Core Principle 1).** `rtk` is
  pre-1.0 and its rewrite contract churns; the cloud proxy/setup-cache behavior is
  specific and must be respected. Guidance that misdescribes any of this is a
  defect. No fakes, no unverified claims.
- **Reliable, intentional activation (Core Principle 2).** A committed hook fires
  for everyone; activation must be a deliberate opt-in that holds at the point the
  hook actually runs, not merely at install time.
- **Do not weaken the arbiter gate.** Coexistence with the mandatory arbiter-gate
  hook must be safe by design, not by luck of ordering.
- **Cross-platform integrity (Core Principle 3).** `rtk` is Claude-Code-only; other
  platforms (Copilot, Kiro, Cursor) and the single-source-of-truth model must be
  untouched.
- **Supply-chain safety.** Compiling a third-party, fast-moving Rust CLI on
  consumer machines is a trust surface that needs pinning, identity verification,
  and security review.
- **Clarity & scope (Core Principle 5).** Add capability without dead weight — no
  mechanism that cannot reliably trigger.

## Considered Options

At the top level, three shapes:

- **(a)** Integrate `rtk` as **opt-in** infrastructure (install-time gate **and**
  runtime activation gate), delegating the rewrite to `rtk`'s own hook subcommand.
- **(b)** Integrate `rtk` **default-on** for all Claude Code sessions.
- **(c)** Do **not** integrate `rtk`.

Within option (a), several engineering sub-decisions each had real alternatives —
install method, who authors the rewrite JSON, how coexistence with the arbiter gate
is guaranteed, whether a skill is needed, and how the version is pinned. Those
alternatives are weighed in **Pros and Cons of the Options** below.

## Decision Outcome

Chosen option: **(a) opt-in `rtk` integration that delegates the rewrite to `rtk`'s
native hook subcommand**, because it is the only shape that adds the compression
benefit while satisfying every driver — intentional activation, an untouched
arbiter gate, cross-platform integrity, and a bounded supply-chain surface. The
concrete decisions:

1. **Opt-in everywhere, never default-on — two layers of opt-in on SEPARATE
   signals.** The **install-time** opt-in is the installer flag `--with-rtk`
   **or** the env var `AIDLC_INSTALL_RTK=1` (for non-interactive installs); either
   one gates whether the `rtk` files and hook wrapper land at all. The
   **authoritative runtime** activation gate is a **different, runtime-only** env
   var `AIDLC_ENABLE_RTK`: the committed hook wrapper is **inert** unless
   `AIDLC_ENABLE_RTK=1` at the time the hook runs, and setting it to `0` (or
   leaving it unset) is the kill-switch. `AIDLC_ENABLE_RTK` is **never consulted at
   install time**. Rationale: a hook committed to repo `.claude/settings.json`
   always fires, so opt-in must be enforced *inside the wrapper*; and Claude cloud
   **caches setup-script output** and does not rebuild on an env-var change, so the
   reliable switch is the runtime hook gate, not an install-time conditional.

   **Why the install and runtime signals are split.** An earlier design overloaded
   a single `AIDLC_ENABLE_RTK` for both roles. Because that var was consulted at
   install time, a routine `update` run with the var still set in the environment
   would **silently re-install and re-activate** `rtk`, defeating an explicit prior
   `--without-rtk`. Splitting the signals removes that footgun: the runtime
   kill-switch can never trigger an install, and an install choice can never be
   flipped by an ambient env var. Reinforcing this, **`--without-rtk` persists a
   sticky `enabled: false` in the installer manifest**: once a consumer opts out,
   only an explicit `--with-rtk` or `AIDLC_INSTALL_RTK=1` re-enables the
   integration. No env var can silently flip a recorded opt-out.

2. **Install with `cargo install --git https://github.com/rtk-ai/rtk` pinned to an
   IMMUTABLE COMMIT `--rev 5a7880d404db8364d602f2ecdc41dd790f64013f` (the commit for
   `v0.43.0`), `--locked --force`, from a CACHED cloud setup script** — not
   `SessionStart`, not `curl | bash` / `.deb` / `.rpm`. The concrete command is:

   ```sh
   # 5a7880d404db8364d602f2ecdc41dd790f64013f == v0.43.0
   cargo install --git https://github.com/rtk-ai/rtk \
     --rev 5a7880d404db8364d602f2ecdc41dd790f64013f --locked --force
   ```

   Pinning by **`--rev` (commit SHA)** rather than `--tag v0.43.0` removes a
   supply-chain window: a Git **tag is mutable** and can be force-repushed to point
   at different code, whereas a commit SHA is immutable. `--locked` pins `rtk`'s
   **transitive dependencies** to the committed `Cargo.lock`, but it does **not**
   pin `rtk`'s own source — a mutable tag could still move underneath us; hence the
   SHA pin. `--force` makes re-install idempotent. The from-source build is
   expensive but the setup script's output is **cached** (SessionStart runs every
   session and is not); the Rust toolchain is **pre-installed** in cloud; and
   `github.com` and `crates.io` are on the **default allowlist**. The release-asset
   installers (`curl | bash`, `.deb`, `.rpm`) were rejected because they download
   **GitHub release assets**, which **403 in the Claude cloud proxy** for
   non-session repos.

3. **Use `--git` only; `cargo install rtk` (crates.io) is the WRONG tool.** The
   crates.io `rtk` is an unrelated "Rust Type Kit". Install guidance therefore uses
   `--git` exclusively and verifies identity via the rtk-ai-only subcommand
   `rtk hook claude --help`, **not** a version string (version strings do not
   distinguish the two packages).

4. **The wrapper delegates the rewrite to `rtk`'s native `rtk hook claude`.** That
   subcommand reads the tool call on stdin and writes the
   `hookSpecificOutput` + `updatedInput` response itself. We do **not** hand-author
   `rtk`'s rewrite JSON — it is volatile (pre-1.0, ~242 releases in six months).
   Our wrapper does **only** the safety gate — the runtime env kill-switch, a
   PATH-presence **fail-open** (if `rtk` is absent, pass the call through
   unchanged), and a transition-family pass-through. It **runs** `rtk hook claude`
   as a child process, **capturing its stdout** and forwarding that output **only on
   a zero (success) exit**. A **non-zero `rtk` exit fails open**: the wrapper
   discards `rtk`'s output and the **original command runs unchanged**. The wrapper
   deliberately does **not** `exec` `rtk` — an `exec` would replace the wrapper
   process and **propagate `rtk`'s exit code**, so an `rtk` crash or error would
   break the fail-open guarantee instead of passing the call through.

5. **Coexistence with the mandatory arbiter-gate hook is safe by PLATFORM
   GUARANTEE in the direction that matters for the gate — but only that
   direction.** Claude Code runs all matching `PreToolUse` hooks **in parallel**,
   each on the **original** `tool_input`, and a `deny` **beats** an `allow`. So in
   the direction where `rtk` **fails to wrap** a transition command, the
   arbiter-gate hook still evaluates the **literal** original transition and its
   `deny` wins — independent of hook order and independent of what `rtk` returns.
   That is the direction the gate exists to protect, and it is backstopped by the
   platform. The wrapper *additionally* passes transition-family commands through
   unwrapped — but this is documented explicitly as **cleanliness** (avoiding a
   double-`updatedInput` race and not touching an approved transition), **not** as
   the security control. The design does **not** depend on hook execution order.
   The **converse** direction — a compromised or buggy `rtk` *injecting* a protected
   transition via `updatedInput` — is **not** backstopped by the arbiter (see
   Consequences / residual risk); it is a trust assumption on the `rtk` binary.

6. **No new skill.** `rtk` is passive infrastructure with no natural mid-lifecycle
   trigger; a skill would never reliably fire and would be dead weight under the
   reliable-triggering principle. The user-reachable path is the **installer
   flag, this ADR, and docs**, not a skill.

7. **Version pinned to the immutable commit `5a7880d4…` (= `v0.43.0`), in one place
   in the install script, with a defined renewal path.** Bumping the pin requires
   re-verifying `rtk`'s hook contract and re-running the behavioral test suite
   before the new SHA lands. The stale-pin liability is accepted and recorded
   honestly.

8. **CI bypass on merge is arbiter-authorized and time-bound.** Remote CI is
   currently broken; the product owner (arbiter) explicitly authorized validating
   **locally** (`bash scripts/preflight.sh` plus the installer tests) and bypassing
   **remote** CI for this change — without fabricating green checks. This is an
   explicit, one-time exception tied to the broken pipeline, **not** a new norm; the
   pipeline bug is fixed separately and remote CI resumes gating.

9. **`RTK.md` ships as a human-facing reference doc, NOT an auto-loaded
   agent-context file.** The installer delivers `RTK.md` as documentation a person
   reads; it is **not** wired into any agent's auto-loaded context. Wiring it into
   the co-owned `CLAUDE.md` marker region was considered and **rejected**: the
   installer's payload is delivered whole-file and **hash-stamped** for drift
   detection, with **no per-run conditional-content mechanism** — so injecting an
   `rtk`-conditional line into `CLAUDE.md` would fight the drift/stamp model, and it
   would **silently no-op** for the many consumers who already have their own
   `CLAUDE.md` (the installer preserves consumer files rather than overwriting them,
   per [ADR-0006](0006-installer-idempotent-merge-and-consumer-file-preservation.md)).
   The honest scope consequence: the product owner's "used for all supported
   purposes" is met on rtk's **`PreToolUse` hook surface** — the actual token
   compression, which is the load-bearing capability — while rtk's **context-file
   surface** is provided as **human reference only**, not auto-loaded agent context.
   This is a deliberate, documented narrowing of "all supported purposes", not an
   oversight.

### Consequences

- Good, because the compression benefit (~60–90% fewer output tokens on noisy dev
  commands) is available to Claude Code users who opt in, with a real mechanism
  behind it rather than a hopeful instruction.
- Good, because **activation is intentional and enforced where the hook actually
  runs** — the runtime kill-switch makes "committed but inert" the default state, so
  cloning the repo never silently enables a MITM on Bash output.
- Good, because in the direction the gate exists to protect, the **arbiter gate
  holds by platform guarantee**: if `rtk` fails to wrap a transition, the platform's
  parallel-evaluation + `deny`-wins semantics mean the arbiter still sees the
  **original** transition and denies it, independent of hook order. This guarantee
  is **directional** — see the residual-risk item on the injection direction below;
  it is not a blanket "`rtk` cannot affect the gate".
- Good, because **cross-platform integrity is preserved**: `rtk` is Claude-Code-only,
  other platforms are untouched, and the single-source-of-truth model is not
  disturbed.
- Good, because **delegating the rewrite to `rtk hook claude`** insulates the kit
  from `rtk`'s volatile pre-1.0 JSON contract — our surface is the stable safety
  gate, not the churning rewrite format.
- Bad, because there is an intentional **half-state**: `rtk` can be *installed but
  inert* (files present, runtime env unset). This is by design and documented, but
  it is a state contributors must understand to avoid "why isn't it compressing?"
  confusion.
- Bad, because the kit now **compiles a third-party, fast-moving Rust CLI on
  consumer machines** — a supply-chain trust surface. Mitigated by the **immutable
  `--rev` SHA pin**, `--locked`, the `rtk hook claude --help` identity check, and a
  required `security` review; not eliminated.
- **Residual risk — the arbiter guarantee is directional, not total.** The
  `deny`-wins backstop only covers the direction where `rtk` *fails to wrap* a
  transition (the arbiter still sees the original and denies). The **converse** — a
  compromised or buggy `rtk` **injecting** a protected transition via `updatedInput`
  — is **not** backstopped by the arbiter: parallel hooks each see only the
  **original** input, so the arbiter never observes `rtk`'s injected command. This
  is therefore a **trust assumption on the `rtk` binary, not a platform guarantee**.
  It is mitigated by the opt-in gates and the immutable SHA pin, but it must be
  stated plainly and stay in scope for security review.
- **Residual risk — compressed output is not authoritative.** Output compression
  can **suppress or alter security-relevant command output** (error text, audit
  lines, unexpected diffs). A **compressed view of untrusted output must not be
  treated as authoritative**; when correctness or a security judgement depends on
  exact command output, the original uncompressed output is the source of truth.
- Bad, because the wrapper is a **man-in-the-middle on non-transition Bash command
  output**. The blast radius is bounded by the fail-open (absent `rtk` ⇒
  pass-through) and the runtime kill-switch, but it is real and must stay in scope
  for security review.
- Bad, because a **pinned `v0.43.0`** will go stale; the renewal path (re-verify
  contract + re-run behavioral suite on bump) is the standing cost of keeping it
  faithful.
- Neutral, because the **from-source build** is slower than a prebuilt binary; it is
  acceptable only because the cloud setup script is cached. If from-source builds
  prove to exceed the ~5-minute setup budget, the documented fallback is a vendored
  prebuilt **musl** binary (see option analysis) — a deliberate, revisit-gated
  change, not a default.
- Neutral, because the **CI bypass** is a one-time, arbiter-authorized exception
  recorded here for traceability; remote CI resumes as the gate once the pipeline is
  fixed.
- Neutral, because **"all supported purposes" is deliberately narrowed**: rtk's
  token-compression `PreToolUse` **hook** is fully wired, but rtk's context-file
  surface is shipped as the human-facing `RTK.md` reference only, not as auto-loaded
  agent context. This is documented (decision 9) rather than silently scoped down.

## Pros and Cons of the Options

### (a) Opt-in `rtk`, delegating to `rtk hook claude` — chosen

- Good, because a two-layer opt-in (install flag + runtime gate) makes activation
  deliberate and enforced at the point the hook runs, not merely at install time.
- Good, because delegating the rewrite to `rtk`'s own subcommand keeps our surface
  off `rtk`'s volatile JSON contract.
- Good, because the arbiter gate is preserved by platform guarantee and
  cross-platform integrity is untouched.
- Bad, because it compiles third-party Rust on consumer machines and inserts a
  wrapper that MITMs non-transition Bash output (both bounded and reviewed, not
  eliminated).

### (b) Default-on for all Claude Code sessions — rejected

- Good, because every session would get compression with zero user action.
- Bad, because a committed hook that fires for everyone who clones the repo is an
  **unconsented** MITM on Bash output and an unrequested build dependency — it
  violates the intentional-activation driver and would surprise contributors.

### (c) Do not integrate `rtk` — rejected

- Good, because it adds no supply-chain surface and no hook coexistence risk.
- Bad, because it forgoes a large, verified token saving the product owner
  explicitly asked for; the risks of (a) are all mitigable, so declining is not
  justified.

### Install method — `cargo install --git ... --rev <SHA> --locked --force` (chosen) vs alternatives

- **`cargo --git --rev <SHA> --locked --force` in a cached setup script (chosen).**
  Good: Rust toolchain pre-installed, `github.com`+`crates.io` allowlisted,
  `Cargo.lock` committed upstream so `--locked` pins transitive deps, the immutable
  commit SHA pins `rtk`'s own source (closing the mutable-tag force-repush window),
  and the expensive build runs once because setup output is cached. Bad: from-source
  build is slow and stale-pin maintenance is ongoing.
- **`--tag v0.43.0` instead of the commit SHA — rejected.** Bad: a Git tag is
  **mutable** and can be force-repushed to different code, and `--locked` does not
  pin `rtk`'s own source — leaving a supply-chain window the immutable `--rev` SHA
  closes.
- **`SessionStart` install — rejected.** Bad: `SessionStart` runs **every** session
  and is **not** cached, so the from-source build would repeat and blow the setup
  budget every time.
- **`curl | bash` / `.deb` / `.rpm` release-asset install — rejected.** Bad: all
  download **GitHub release assets**, which **403 in the Claude cloud proxy** for
  non-session repos — they simply fail in the target environment.
- **`cargo install rtk` from crates.io — rejected (wrong package).** Bad: crates.io
  `rtk` is an unrelated "Rust Type Kit"; installing it yields the wrong binary
  entirely.
- **Vendored prebuilt musl binary — rejected as primary, kept as documented
  fallback.** Good: no build cost at all. Bad: the release-asset 403 forces
  committing a ~10–20 MB third-party binary into git — a supply-chain and repo-bloat
  cost. Reserved for the case where from-source builds exceed the ~5-minute setup
  budget.

### Rewrite authoring — delegate to `rtk hook claude` (chosen) vs hand-author JSON

- **Delegate (chosen).** Good: insulated from `rtk`'s pre-1.0, ~242-releases churn;
  our wrapper owns only the stable safety gate. Bad: relies on `rtk`'s subcommand
  staying present and behaving (mitigated by the immutable SHA pin and identity
  check).
- **Hand-author the `hookSpecificOutput` + `updatedInput` JSON — rejected.** Bad:
  the rewrite format is volatile; hand-authoring it would break on nearly every
  `rtk` release and violate faithfulness-to-current-behavior.

### Coexistence with the arbiter gate — platform guarantee (chosen) vs ordering

- **Rely on the platform's parallel-evaluation + `deny`-wins guarantee (chosen).**
  Good: correctness is independent of hook order, which Claude Code does not
  guarantee anyway. Bad: depends on that platform semantic remaining true (recorded
  as a revisit trigger).
- **Rely on hook ordering (rtk runs, then arbiter re-checks) — rejected.** Bad:
  Claude Code runs matching `PreToolUse` hooks in **parallel** on the **original**
  input; there is no ordering to rely on. Building the security control on order
  would be a false guarantee.

### Skill vs no skill

- **No skill (chosen).** Good: `rtk` has no natural mid-lifecycle trigger, so a
  skill would never reliably fire — adding one would be dead weight. Bad: none; the
  installer flag + ADR + docs are the reachable path.
- **A `rtk` skill — rejected.** Bad: nothing for its description to trigger on;
  violates the reliable-triggering principle and adds roster noise.

## More Information

- Upstream: `rtk` — `github.com/rtk-ai/rtk` (Apache-2.0), pinned by immutable commit
  `5a7880d404db8364d602f2ecdc41dd790f64013f` (= `v0.43.0`). Identity check:
  `rtk hook claude --help` (the rtk-ai-only subcommand). Do **not** use crates.io
  `rtk` (unrelated "Rust Type Kit").
- Related: [ADR-0005](0005-baked-in-mechanisms-and-two-tier-eval-strategy.md) (the
  **mandatory arbiter-gate `PreToolUse` hook** this integration must coexist with,
  and the honest-validation stance the local-validation/CI-bypass note follows);
  [ADR-0006](0006-installer-idempotent-merge-and-consumer-file-preservation.md) (the
  installer that wires hooks and now gates the `rtk` files behind `--with-rtk`);
  [ADR-0002](0002-installer-primary-plugin-secondary-distribution.md) (installer as
  the primary delivery mechanism, which owns the `--with-rtk` flag).
- Skills: `installer-design` (wiring the opt-in flag and the cached setup script),
  `security-review` (reviewing the wrapper's MITM surface and the from-source build
  on consumer machines), `kit-validation` / `pre-flight-checks` (the local
  validation run that stood in for remote CI on this change).
- Validation for this change: `bash scripts/preflight.sh` plus installer tests, run
  locally under arbiter authorization while remote CI is broken; a behavioral test
  suite exercises the wrapper's kill-switch, fail-open, and transition pass-through.
- **Revisit when:** `rtk` reaches 1.0 or changes its hook contract (re-verify + bump
  the pin); the Claude Code multi-hook execution model changes (parallel evaluation
  / `deny`-wins is the load-bearing guarantee); the Claude cloud proxy, setup-cache,
  or default allowlist behavior changes; from-source builds start exceeding the
  ~5-minute setup budget (adopt the vendored-musl fallback); or remote CI is
  repaired (the bypass exception ends).

# AI-DLC design-QA scripts

Deterministic, safe design-QA tooling shipped with the AI-DLC product. These
scripts help a consumer's UI stay **on-token** (visually consistent) without
running their application.

## `off-token-lint.mjs` — off-token linter (Slice 1)

Statically scans source files for **hardcoded design values that should be
design tokens** — raw hex/`rgb()`/`hsl()` colors, raw `px`/`rem`/`em` spacing,
and hardcoded `font-family` names — and reports them as findings.

```sh
node product/scripts/off-token-lint.mjs [--repo <path>]
```

| Flag            | Meaning                                            |
| --------------- | -------------------------------------------------- |
| `--repo <path>` | Repository root to scan (default: current dir)     |
| `--help`        | Print the usage and exit-code contract             |

Requires Node >= 18. No dependencies beyond the Node standard library. No
shell, no bashisms — runs identically on macOS, Linux, and Windows.

### Safety: NO RCE surface (this is Slice 1)

This tool performs **pure static analysis**: it only **reads files** and applies
regex/string matching. It does **not** — and must not — execute any command,
spawn a process, **launch a browser**, `eval`, make network calls, or run the
consumer's application.

> Browser-launch and app/command-execution design-QA tools (which carry an RCE
> surface and need their own sandboxing and security review) live **elsewhere** —
> the four harness-gated browser tools under `visual-qa/` (see *Browser visual-QA
> tools* below) — and are intentionally **absent** from this script. Keep this
> file exec-free.

#### Reads stay within `--repo` root

The binding (`.ai-dlc/stack-binding.json`) is **untrusted input** — a consumer
repo could carry a crafted one. Every path the linter derives from the binding
(today: `token_source`) is **resolved and then containment-checked**: if it
resolves to a location that is not `--repo` itself or a path underneath it, the
run **errors with exit `2` and reads nothing outside the root.** This holds for
`../` traversal, absolute paths (e.g. `/etc/hostname`), and **symlinks** — when
the target exists it is `realpath`-canonicalized and re-checked, so a symlink
inside the repo that points outside the repo is rejected too. Source discovery
is likewise bounded: the linter only walks files under `--repo`, so
`source_globs` can only ever select files already inside the root. **No path the
linter reads can leave `--repo`.**

#### Bounded reads

Every file the linter reads — scanned sources, the binding, and the token
file — is size-checked before reading. A **scanned source** over the cap
(currently 5 MiB) is **skipped with a printed `NOTE:`** and the rest of the scan
proceeds; an oversized **binding or token file** is a hard **ERROR (exit `2`)**.
This bounds memory and defeats a denial-of-service via a giant file named by an
untrusted binding.

### Exit-code contract — SKIPPED is **not** a PASS

This is the critical contract. A caller (CI gate, `qa`, a wrapper) **must**
distinguish "the UI is on-token" from "we could not gather the evidence".

| Exit | Name       | Meaning                                                                                   |
| ---- | ---------- | ----------------------------------------------------------------------------------------- |
| `0`  | `PASS`     | Actually scanned **>= 1** source file and found **no** off-token values. **The only green.** |
| `1`  | `FINDINGS` | Scanned sources and found off-token values (listed `file:line:col [kind] value`).          |
| `2`  | `ERROR`    | Bad invocation, unreadable/malformed binding or token file, or internal error.            |
| `3`  | `SKIPPED`  | **Evidence-incomplete — NOT a pass.** See below.                                           |

`SKIPPED` (exit `3`) is emitted when:

- the binding `.ai-dlc/stack-binding.json` is **absent**, or
- `surface` is non-visual (`cli` or `none`), or `binding.absent === true`, or
- there are **no scannable source files**.

A clear `SKIPPED: <reason>` line is printed in every case. **Callers must treat
exit `3` as evidence-incomplete, never as success.** "No binding" must not
silently masquerade as green — a clean PASS is emitted **only** when sources
were actually scanned and nothing off-token was found.

### Repo-local binding: `.ai-dlc/stack-binding.json`

The linter reads an **optional** repo-local binding — the **single source of
truth** for how the repository is wired for design QA. Minimal schema:

```jsonc
{
  "ui_framework": "react",              // string | null — informational
  "token_source": "tokens/tokens.json", // string | null — path to a DTCG tokens.json
  "source_globs": ["src/**/*.{css,tsx}"], // [string,…] | null — which files to scan
  "token_pairs": null,                  // […]   | null — reserved; unused by this tool
  "surface": "web",                     // "web" | "mobile" | "tui" | "cli" | "none"
  "absent": false                       // boolean — true ⇒ no UI surface ⇒ SKIPPED
}
```

Field behavior:

- **`token_source`** — when present, the linter loads the **allowed token
  values** from it. The file is read as DTCG JSON and **every `$value`** (at any
  depth, including composite/array values) is collected. A scanned raw value
  that exactly matches an allowed token value is **not** flagged — that is how
  the linter tells a hardcoded value apart from a legitimate raw value that lives
  inside the token file itself. The **token file is always skipped** during
  scanning. When `token_source` is `null`, **every** raw value is a candidate
  finding. The path **must resolve inside `--repo`** — a `../`, absolute, or
  symlink-escaping `token_source` is rejected with **ERROR (exit `2`)** and
  nothing outside the root is read (see *Reads stay within `--repo` root*). It is
  also subject to the read cap: an oversized token file is an ERROR.
- **`source_globs`** — selects which files to scan, relative to the repo root
  (supports `*`, `**`, `?`). Matching is **linear-time** — the matcher collapses
  consecutive `*`/`**` and compiles globstars to a non-backtracking segment form,
  so a multi-`**` pattern (e.g. `src/**/**/*.css`, or a crafted `**/**/**/...`)
  cannot trigger catastrophic backtracking on a deep tree. Globs only ever filter
  the set of files **already discovered under `--repo`**, so they cannot reach
  outside the root. When `null`/absent, a sensible default of common web source
  extensions is used (`.css .scss .sass .less .js .jsx .ts .tsx .vue .svelte
  .html`). `node_modules`, `.git`, build output, and `.ai-dlc` are always
  ignored.
- **`surface`** — non-visual surfaces (`cli`, `none`) → `SKIPPED`.
- **`absent`** — `true` short-circuits to `SKIPPED` (the repo declares no UI).

The binding is documented here as its canonical, minimal schema; a sibling
stack-binding skill describes how it is produced. Match this schema exactly.

### Stack-pluggable by design

The linter is **not** hardwired to one framework. The binding makes it
stack-pluggable: `ui_framework` is informational, `source_globs` adapt the scan
to any source layout, and `token_source` adapts the allowlist to any DTCG token
set. The same script serves a React+CSS app, a Vue+SCSS app, or a Svelte app by
changing only the binding — no code change.

### Examples

```sh
# Scan the current repo using its .ai-dlc/stack-binding.json
node product/scripts/off-token-lint.mjs

# Scan a specific checkout
node product/scripts/off-token-lint.mjs --repo /path/to/consumer-repo

# Use in a gate: 0 = on-token; 1 = fix findings; 3 = evidence-incomplete (NOT pass)
node product/scripts/off-token-lint.mjs --repo "$REPO"
case $? in
  0) echo "on-token" ;;
  1) echo "off-token findings — fix them"; exit 1 ;;
  2) echo "tool error"; exit 1 ;;
  3) echo "SKIPPED — evidence incomplete, do NOT treat as pass" ;;
esac
```

## Shared library (`lib/`)

The hardened, security-reviewed primitives are factored into one audited module
so every design-QA tool shares a single implementation:

- **`lib/contract.mjs`** — the exit-code contract (`PASS 0` / `FINDINGS 1` /
  `ERROR 2` / `SKIPPED 3`) and the `skip()` / `error()` / `pass()` / `findings()`
  helpers. `SKIPPED` prints a loud `SKIPPED:` line and is impossible to confuse
  with `PASS`.
- **`lib/binding.mjs`** — `loadBinding`, `readBoundedUtf8` (5 MiB read cap),
  `ToolError`, and `resolveContained(repoRoot, path, label, mode)`. Containment
  is enforced for **read** paths (`../`/absolute/symlink escape rejected, with a
  `realpath` re-check) and now for **write** paths too (`mode: 'write'` walks to
  the deepest existing ancestor and rejects a symlinked parent that escapes the
  root). Also `canonicalize` / `sha256Canonical` for stable, order-independent
  binding fingerprints. `off-token-lint.mjs` imports these — its behavior is
  byte-identical to the original inline implementation.

## Exec-free visual-QA tools (`visual-qa/`)

Three deterministic checks ship in this slice. Each shares the off-token-lint
style and the same `0/1/2/3` contract, and each **SKIPs honestly** when its
inputs are absent. **None of them execute a process, a shell, or a browser** —
they read only files and caller-provided artifacts, so they carry no RCE surface
and run identically on macOS, Linux, and Windows. Every path each tool derives
from the (untrusted) binding is resolved and containment-checked inside `--repo`
exactly as the off-token linter does (see *Reads stay within `--repo` root*).

For all three, `SKIPPED` (exit `3`) is **evidence-incomplete, never a pass** —
a caller must treat it as "we could not gather the evidence," not "the UI is
fine." A clean `PASS` (exit `0`) is emitted **only** when the tool actually had
inputs to evaluate and they all met the bar.

### `visual-qa/contrast-check.mjs` — WCAG contrast on token pairs

Computes the WCAG 2.x contrast ratio for each `token_pairs` entry in the binding
and reports any pair below threshold. Each pair is
`{ fg, bg, large?, label? }`; `fg`/`bg` are either a hex color or a DTCG token
reference (`{group.name}`) resolved against `token_source`. The threshold is
`4.5:1` for normal text and `3:1` when `large` is true.

```sh
node product/scripts/visual-qa/contrast-check.mjs [--repo <path>]
```

| Exit | Meaning                                                                          |
| ---- | ------------------------------------------------------------------------------- |
| `0`  | **PASS** — **>= 1** pair was evaluated and **all** met the threshold. The only green. |
| `1`  | **FINDINGS** — one or more pairs fell below the contrast threshold (each listed). |
| `2`  | **ERROR** — bad invocation, or an unreadable/malformed binding or token file.   |
| `3`  | **SKIPPED** — no `token_pairs` to evaluate, non-visual `surface`, or absent binding. **Not a pass.** |

A `PASS` requires at least one evaluated pair: an empty or missing `token_pairs`
SKIPs rather than reporting a hollow green. **Exec-free** — it resolves token
references and does color math on strings; it never renders a page.

### `visual-qa/patch-coverage.mjs` — changed-line coverage

Reports the test coverage of **changed lines only**, computed as the
intersection of a **caller-provided** coverage artifact and a **caller-provided**
unified diff. It does **not** run tests and does **not** shell out to `git`; the
caller is responsible for producing both inputs.

```sh
node product/scripts/visual-qa/patch-coverage.mjs --repo <path> \
  --coverage <lcov|json> --diff <unified-diff-file> [--threshold 0..100]
```

| Flag                | Meaning                                                        |
| ------------------- | ------------------------------------------------------------- |
| `--coverage <path>` | An `lcov` or JSON coverage report (you generate it).          |
| `--diff <path>`     | A unified `git diff` written to a file (you generate it).     |
| `--threshold <n>`   | Minimum changed-line coverage percent (default `80`).         |

Both paths are containment-checked inside `--repo`. The artifact and diff paths
may also be supplied via the binding as
`binding.coverage = { artifact, diff, threshold }`.

| Exit | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | **PASS** — changed-line coverage met or exceeded the threshold. The only green. |
| `1`  | **FINDINGS** — changed-line coverage fell below the threshold.                |
| `2`  | **ERROR** — bad invocation, or an unreadable/malformed coverage or diff file. |
| `3`  | **SKIPPED** — no coverage or diff input was provided. **Not a pass.**         |

**Exec-free** — it parses two text artifacts and intersects line numbers; it
never invokes a test runner or `git`.

### `visual-qa/changelog-check.mjs` — Unreleased-section freshness

Verifies that a Keep-a-Changelog `## [Unreleased]` section exists and carries
**real entries**, given a **caller-provided** commit list. It does **not** shell
out to `git` — the caller passes the commits.

```sh
node product/scripts/visual-qa/changelog-check.mjs --repo <path> \
  [--changelog <path>] [--commits a,b,c]
```

| Flag                 | Meaning                                                      |
| -------------------- | ----------------------------------------------------------- |
| `--changelog <path>` | The changelog file (default: repo-root `CHANGELOG.md`).     |
| `--commits a,b,c`    | The commit list the section must reflect (you provide it).  |

The commit list may also be supplied via `binding.changelog.commits`.

| Exit | Meaning                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| `0`  | **PASS** — an `Unreleased` section exists and has real entries. The only green. |
| `1`  | **FINDINGS** — the `Unreleased` section is missing or empty.                   |
| `2`  | **ERROR** — bad invocation, or an unreadable/malformed changelog.              |
| `3`  | **SKIPPED** — no commit list was provided. **Not a pass.**                     |

**Exec-free** — it parses one Markdown file against a provided commit list; it
never shells `git`.

## App / browser execution: the fail-closed harness

The three checks above are exec-free by construction. Auditing a **rendered**
UI — running an accessibility audit, a responsive check, a pixel diff, or a
reachability sweep — means **running the consumer's app and a browser**, which is
genuinely a remote-code-execution surface. In this kit, **any** such launch must
route through one shipped, tested gate: `lib/app-exec-harness.mjs`. **Four
browser tools ship in this slice and route through it** — `axe-audit.mjs`,
`responsive-check.mjs`, `pixel-diff.mjs`, and `reachability-runner.mjs` (each
documented below). They are real, validated tools, not a future slice.

### The execution model: build → serve static → audit loopback

The harness does **not** start and probe a long-running dev server. It runs the
consumer's **build/export command** — the `command` + `args` argv pair in the
binding (validated, never a split run-string) — to completion. That command emits
**static files into a repo-local `static_dir`** (binding field; default
`.ai-dlc/visual-qa-build`, containment-checked inside the repo). The kit then
serves that directory itself, via `visual-qa/static-server.mjs`, on
**`127.0.0.1` at an ephemeral kit-chosen port**, and the browser tools audit only
that **loopback** origin. The navigation origin is the kit's, never the binding's;
off-origin requests are aborted. `visual-qa/browser-runner.mjs` is the shared
driver that wires confirmation → harness-run build → static serve → tool audit,
and `visual-qa/browser-lib.mjs` owns the kit-controlled, pinned Chromium launch
(headless, managed Chromium, no repo `playwright.config.*` honored).

### `lib/app-exec-harness.mjs` — the fail-closed app-exec authorizer

This is a **library**, not a runnable tool. It exposes `authorizeAndRun(spec)`
and `checkConfirmation(...)` and **never launches on import** — it authorizes a
launch and fails closed. Every defense below is proven by the attacker corpus in
`test/app-exec-harness.attack.test.mjs` (a no-spawn probe records every launch
attempt; no child ever runs):

- **No shell, ever.** `spawn` with an argv array and `shell:false` — never
  `exec`, never `{ shell: true }`, never `sh -c`.
- **Fixed executable allowlist.** `node`/`npm`/`pnpm`/`yarn`/`npx`, or a
  repo-contained `node_modules/.bin/*`; anything else is refused.
- **Validated string-array args.** No run-string splitting; control characters
  rejected; `MAX_ARGS` 64 and `MAX_ARG_LEN` 4096 enforced.
- **Kit-controlled minimal child env.** A hard block on loader/process-hijack
  vars — `NODE_OPTIONS`, `LD_PRELOAD`, `DYLD_*`, `PLAYWRIGHT_*`, `NPM_CONFIG_*`,
  `GIT_*`, `*_PROXY`, `NODE_EXTRA_CA_CERTS`, and similar.
- **Hard wall-clock timeout** (default `120000` ms) with **process-group
  tree-kill**, so a runaway child tree is reaped.
- **cwd pinned** to the contained repo root; a **refusal to run as root**.
- **Default-deny confirmation.** No current confirmation ⇒ `SKIPPED 3`, **never
  a pass**. A security refusal is `ERROR 2`, never a silent skip.
- **Confirmation bound to the binding hash.** The confirmation token **is** the
  SHA-256 over the **entire canonicalized binding** — every field, including the
  audit targets `static_dir`/`audit_paths` and any field added later — **re-hashed
  immediately before spawn**. A changed or freshly pulled binding produces a
  different hash, invalidates the confirmation, and aborts — the harness never
  auto-runs on the strength of a binding alone.
- **Unforgeable `PASS`.** Exit `0` only when confirmed **and** launched **and**
  audited with no findings; `1` = findings, `2` = error/refusal, `3` =
  default-deny skip. Nothing is persisted between invocations.

### Confirmation: TTY or operator token

Confirmation is supplied **per invocation**, two ways:

- **Interactive TTY** — a human confirms the launch at the terminal.
- **Operator token** — `--confirm-exec <hash>` or
  `AIDLC_VISUAL_QA_CONFIRM=<hash>`, where the value must **equal** the exec hash
  the harness computes for that exact binding and descriptor. A stale token
  (from a since-changed binding) will not match and the launch aborts.

Either way the token is the SHA-256 over the execution descriptor, so consent is
**specific to one binding** — re-pulling or editing `stack-binding.json` forces a
fresh confirmation.

### Orchestrate, don't bundle

The kit does **not** bundle a browser or a build toolchain. It **orchestrates
the consumer's own pinned toolchain**: a harness-routed audit runs the
consumer's app and resolves its modules (Playwright, axe, pixelmatch, and the
like) from the **consumer repo's** `node_modules`. Before any browser audit can
run, the consumer installs their pinned toolchain and the browser binary:

```sh
npx playwright install chromium   # == npm run install:chromium
```

This README is the **kit-internal developer doc** — kit developers run the tools
from `product/scripts/`. The installer **ships the tool `.mjs` files** to a
consumer repo at `.ai-dlc/scripts/` (`off-token-lint.mjs`, the `visual-qa/`
suite, and the shared `lib/`), so **consumers run them from `.ai-dlc/scripts/`**.

What the installer does **not** ship is the **validation-only scaffolding** in
this directory: the `package.json` (`private: true`, `@ai-dlc/visual-qa-validation`),
its `package-lock.json`, the installed `node_modules/`, and the `test/` suite are
**fenced out of the consumer payload**. That `package.json` pins the toolchain
**this repo's own tests** run against — `@axe-core/playwright` 4.11.3, `axe-core`
4.12.1, `pixelmatch` 7.2.0, `playwright` 1.56.1, `playwright-core` 1.56.1, and
`pngjs` 7.0.0, with a committed `package-lock.json`. Consumers install their
**own** pinned Playwright/axe toolchain and the tools resolve those modules from
the **consumer repo's** `node_modules` (orchestrate, don't bundle).

### Residual risk: an RCE surface, by design (T3)

The off-token linter and the three exec-free checks above carry **no** RCE
surface — that note in the off-token-lint section above remains true for those
tools. **The harness-gated path is different, and we say so plainly.** Routing a
launch through the harness **runs the consumer's own application** plus whatever
their `package.json` scripts and config evaluate. The allowlists, the minimal
env, the timeout, the cwd pin, and the binding-bound confirmation constrain
**what the binding can redirect** — but a portable Node tool **cannot
OS-sandbox** the app's own behavior. This is an honest **residual-risk
disclosure (a T3 risk), not a guarantee of isolation**: only run harness-gated
app/browser execution on a repository you would already `npm install` and run on
your own machine.

## Browser visual-QA tools (`visual-qa/`)

Four tools audit the **rendered** UI. Each routes through the fail-closed harness
above, so every one is **default-deny**: with no current confirmation it emits
`SKIPPED 3`, **never a pass**. Each shares the `0/1/2/3` contract — `PASS 0` is the
only green and requires that the tool **actually had something to evaluate** (an
empty audit set SKIPs, it never reports a hollow green). All four resolve their
runtime modules from the **consumer repo's** `node_modules` (orchestrate, don't
bundle), so a missing module or browser is an honest `SKIPPED 3` with the
remediation echoed:

```sh
npx playwright install chromium   # == npm run install:chromium
```

All four take `--repo <path>` and `--confirm-exec <token>` (or the
`AIDLC_VISUAL_QA_CONFIRM=<token>` env var); the token is the exec-hash described
above. All read the rendered routes from the binding as **path-only** values
(`audit_paths` / `routes`) — never a navigation origin — against the kit-served
loopback base.

### `visual-qa/axe-audit.mjs` — WCAG accessibility audit

Drives managed Chromium to each `audit_paths` route on the loopback server,
injects axe-core via `@axe-core/playwright` (`AxeBuilder`), and runs the WCAG 2
A/AA rule set (overridable via the binding's `axe_tags`). Any axe violation is a
finding.

```sh
node product/scripts/visual-qa/axe-audit.mjs [--repo <path>] [--confirm-exec <token>]
```

| Exit | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | **PASS** — **>= 1** page was audited and **no** WCAG violation was found. The only green. |
| `1`  | **FINDINGS** — one or more WCAG violations (each listed).                      |
| `2`  | **ERROR** — bad invocation or a security refusal (e.g. off-loopback origin).   |
| `3`  | **SKIPPED** — no/unconfirmed binding, non-visual surface, browser or `@axe-core/playwright` absent, or nothing to audit. **Not a pass.** |

Resolves `@axe-core/playwright` (and `axe-core`) from the consumer's
`node_modules`. Reads binding fields `static_dir`, `audit_paths`, `axe_tags`.

### `visual-qa/responsive-check.mjs` — breakpoint overflow check

Loads each `audit_paths` route at each `breakpoints` viewport in managed Chromium
and detects layout breaks: horizontal document overflow and elements spilling off
the viewport's x-axis. Breakpoints default to a mobile/tablet/desktop trio
(`375×667`, `768×1024`, `1280×800`).

```sh
node product/scripts/visual-qa/responsive-check.mjs [--repo <path>] [--confirm-exec <token>]
```

| Exit | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | **PASS** — **>= 1** (route, viewport) pair evaluated with **no** layout break. The only green. |
| `1`  | **FINDINGS** — a layout break (overflow / off-viewport element) was found.     |
| `2`  | **ERROR** — bad invocation or a security refusal.                              |
| `3`  | **SKIPPED** — no/unconfirmed binding, non-visual surface, browser absent, no breakpoints, or nothing evaluated. **Not a pass.** |

Resolves `playwright` from the consumer's `node_modules`. Reads binding fields
`static_dir`, `audit_paths`, `breakpoints`.

### `visual-qa/pixel-diff.mjs` — baseline pixel diff

Screenshots each `audit_paths` route on the loopback server and diffs it against a
**repo-local committed baseline PNG** (`baseline_dir`, default
`.ai-dlc/visual-baselines`) using `pixelmatch` / `pngjs`. A diff above
`pixel_tolerance` (default `0.01`) is a finding. Baselines are **always repo-local,
never URLs**; every PNG decode is bounded by byte size and pixel dimensions to
defeat decompression bombs.

```sh
node product/scripts/visual-qa/pixel-diff.mjs [--repo <path>] [--confirm-exec <token>] \
  [--baseline-dir <repo-relative path>] [--tolerance <0..1>]
```

| Exit | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | **PASS** — **>= 1** screenshot was compared to a baseline and all were within tolerance. The only green. |
| `1`  | **FINDINGS** — a screenshot differs from its baseline beyond tolerance.        |
| `2`  | **ERROR** — bad invocation, security refusal, oversized/undecodable image, or a baseline-dimension mismatch. |
| `3`  | **SKIPPED** — no/unconfirmed binding, non-visual surface, browser/`pngjs`/`pixelmatch` absent, **no baselines present**, or nothing compared. **Not a pass.** |

Resolves `pngjs`, `pixelmatch` (and `playwright`) from the consumer's
`node_modules`. Reads binding fields `static_dir`, `audit_paths`, `baseline_dir`,
`pixel_tolerance`.

### `visual-qa/reachability-runner.mjs` — route reachability

Drives managed Chromium to each declared `routes` entry (falling back to
`audit_paths`, then `/`) on the loopback server and asserts each renders: a 2xx/3xx
response, a non-empty `<body>`, and no uncaught page error or failed top-level
navigation. A route that fails to render is a finding. This is end-to-end
**reachability evidence** — every named user-reachable path is shown wired to
something real.

```sh
node product/scripts/visual-qa/reachability-runner.mjs [--repo <path>] [--confirm-exec <token>]
```

| Exit | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | **PASS** — **>= 1** route was driven and **all** rendered. The only green.      |
| `1`  | **FINDINGS** — a route failed to render (bad status / empty body / page error). |
| `2`  | **ERROR** — bad invocation or a security refusal.                              |
| `3`  | **SKIPPED** — no/unconfirmed binding, non-visual surface, browser absent, no routes, or nothing driven. **Not a pass.** |

Resolves `playwright` from the consumer's `node_modules`. Reads binding fields
`static_dir`, `routes` (falling back to `audit_paths`).

## Tests (`test/`)

Real fixtures assert exact exit codes for the exec-free stdlib tools
(`stdlib-tools.test.mjs`: good→0, findings→1, malformed→2, absent→3), exercise
the shared binding/containment primitives (`lib-binding.test.mjs`), and run a
malicious-binding attacker corpus (`app-exec-harness.attack.test.mjs`) proving
the app-exec harness ends NON-PASS with the malicious effect provably absent (a
no-spawn probe records every launch attempt; no child ever runs). These three
suites are the **Tier-1 / CI** set. Run them (`test/run-all.mjs`):

```sh
node product/scripts/test/run-all.mjs
```

### The browser smoke test — local / Tier-2 (not CI)

`test/browser-tools.smoke.mjs` exercises the four browser tools end to end against
real fixtures — driving managed Chromium through **PASS** paths (clean axe,
clean responsive, all routes reachable, identical pixel baseline), **FINDINGS**
paths (axe violation, responsive overflow, mismatched baseline), honest
**SKIPPED** paths (no baselines, confirmation withheld, browser absent), and the
security invariants (URL `static_dir` rejected, off-loopback navigation blocked
with zero external hits, repo `playwright.config.js` never loaded, output confined
to a fresh kit subdir). It asserts **28/28** checks and passes.

It is a **local / Tier-2** gate, **deliberately not wired into `run-all.mjs`**: it
requires `npx playwright install chromium` and the pinned validation toolchain,
which **CI does not provision — CI does not run Chromium.** Run it explicitly:

```sh
npm --prefix product/scripts run smoke   # node test/_run-as-nonroot.mjs test/browser-tools.smoke.mjs
```

## Validation

This is an `.mjs` (Node) tool, so it is covered by Node's `--check` syntax
validation and a real fixture run rather than `shellcheck` (which lints `.sh`
only). Repo pre-flight (`scripts/preflight.sh`) shellchecks `.sh` files under
`scripts`, `product/installer`, and `product/templates`; `product/scripts/`
holds Node tools, so no shellcheck root change is needed for this slice. Should
a `.sh` script ever be added here, add `product/scripts` to the shellcheck roots
in `scripts/preflight.sh`.

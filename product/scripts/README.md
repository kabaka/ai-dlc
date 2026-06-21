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
> surface and need their own sandboxing and security review) are a **later
> slice** and are intentionally **absent** from this script. Keep this file
> exec-free.

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

## Validation

This is an `.mjs` (Node) tool, so it is covered by Node's `--check` syntax
validation and a real fixture run rather than `shellcheck` (which lints `.sh`
only). Repo pre-flight (`scripts/preflight.sh`) shellchecks `.sh` files under
`scripts`, `product/installer`, and `product/templates`; `product/scripts/`
holds Node tools, so no shellcheck root change is needed for this slice. Should
a `.sh` script ever be added here, add `product/scripts` to the shellcheck roots
in `scripts/preflight.sh`.

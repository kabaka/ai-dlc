# rtk output compression (optional, Claude Code only)

`rtk` ("Rust Token Killer") is a Rust CLI that compresses noisy dev-command
output — build logs, test runners, linters, package-manager chatter — by roughly
**60–90%** *before* it reaches the model. AI-DLC can wire it in through a Claude
Code `PreToolUse` hook so those savings apply automatically to eligible Bash
commands. It is [`github.com/rtk-ai/rtk`](https://github.com/rtk-ai/rtk),
Apache-2.0.

This feature is **opt-in and off by default.** A plain `npx ai-dlc init` lands
nothing rtk-related; your install is byte-for-byte identical whether or not rtk
exists. You turn it on deliberately, in two steps (below).

> **Claude Code only.** rtk rides on Claude Code's `PreToolUse` hook. GitHub
> Copilot, Cursor, Kiro, and other AGENTS.md readers have no hook surface, so
> they are unaffected — the feature is simply absent there, and documented as
> absent. See the [cross-platform contract](cross-platform.md).

For the full rationale — why opt-in, why a runtime gate, why install by a pinned
commit SHA — see
[ADR 0013](../../docs/decisions/0013-opt-in-rtk-output-compression.md).

## The two-step activation model

Enabling rtk is deliberately **two steps**, and both are required before any
output is compressed:

1. **Install-time opt-in — make it available.** `--with-rtk` (or
   `AIDLC_INSTALL_RTK=1` in a non-interactive environment) lands the rtk files
   and wires the rtk hook into `.claude/settings.json`.
2. **Runtime activation — turn it on.** The wired hook stays **inert** until the
   separate environment variable `AIDLC_ENABLE_RTK=1` is set at the time the hook
   runs. `AIDLC_ENABLE_RTK` is runtime-only — it is **not** read at install time.

This is intentional, not a bug. A hook committed to a repo's
`.claude/settings.json` fires for **every** contributor who clones the repo, so
"opt-in" cannot be an install-time choice alone — it has to be enforceable at the
moment the hook runs. The runtime env var is that authoritative switch: it makes
"installed but inert" the default state, so cloning the repo never silently
routes your Bash output through a third-party binary. It is also the reliable
switch in Claude Code **cloud** sessions, where the setup script's output is
cached and does not rebuild when an env var changes.

The upshot: a repo can have rtk installed and still not be compressing anything.
That is the expected resting state until you export `AIDLC_ENABLE_RTK=1`.

## Enable it

### Step 1 — install the rtk files

Opt in at install time with the flag:

```bash
npx ai-dlc init --with-rtk
```

Setting `AIDLC_INSTALL_RTK=1` in your environment at install time is the
non-interactive equivalent of passing `--with-rtk` (handy in CI or a setup
script). This is a **separate** variable from the runtime `AIDLC_ENABLE_RTK`
switch below, which the installer does not read. `update` **preserves** a prior
`--with-rtk` choice (it is persisted in `.ai-dlc/manifest.json` as an `rtk`
block), so a later plain `npx ai-dlc update` keeps rtk wired without re-passing
the flag.

With rtk enabled, `init`/`update` land three files in your repo and add a
**separate** `PreToolUse` hook entry (it does not touch the arbiter-gate hook):

| Path (in your repo)          | Role                                             |
| ---------------------------- | ------------------------------------------------ |
| `.ai-dlc/hooks/rtk-wrap.sh`  | The runtime-gated `PreToolUse` wrapper (0755).   |
| `.ai-dlc/rtk/install-rtk.sh` | The cloud setup-script installer (0755).         |
| `.ai-dlc/rtk/RTK.md`         | Human-readable reference doc (not auto-loaded).  |

`RTK.md` is a human-readable reference that ships with `--with-rtk`; it is
**not** auto-injected into `CLAUDE.md` or the agent's context. rtk's own "context
file" surface is provided here as human reference only — the automated surface
AI-DLC delivers is the `PreToolUse` hook that does the token compression.

### Step 2 — install the rtk binary

The wrapper delegates the actual compression to rtk's own binary, so `rtk` has to
be on `PATH`. In a **Claude Code cloud/web session**, run the landed installer
from your **setup script**:

```bash
bash .ai-dlc/rtk/install-rtk.sh
```

It installs the pinned release straight from an immutable commit SHA:

```bash
cargo install --git https://github.com/rtk-ai/rtk --rev 5a7880d404db8364d602f2ecdc41dd790f64013f --locked --force
```

That commit is rtk `v0.43.0`; pinning by immutable SHA rather than a mutable tag
is deliberate supply-chain hardening — a tag can be re-pointed at different code,
a commit SHA cannot.

This from-source path is deliberate for the cloud environment: the Rust toolchain
is pre-installed there, `github.com` and `crates.io` are on the default allowlist,
and the setup script's output is cached so the build runs once. It does **not**
use `curl | bash`, `.deb`, or `.rpm` installers — those download GitHub *release
assets*, which the Claude cloud proxy `403`s for non-session repos, so they simply
fail in that environment.

While `install-rtk.sh` is written for the Claude Code web setup script, the same
`cargo install --git … --rev …` command works locally too — so local (non-cloud)
use is supported, just not automated by a setup script.

The installer verifies it built the **real** rtk (see the name-collision warning
below) and reminds you that the wrapper is still inert until you set the runtime
env var.

### Step 3 — activate at runtime

Set the env var in the session where you want compression:

```bash
export AIDLC_ENABLE_RTK=1
```

Now eligible Bash commands route through rtk and the model sees the compressed
output. Unset it (or set `AIDLC_ENABLE_RTK=0`) and the hook goes inert again — no
uninstall needed.

## Do not `cargo install rtk` — that is the wrong tool

The crate named `rtk` on **crates.io** is an unrelated project ("Rust Type Kit"),
**not** the output compressor. Installing it gives you the wrong binary entirely.
Always install from the git repository (`--git https://github.com/rtk-ai/rtk`) as
the landed installer does. The installer confirms identity by running
`rtk hook claude --help` — a subcommand only rtk-ai/rtk ships — and refuses to
proceed if the `rtk` on `PATH` is the impostor. It never trusts a version string,
because version numbers do not distinguish the two packages.

## Verify it is active

```bash
rtk --version            # prints a line containing 0.43.0
rtk hook claude --help   # succeeds only for the real rtk-ai/rtk
echo "$AIDLC_ENABLE_RTK" # must print 1 for the hook to do anything
```

If `rtk --version` shows the pin, `rtk hook claude --help` succeeds, and
`AIDLC_ENABLE_RTK` is `1`, compression is live. If the env var is empty or `0`,
the hook is installed but inert — that is the two-step model working as designed,
not a failure. The rtk hook entry itself lives in `.claude/settings.json`
alongside the arbiter-gate hook.

## Disable or uninstall

Two independent controls, matching the two-step model:

- **Disable for a session (no uninstall).** Set `AIDLC_ENABLE_RTK=0` (or unset
  it). The wrapper stays wired but does nothing; commands run normally. This is
  the fast, reversible off switch.
- **Uninstall the integration (sticky opt-out).** Run:

  ```bash
  npx ai-dlc init --without-rtk
  ```

  This removes the rtk hook entry and the rtk files cleanly **and records a
  sticky opt-out**: a later `npx ai-dlc update` will **not** bring rtk back, and
  no environment variable silently re-enables it — only an explicit `--with-rtk`
  (or `AIDLC_INSTALL_RTK=1`) re-installs it. It leaves the arbiter-gate hook and
  any of your own hooks intact.

## It never bypasses the arbiter gate

rtk and the AI-DLC arbiter-gate hook coexist safely by **platform guarantee**,
not by luck of ordering. Claude Code runs all matching `PreToolUse` hooks **in
parallel**, each on the **original** command, and a `deny` decision beats an
`allow`. So the arbiter gate always evaluates the literal merge/push/tag/publish/
deploy command and its `deny` still wins — rtk can never let a phase-transition
command slip past the gate.

As an additional cleanliness measure, the wrapper also passes transition-family
commands (`git`, `gh`, `npm`, `pnpm`, `yarn`, `make`, and anything carrying a
`deploy`/`release` word) through **unwrapped**, so it does not touch a command the
arbiter is gating. And the wrapper **fails open**: if `rtk` is absent or errors,
the original command runs unchanged — a broken or missing rtk never blocks you.

## Security & trust

Enabling rtk runs its binary on your Bash commands, so trust it as you would any
other dev tool you install and run locally. Output compression can drop or
reshape a command's output, so a compressed view of untrusted output should not
be treated as authoritative — reach for the raw command when the exact bytes
matter. ADR 0013 records the full rationale and residual-risk analysis.

## Where to read more

- [ADR 0013](../../docs/decisions/0013-opt-in-rtk-output-compression.md) — the
  full decision: opt-in design, the runtime gate, the cargo-from-git install
  pinned to an immutable commit SHA (rtk `v0.43.0`), and the coexistence
  guarantee.
- [Installer reference](../installer/README.md) — the `--with-rtk` /
  `--without-rtk` flags and the `AIDLC_INSTALL_RTK` (install) vs
  `AIDLC_ENABLE_RTK` (runtime) distinction in the installer's own terms.
- [Cross-platform contract](cross-platform.md) — why rtk is Claude-Code-only and
  absent everywhere else.

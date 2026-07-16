# rtk output compression (may be active)

This repository has AI-DLC's optional **rtk (Rust Token Killer)** integration
installed. This file describes what rtk does when it is active. When the installer
**manages your `CLAUDE.md`** (it created/stamped it and the `<!-- ai-dlc:begin -->`
markers are present), enabling rtk adds an `@.ai-dlc/rtk/RTK.md` import to that
managed region, so this doc **is loaded as agent context** — the agent is aware rtk
may be compressing command output. If your `CLAUDE.md` is **consumer-owned** (the
installer left it untouched and wrote a `CLAUDE.md.new` sidecar instead), this file
is a **human-facing reference** until you add that one import line yourself.

rtk is gated at two independent layers, so it commonly lands while runtime-inert:

- **Install-time:** the files and hook are present only when installed with
  `--with-rtk` / `AIDLC_INSTALL_RTK=1`.
- **Runtime:** even when installed, the `PreToolUse` hook does nothing unless
  `AIDLC_ENABLE_RTK=1` is set in the environment at runtime. With it unset or `0`,
  commands run normally and output is untouched.

When active, the hook routes eligible Bash commands through
[rtk](https://github.com/rtk-ai/rtk), which compresses their output before it
reaches the model:

- **Command output may be summarized or truncated.** Verbose output (build logs,
  test runners, large listings) is condensed to save tokens. What the model sees
  may be a compressed view, not the exact, full output of a command.
- **Phase-transition commands are passed through unchanged.** Commands in the
  transition families (`git`, `gh`, `npm`, `pnpm`, `yarn`, `make`) and
  deploy/release commands are never rewritten by rtk, so the AI-DLC arbiter gate
  sees them exactly as issued.
- **Security caveat.** Output compression can drop or summarize a
  security-relevant message. A compressed view of untrusted command output must
  **not** be treated as authoritative — when a security decision depends on it,
  verify against the raw, uncompressed output.

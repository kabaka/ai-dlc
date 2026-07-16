#!/usr/bin/env bash
# AI-DLC rtk (Rust Token Killer) PreToolUse wrapper — OPT-IN, default INERT.
#
# WHAT THIS DOES
#   rtk (github.com/rtk-ai/rtk, Apache-2.0) compresses CLI command output before
#   it reaches the model. Its Claude Code integration is a PreToolUse hook: given
#   Claude's PreToolUse JSON on stdin, rtk emits a hookSpecificOutput JSON with
#   permissionDecision:"allow" + updatedInput carrying a rewritten command that
#   pipes the original through rtk so the model sees compressed output.
#
#   This wrapper is a thin, fail-open shim around rtk's OWN native delegate,
#   `rtk hook claude`. We NEVER hand-author rtk's JSON — we hand rtk our stdin and
#   forward its stdout verbatim. rtk owns the rewrite contract; we own only the
#   opt-in gating and the safety pass-throughs.
#
# ACTIVATION MODEL (one rule for both install layers)
#   The wrapper is INERT unless the environment variable AIDLC_ENABLE_RTK=1 is set
#   at RUNTIME. This runtime gate is authoritative: a cloud setup-script's output
#   is cached and does not rebuild when env changes, so gating in the hook itself
#   is the reliable kill switch. Default (unset / 0) => this hook does nothing and
#   Claude proceeds with the original command.
#
# RELATIONSHIP TO THE ARBITER GATE (security is NOT from this file)
#   The arbiter-gate hook independently enforces phase-transition gates via
#   Claude's PARALLEL hook execution + deny-precedence: every matching PreToolUse
#   hook runs on the ORIGINAL tool_input, and any hook's `deny` beats another's
#   `allow`. So the arbiter always sees the original, un-rewritten command and can
#   still deny it regardless of what this wrapper does. The transition
#   pass-through below (step 5) is a CLEANLINESS measure — it keeps rtk from
#   touching approved-transition commands and avoids two hooks both emitting
#   updatedInput — NOT a security control. Do not weaken the arbiter gate on the
#   assumption that this list guards anything.

set -u

# 1. Read all of stdin: we must both inspect it and forward it to rtk.
input="$(cat)"

# 2. Runtime gate (the kill switch). Default INERT. No stdout => Claude proceeds
#    with the original command.
if [ "${AIDLC_ENABLE_RTK:-0}" != "1" ]; then
  exit 0
fi

# 3. Fail-open on absence: if rtk is not on PATH, do nothing (original command
#    runs unchanged). An absent rtk must never block a command.
if ! command -v rtk >/dev/null 2>&1; then
  exit 0
fi

# 4. jq presence: we need jq to safely inspect the command word. Without it we
#    cannot classify, so we pass through rather than guess.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

# 5. Transition pass-through (CLEANLINESS, not a security control — see header).
#    Extract the command's first token and, if it is in a conservative family that
#    overlaps the arbiter's transition families, or the command carries a
#    deploy/release word, pass through WITHOUT wrapping. This keeps rtk off
#    approved transitions and prevents a double-updatedInput race. It intentionally
#    OVER-passes-through (a conservative superset) and need not mirror
#    arbiter-gate.sh exactly. Security does NOT depend on this list — the arbiter
#    gate enforces transitions independently via deny-precedence.
command_str="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
if [ -n "$command_str" ]; then
  # First whitespace-delimited token, path stripped to its basename.
  first_word="${command_str%%[[:space:]]*}"
  base_word="${first_word##*/}"
  case "$base_word" in
    git|gh|npm|pnpm|yarn|make)
      exit 0
      ;;
  esac
  # deploy/release appearing anywhere as a word (conservative over-match).
  if printf '%s' "$command_str" | grep -Eqw 'deploy|release'; then
    exit 0
  fi
fi

# 6. Delegate to rtk's native hook. Capture its stdout so a non-zero rtk exit
#    cannot block the command (fail-open): only forward stdout on success; on any
#    rtk failure exit 0 with no output so Claude runs the original command. The
#    `if` tests the pipeline's exit status directly (avoids inspecting $?).
if rtk_out="$(printf '%s' "$input" | rtk hook claude 2>/dev/null)"; then
  printf '%s' "$rtk_out"
fi
exit 0

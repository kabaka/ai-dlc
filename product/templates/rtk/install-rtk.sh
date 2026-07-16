#!/usr/bin/env bash
# AI-DLC rtk (Rust Token Killer) installer — for a cloud/web setup script.
#
# Installs the REAL rtk from github.com/rtk-ai/rtk (Apache-2.0), pinned to an
# IMMUTABLE commit SHA (not the mutable tag) whose Cargo.lock lets `--locked`
# succeed. This is a DIFFERENT tool from the crates.io crate named "rtk" ("Rust
# Type Kit"), so we install from the git rev and then FUNCTIONALLY disambiguate the
# two by a subcommand only rtk-ai/rtk has (`rtk hook claude`), never by a version
# string. (That disambiguation is NOT a tamper/authenticity check — see below.)
#
# Exit status: non-zero on real failure (so a setup-script failure is observable
# in the web session logs). Note the runtime wrapper (rtk-wrap.sh) fails OPEN, so
# an absent/failed rtk never blocks a command at hook time — this installer's
# failure surfaces the problem without breaking the session.

set -eu

# --- Pin (bump in ONE place; keep RTK_REV in sync with lib/rtk.mjs) ----------
# We install by --rev <full 40-char SHA>, never by --tag: a mutable tag could be
# moved to point at different code, so the immutable commit is the security pin.
# RTK_VERSION is kept only for human-readable messages and the version re-check.
RTK_VERSION="v0.43.0"
RTK_REV="5a7880d404db8364d602f2ecdc41dd790f64013f" # rtk v0.43.0
RTK_REPO="https://github.com/rtk-ai/rtk"

# The cargo-installed binary path. The idempotence guard and the post-install
# checks target THIS path directly rather than a PATH-resolved `rtk`: a shadowing
# binary earlier on PATH must never short-circuit the build or mask a bad install.
CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin/rtk"

echo "[install-rtk] AI-DLC rtk installer — target ${RTK_VERSION} (${RTK_REV}) from ${RTK_REPO}"

# --- Functional identity probe (NOT a tamper/authenticity check) ------------
# rtk-ai/rtk ships the `rtk hook claude` delegate; the crates.io crate also named
# "rtk" ("Rust Type Kit") does not. A succeeding `rtk hook claude --help` tells the
# two DIFFERENT tools apart. This is a FUNCTIONAL disambiguation ONLY — it does not
# prove provenance or integrity of the binary; the immutable --rev pin + `--locked`
# are what constrain WHAT is built.
#   $1 = path to the rtk binary to probe
is_real_rtk() {
  [ -x "$1" ] && "$1" hook claude --help >/dev/null 2>&1
}

# True if the binary at $1 reports the pinned version as a whole token. -Fqw uses
# FIXED-STRING matching so the dots in the version are literal, not regex metachars.
#   $1 = path to the rtk binary to probe
is_pinned_version() {
  "$1" --version 2>/dev/null | grep -Fqw "${RTK_VERSION#v}"
}

# --- Idempotent already-installed guard -------------------------------------
# Decide "already up to date" from the CARGO-INSTALLED binary directly. If it is
# genuinely rtk-ai/rtk AND already at the pinned version, do nothing.
if is_real_rtk "$CARGO_BIN" && is_pinned_version "$CARGO_BIN"; then
  echo "[install-rtk] rtk ${RTK_VERSION} already installed at ${CARGO_BIN} — nothing to do."
  exit 0
fi
if [ -x "$CARGO_BIN" ]; then
  echo "[install-rtk] rtk at ${CARGO_BIN} is absent/impostor/wrong-version; reinstalling."
fi

# --- Install ----------------------------------------------------------------
# --locked works because rtk-ai/rtk commits Cargo.lock at the pinned commit.
# --force lets us overwrite a differently-versioned binary already installed.
if ! command -v cargo >/dev/null 2>&1; then
  echo "[install-rtk] ERROR: cargo (Rust toolchain) is not installed; cannot build rtk." >&2
  echo "[install-rtk] Install Rust (https://rustup.rs) in the setup script before this step." >&2
  exit 1
fi

echo "[install-rtk] cargo install --git ${RTK_REPO} --rev ${RTK_REV} --locked --force"
cargo install --git "${RTK_REPO}" --rev "${RTK_REV}" --locked --force

# --- Post-install verification (identity AND version, targeting the cargo bin) --
# Refuse an impostor: the built binary MUST expose `rtk hook claude`.
if ! is_real_rtk "$CARGO_BIN"; then
  echo "========================================================================" >&2
  echo "[install-rtk] FATAL: the binary at ${CARGO_BIN} is NOT rtk-ai/rtk." >&2
  echo "[install-rtk] The 'rtk hook claude' delegate is absent — refusing." >&2
  echo "[install-rtk] The crates.io crate named 'rtk' is a DIFFERENT tool" >&2
  echo "[install-rtk] ('Rust Type Kit'). Ensure ${RTK_REPO} @ ${RTK_REV} built" >&2
  echo "[install-rtk] correctly, then re-run." >&2
  echo "========================================================================" >&2
  exit 1
fi
# L3 symmetry: re-verify the INSTALLED version matches the pin, not just identity.
if ! is_pinned_version "$CARGO_BIN"; then
  installed_version="$("$CARGO_BIN" --version 2>/dev/null || true)"
  echo "[install-rtk] FATAL: ${CARGO_BIN} is not ${RTK_VERSION} (found: ${installed_version:-unknown})." >&2
  echo "[install-rtk] The --rev build produced an unexpected version — refusing." >&2
  exit 1
fi

echo "[install-rtk] OK: rtk-ai/rtk ${RTK_VERSION} (${RTK_REV}) installed and verified."
echo "[install-rtk] Reminder: the wrapper is INERT until AIDLC_ENABLE_RTK=1 is set at runtime."
exit 0

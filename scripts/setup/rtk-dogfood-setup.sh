#!/usr/bin/env bash
# AI-DLC layer-1 dogfood entrypoint — point a Claude Code web *setup script* here
# to install rtk for THIS repo's cloud sessions. OPT-IN even at install time.
#
# The committed PreToolUse hook (.claude/settings.json) is INERT unless
# AIDLC_ENABLE_RTK=1 is set at runtime, so installing rtk is only useful for a
# contributor who has opted in. This script mirrors that gate: it installs
# nothing unless AIDLC_ENABLE_RTK=1. See docs/decisions/0013-opt-in-rtk-output-compression.md.

set -eu

echo "[rtk-dogfood-setup] AI-DLC layer-1 rtk dogfood setup"

if [ "${AIDLC_ENABLE_RTK:-0}" != "1" ]; then
  echo "rtk dogfood not enabled (set AIDLC_ENABLE_RTK=1)"
  exit 0
fi

# Resolve this script's directory robustly (works from any cwd), then delegate to
# the canonical, shellcheck-clean installer.
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
INSTALLER="$SCRIPT_DIR/../../product/templates/rtk/install-rtk.sh"

echo "[rtk-dogfood-setup] AIDLC_ENABLE_RTK=1 — running installer: $INSTALLER"
exec bash "$INSTALLER"

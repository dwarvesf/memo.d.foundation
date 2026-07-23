#!/usr/bin/env bash
# Fails loud if any submodule (at any recursion depth) is uninitialized (`-`)
# or checked out at a commit that doesn't match the superproject's pin (`+`).
#
# Why this exists: git-fetch.sh's update loop is best-effort by design (SSH ->
# HTTPS fallback, per-submodule `|| true`/`|| echo`), which is fine for
# resilience but meant a totally broken submodule chain (e.g. the dead
# vault/opensource/{dotfiles,yggdrasil,glod} pointers behind
# dwarvesf/opensource#1) still made the script print "done" and exit 0. This
# is the tripwire that turns that into a loud failure.
#
# Reads `git submodule status --recursive` output from stdin if piped,
# otherwise runs it itself (repo root only, since submodule paths are
# relative to the superproject root).
set -euo pipefail

if [ -t 0 ]; then
  status=$(git submodule status --recursive)
else
  status=$(cat)
fi

broken=$(printf '%s\n' "$status" | grep -E '^[-+]' || true)

if [ -n "$broken" ]; then
  echo "ERROR: submodule(s) not correctly initialized/synced:" >&2
  printf '%s\n' "$broken" >&2
  exit 1
fi

count=$(printf '%s\n' "$status" | grep -cve '^\s*$' || true)
echo "All submodules verified OK ($count checked)."

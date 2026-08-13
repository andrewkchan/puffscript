#!/usr/bin/env bash
# Differentially tests the self-hosted compiler against the TS reference
# compiler over the fixture corpus.
# Usage: tools/compare-selfhost.sh <mode> <selfhost.wasm> <fixtures...>
#   mode: sexpr | errors | wat
set -uo pipefail
cd "$(dirname "$0")/.."

MODE="$1"; shift
WASM="$1"; shift

PASS=0
FAIL=0
for f in "$@"; do
  if [ "$MODE" = "wat" ]; then
    node dist/tools/puffc.js "$f" > /tmp/cmp-a.out 2>/tmp/cmp-a.err; AE=$?
  else
    node dist/tools/dump.js "--$MODE" "$f" > /tmp/cmp-a.out 2>/tmp/cmp-a.err; AE=$?
  fi
  node dist/tools/run.js "$WASM" --stdin "$f" > /tmp/cmp-b.out 2>/tmp/cmp-b.err; BE=$?
  if diff -q /tmp/cmp-a.out /tmp/cmp-b.out >/dev/null && diff -q /tmp/cmp-a.err /tmp/cmp-b.err >/dev/null && [ "$AE" -eq "$BE" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    echo "DIFF $f (exit $AE vs $BE)"
  fi
done
echo "$MODE: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]

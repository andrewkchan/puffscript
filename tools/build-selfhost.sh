#!/usr/bin/env bash
# Compiles the self-hosted compiler sources (plus an optional dev main)
# with the TypeScript reference compiler into a runnable wasm module.
# Usage: tools/build-selfhost.sh <output.wasm> [extra-main.puff]
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:?usage: build-selfhost.sh <output.wasm> [main.puff]}"
MAIN="${2:-selfhost/main.puff}"

SOURCES=(
  selfhost/util.puff
  selfhost/scanner.puff
)
[ -f selfhost/ast.puff ] && SOURCES+=(selfhost/ast.puff)
[ -f selfhost/sexpr.puff ] && SOURCES+=(selfhost/sexpr.puff)
[ -f selfhost/parser.puff ] && SOURCES+=(selfhost/parser.puff)
[ -f selfhost/resolver.puff ] && SOURCES+=(selfhost/resolver.puff)
[ -f selfhost/backend.puff ] && SOURCES+=(selfhost/backend.puff)
SOURCES+=("$MAIN")

WAT="${OUT%.wasm}.wat"
node dist/tools/puffc.js "${SOURCES[@]}" -o "$WAT"
node dist/tools/wat2wasm.js "$WAT" -o "$OUT"

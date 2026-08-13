#!/usr/bin/env bash
# Bootstraps the self-hosted puffscript compiler and verifies the fixpoint:
#   stage1: selfhost compiler sources compiled by the TypeScript compiler
#   stage2: stage1 compiling its own source (must match the reference output)
#   stage3: stage2 compiling its own source (must match stage2's output)
# Artifacts are written to test/ (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."

SOURCES=(
  selfhost/util.puff
  selfhost/scanner.puff
  selfhost/ast.puff
  selfhost/sexpr.puff
  selfhost/parser.puff
  selfhost/resolver.puff
  selfhost/backend.puff
  selfhost/main.puff
)

mkdir -p test
cat "${SOURCES[@]}" > test/puffc.puff

echo "[stage1] compiling the self-hosted compiler with the TypeScript compiler..."
node dist/tools/puffc.js "${SOURCES[@]}" -o test/stage1.wat
node dist/tools/wat2wasm.js test/stage1.wat -o test/stage1.wasm

echo "[stage2] self-hosted compiler compiling its own source..."
node dist/tools/run.js test/stage1.wasm --stdin test/puffc.puff --stdout test/stage2.wat
if ! cmp -s test/stage1.wat test/stage2.wat; then
  echo "FAIL: stage2 output differs from the reference compiler's output"
  exit 1
fi
node dist/tools/wat2wasm.js test/stage2.wat -o test/stage2.wasm

echo "[stage3] self-compiled compiler compiling its own source..."
node dist/tools/run.js test/stage2.wasm --stdin test/puffc.puff --stdout test/stage3.wat
if ! cmp -s test/stage2.wat test/stage3.wat; then
  echo "FAIL: bootstrap did not reach a fixpoint"
  exit 1
fi

echo "OK: bootstrap fixpoint reached."
echo "  - self-hosted compiler binary: test/stage2.wasm"
echo "  - compile a program with it:"
echo "      node dist/tools/run.js test/stage2.wasm --stdin program.puff --stdout program.wat"

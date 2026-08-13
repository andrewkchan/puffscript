// Converts a WAT file to a WASM binary using the wabt JS API.
// Usage: node dist/tools/wat2wasm.js input.wat -o output.wasm
import fs from 'fs'
import wabtFactory from 'wabt'

async function main() {
  const args = process.argv.slice(2)
  let outFile: string | null = null
  let inFile: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o") {
      outFile = args[++i]
    } else {
      inFile = args[i]
    }
  }
  if (inFile === null || outFile === null) {
    console.error("usage: wat2wasm input.wat -o output.wasm")
    process.exit(2)
  }
  const wabt = await wabtFactory()
  const source = fs.readFileSync(inFile, "utf8")
  const module = wabt.parseWat(inFile, source)
  module.resolveNames()
  module.validate()
  const binary = module.toBinary({ log: false, write_debug_names: false })
  fs.writeFileSync(outFile, Buffer.from(binary.buffer))
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})

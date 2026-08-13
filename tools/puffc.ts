// CLI driver for the TypeScript reference compiler.
// Usage: node dist/tools/puffc.js [-o out.wat] input1.puff [input2.puff ...]
// Multiple inputs are concatenated in order before compilation (poor-man's modules).
import fs from 'fs'
import { compile } from '../index'

function main() {
  const args = process.argv.slice(2)
  let outFile: string | null = null
  const inputs: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o") {
      outFile = args[++i]
    } else {
      inputs.push(args[i])
    }
  }
  if (inputs.length === 0) {
    console.error("usage: puffc [-o out.wat] input1.puff [input2.puff ...]")
    process.exit(2)
  }
  const source = inputs.map((f) => fs.readFileSync(f, "utf8")).join("\n")
  const result = compile(source)
  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(err)
    }
    process.exit(1)
  }
  if (outFile !== null) {
    fs.writeFileSync(outFile, result.program!)
  } else {
    process.stdout.write(result.program!)
  }
}

main()

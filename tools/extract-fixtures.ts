// Extracts embedded puffscript sources from test.ts into fixture files for
// differential testing of the self-hosted compiler.
// Usage: node dist/tools/extract-fixtures.js <outdir>
import fs from 'fs'
import path from 'path'

function main() {
  const outDir = process.argv[2] ?? "test/fixtures"
  fs.mkdirSync(outDir, { recursive: true })
  const testSource = fs.readFileSync(path.join(__dirname, "../../test.ts"), "utf8")

  // Matches the first template-literal argument of test helper calls.
  const re = /(expectOutput|expectAST|expectParseErrors|expectResolveErrors)\(\s*`([^`]*)`/g
  let m: RegExpExecArray | null
  let counts: Record<string, number> = {}
  while ((m = re.exec(testSource)) !== null) {
    const kind = m[1] === "expectOutput" ? "e2e" :
      m[1] === "expectAST" ? "ast" :
      m[1] === "expectParseErrors" ? "parseerr" : "resolveerr"
    counts[kind] = (counts[kind] ?? 0) + 1
    const name = `${kind}-${String(counts[kind]).padStart(3, "0")}.puff`
    fs.writeFileSync(path.join(outDir, name), m[2].trim() + "\n")
  }
  console.log(JSON.stringify(counts))
}

main()

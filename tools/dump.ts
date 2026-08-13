// Debug dumps from the TypeScript reference compiler, for differential
// testing against the self-hosted compiler.
// Usage: node dist/tools/dump.js --tokens|--sexpr|--errors file.puff [more.puff ...]
import fs from 'fs'
import { scanTokens } from '../src/scanner'
import { parse } from '../src/parser'
import { resolve } from '../src/resolver'
import { TokenType } from '../src/tokens'
import * as ast from '../src/nodes'
import { ReportError } from '../src/util'

function main() {
  const args = process.argv.slice(2)
  let mode: string | null = null
  const inputs: string[] = []
  for (const a of args) {
    if (a.startsWith("--")) {
      mode = a.substring(2)
    } else {
      inputs.push(a)
    }
  }
  if (mode === null || inputs.length === 0) {
    console.error("usage: dump --tokens|--sexpr|--errors file.puff [more.puff ...]")
    process.exit(2)
  }
  const source = inputs.map((f) => fs.readFileSync(f, "utf8")).join("\n")
  const errors: string[] = []
  const reportError: ReportError = (line, msg) => {
    errors.push(`${line}: ${msg}`)
  }

  const tokens = scanTokens(source, reportError)
  let out = ""
  if (mode === "tokens") {
    if (errors.length === 0) {
      for (const t of tokens) {
        out += `${t.type} ${t.offset} ${t.lexeme.length}`
        if (t.type === TokenType.NUMBER || t.type === TokenType.NUMBER_HEX) {
          out += ` ${t.literal}`
        }
        out += "\n"
      }
    }
  } else if (mode === "sexpr") {
    if (errors.length === 0) {
      const context = parse(tokens, reportError)
      if (errors.length === 0) {
        out += "("
        context.topLevelStatements.forEach((stmt, i) => {
          if (i > 0) out += " "
          out += ast.astToSExpr(stmt)
        })
        out += ")\n"
      }
    }
  } else if (mode === "errors") {
    if (errors.length === 0) {
      const context = parse(tokens, reportError)
      if (errors.length === 0) {
        resolve(context, reportError)
      }
    }
  } else {
    console.error(`unknown mode ${mode}`)
    process.exit(2)
  }
  process.stdout.write(out)
  for (const e of errors) {
    process.stderr.write(e + "\n")
  }
  process.exit(errors.length > 0 ? 1 : 0)
}

main()

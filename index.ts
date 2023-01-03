import { scanTokens } from './src/scanner'
import { parse } from './src/parser'
import { resolve } from './src/resolver'
import { emit } from './src/backend'
import { ReportError } from './src/util'

export interface CompileResult {
  // Generated WAT code for the given program.
  // If compilation fails, this is null.
  program: string | null
  // List of errors reported during compilation.
  errors: string[]
}

export function compile(source: string): CompileResult {
  const result: CompileResult = {
    program: null,
    errors: []
  }
  const reportError: ReportError = (line, msg) => {
    result.errors.push(`${line}: ${msg}`)
  }

  const tokens = scanTokens(source, reportError)
  if (result.errors.length > 0) {
    return result
  }

  const context = parse(tokens, reportError)
  if (result.errors.length > 0) {
    return result
  }

  resolve(context, reportError)
  if (result.errors.length > 0) {
    return result
  }

  result.program = emit(context)
  return result
}
import { TokenType, TokenPattern } from './tokens'
import { ReportError } from './util'

export function fakeToken(type: TokenType, lexeme: string, tokenProvidingLocation: Token | null = null): Token {
  return new Token(
    type, lexeme, null,
    tokenProvidingLocation ? tokenProvidingLocation.offset : 0,
    tokenProvidingLocation ? tokenProvidingLocation.source : ""
  )
}

const i32 = new Uint32Array(1)
function parseInt32(str: string): number {
  i32[0] = parseInt(str)
  return i32[0]
}

export class Token {
  readonly type: TokenType
  readonly lexeme: string
  readonly literal: any
  // NOTE: `lexeme` need not equal `source[offset..lexeme.length]`.
  // Token lexemes may be used to determine operator function, while
  // `source` and `offset` should only be used for error reporting.
  readonly offset: number
  readonly source: string

  constructor(type: TokenType, lexeme: string, literal: any, offset: number, source: string) {
    this.type = type
    this.lexeme = lexeme
    this.literal = literal
    this.offset = offset
    this.source = source
  }

  line(): number {
    let lines = 1
    for (let i = 0; i < this.offset; i++) {
      if (this.source.charAt(i) == '\n') {
        lines++
      }
    }
    return lines
  }

  lineStr(showPointer: boolean = true): string {
    let start = 0
    for (let i = 0; i < this.offset; i++) {
      if (this.source.charAt(i) == '\n') {
        start = i + 1
      }
    }
    let end = this.offset + this.lexeme.length;
    for (let i = end; i < this.source.length; i++) {
      if (this.source.charAt(i) == '\n') {
        end = i;
        break
      }
    }
    const snippet = this.source.substring(start, end)
    let ptr = ""
    for (let i = 0; i < this.offset - start; i++) {
      ptr += " "
    }
    ptr += "^"
    return showPointer ? `${snippet}\n${ptr}` : snippet
  }

  toString(): string {
    return TokenType[this.type] + " " + this.lexeme + " " + this.literal;
  }
}

function match(source: string, current: number, pattern: RegExp): RegExpMatchArray | null {
  pattern.lastIndex = current
  return source.match(pattern)
}

export function scanTokens(source: string, reportError: ReportError): Array<Token> {
  const WHITESPACE = /\s+/y
  const tokens: Array<Token> = []
  let current = 0
  // Iteratively scan for tokens. Keywords are also valid identifiers, so
  // are handled after matching identifiers.
  scanner:
  while (current < source.length) {
    // 1. check if current lexeme is whitespace
    const ws = match(source, current, WHITESPACE)
    if (ws !== null) {
      // whitespace is not included in tokens
      current += ws[0].length
      continue scanner
    }
    // 2. check if current lexeme matches a valid token (not including keywords)
    token:
    for (let t = TokenType.IDENTIFIER; t < TokenType.BYTE; t++) {
      const m = match(source, current, TokenPattern[t])
      if (m !== null) {
        const lexeme = m[0]
        if (t === TokenType.IDENTIFIER) {
          // Check if it's also a keyword and set token type accordingly
          keyword:
          for (let k = TokenType.BYTE; k <= TokenType.WHILE; k++) {
            const keywordMatch = match(source, current, TokenPattern[k])
            if (keywordMatch !== null && keywordMatch[0] === lexeme) {
              t = k
              break keyword
            }
          }
          tokens.push(new Token(t, lexeme, null, current, source))
        } else if (t === TokenType.STRING) {
          const val = lexeme.substring(1, lexeme.length - 1)
          tokens.push(new Token(t, lexeme, val, current, source))
        } else if (t === TokenType.SINGLE_QUOTE_STRING) {
          const val = lexeme.substring(1, lexeme.length - 1)
          tokens.push(new Token(t, lexeme, val, current, source))
        } else if (t === TokenType.NUMBER_DECIMAL) {
          const val = parseFloat(lexeme)
          tokens.push(new Token(t, lexeme, val, current, source))
        } else if (t === TokenType.NUMBER) {
          // TODO: Warn about too large numbers?
          const val = parseInt(lexeme)
          tokens.push(new Token(t, lexeme, val, current, source))
        } else if (t === TokenType.NUMBER_HEX) {
          const val = parseInt32(lexeme)
          const token = new Token(t, lexeme, val, current, source)
          tokens.push(token)
          if (lexeme.length > 2 + 8) {
            reportError(token.line(), `Hex literal does not fit in any numeric type.`)
          }
        } else if (t !== TokenType.COMMENT) {
          // comments are skipped and not added as tokens
          tokens.push(new Token(t, lexeme, null, current, source))
        }
        current += lexeme.length
        // Lexemes are scanned to exactly 1 valid token
        continue scanner
      }
    }
    // 3. current lexeme is an invalid character. report error and advance.
    let line = 1
    for (let i = 0; i < current; i++) {
      if (source.charAt(i) == '\n') {
        line++
      }
    }
    reportError(line, `Unexpected character '${source.charAt(current)}'.`)
    current++
  }

  tokens.push(new Token(TokenType.EOF, "", null, current, source))
  return tokens
}
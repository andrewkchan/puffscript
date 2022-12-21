import { TokenType, TokenPattern } from './tokens'
import { ReportError } from './util'

export class Token {
  readonly type: TokenType
  readonly lexeme: string
  readonly literal: any
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

  lineStr(): string {
    let start = 0
    for (let i = 0; i < this.offset; i++) {
      if (this.source.charAt(i) == '\n') {
        start = i + 1
      }
    }
    const snippet = this.source.substring(start, this.offset + this.lexeme.length + 1)
    let ptr = ""
    for (let i = 0; i < this.offset - start; i++) {
      ptr += " "
    }
    ptr += "^"
    return `${snippet}\n${ptr}`
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
    for (let t = TokenType.IDENTIFIER; t <= TokenType.BAR_BAR; t++) {
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
        } else if (t === TokenType.NUMBER_DECIMAL) {
          const val = parseFloat(lexeme)
          tokens.push(new Token(t, lexeme, val, current, source))
        } else if (t === TokenType.NUMBER) {
          const val = parseInt(lexeme)
          tokens.push(new Token(t, lexeme, val, current, source))
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
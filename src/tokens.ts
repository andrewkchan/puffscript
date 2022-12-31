// NOTE: these are ordered so that a scanner matching tokens to
// input will choose longer tokens when input can match multiple tokens.
// E.g. "==" will match to EQUAL_EQUAL instead of EQUAL.
export enum TokenType {
  // Literals.
  IDENTIFIER,
  STRING,
  SINGLE_QUOTE_STRING,
  NUMBER_DECIMAL,
  NUMBER_HEX,
  NUMBER,
  COMMENT,

  // Single-character tokens.
  LEFT_PAREN,
  RIGHT_PAREN,
  LEFT_BRACE,
  RIGHT_BRACE,
  LEFT_BRACKET,
  RIGHT_BRACKET,
  COMMA,
  MINUS,
  PLUS,
  SEMICOLON,
  SLASH,
  STAR,
  PERCENT,
  TILDE,

  // One or two character tokens.
  BANG_EQUAL,
  BANG,
  EQUAL_EQUAL,
  EQUAL,
  GREATER_EQUAL,
  GREATER,
  LESS_EQUAL,
  LESS,
  AMP_AMP,
  AMP,
  BAR_BAR,

  // Keywords.
  BYTE,
  BOOL,
  DEF,
  ELSE,
  FALSE,
  FOR,
  FLOAT,
  IF,
  INT,
  LEN,
  PRINT,
  RETURN,
  TRUE,
  VAR,
  WHILE,

  EOF
}

export const TokenPattern: Readonly<Record<TokenType, RegExp>> = {
  // Literals.
  [TokenType.IDENTIFIER]: /[a-zA-Z_][a-zA-Z0-9_]*/y,
  [TokenType.STRING]: /"[^"]*"/y,
  [TokenType.SINGLE_QUOTE_STRING]: /'[^']*'/y,
  [TokenType.NUMBER_DECIMAL]: /\d+\.\d*/y,
  [TokenType.NUMBER_HEX]: /0x[a-fA-F0-9]+/y,
  [TokenType.NUMBER]: /\d+/y,
  [TokenType.COMMENT]: /\/\/.*/y,

  // Single-character tokens.
  [TokenType.LEFT_PAREN]: /\(/y,
  [TokenType.RIGHT_PAREN]: /\)/y,
  [TokenType.LEFT_BRACE]: /\{/y,
  [TokenType.RIGHT_BRACE]: /\}/y,
  [TokenType.LEFT_BRACKET]: /\[/y,
  [TokenType.RIGHT_BRACKET]: /\]/y,
  [TokenType.COMMA]: /,/y,
  [TokenType.MINUS]: /-/y,
  [TokenType.PLUS]: /\+/y,
  [TokenType.SEMICOLON]: /;/y,
  [TokenType.SLASH]: /\//y,
  [TokenType.STAR]: /\*/y,
  [TokenType.PERCENT]: /%/y,
  [TokenType.TILDE]: /~/y,

  // One or two character tokens.
  [TokenType.BANG_EQUAL]: /!=/y,
  [TokenType.BANG]: /!/y,
  [TokenType.EQUAL_EQUAL]: /==/y,
  [TokenType.EQUAL]: /=/y,
  [TokenType.GREATER_EQUAL]: />=/y,
  [TokenType.GREATER]: />/y,
  [TokenType.LESS_EQUAL]: /<=/y,
  [TokenType.LESS]: /</y,
  [TokenType.AMP_AMP]: /&&/y,
  [TokenType.AMP]: /&/y,
  [TokenType.BAR_BAR]: /\|\|/y,

  // Keywords.
  [TokenType.BYTE]: /byte/y,
  [TokenType.BOOL]: /bool/y,
  [TokenType.DEF]: /def/y,
  [TokenType.ELSE]: /else/y,
  [TokenType.FALSE]: /false/y,
  [TokenType.FOR]: /for/y,
  [TokenType.FLOAT]: /float/y,
  [TokenType.IF]: /if/y,
  [TokenType.INT]: /int/y,
  [TokenType.LEN]: /len/y,
  [TokenType.PRINT]: /print/y,
  [TokenType.RETURN]: /return/y,
  [TokenType.TRUE]: /true/y,
  [TokenType.VAR]: /var/y,
  [TokenType.WHILE]: /while/y,

  [TokenType.EOF]: /* unhandled */ /$/y
}
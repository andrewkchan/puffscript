import { ReportError } from './util'
import { TokenType } from './tokens'
import { Token } from './scanner'
import * as ast from './nodes'

class ParseError extends Error {}

export function parse(tokens: Token[], reportError: ReportError): ast.TopStmt[] {
  let current = 0

  // advances and returns true if next token matches input token type,
  // else returns false
  function match(t: TokenType): boolean {
    if (check(t)) {
      advance()
      return true
    }
    return false
  }

  // same as `match`, but does not advance
  function check(t: TokenType): boolean {
    if (isAtEnd()) {
      return false
    }
    return peek().type === t
  }

  function peek(): Token {
    return tokens[current]
  }

  function previous(): Token {
    return tokens[current - 1]
  }

  // advances and returns the next token if it matches the input token type,
  // else throws an error with the given message
  function consume(t: TokenType, msg: string): Token {
    if (check(t)) {
      const token = peek()
      advance()
      return token
    }
    throw parseError(msg)
  }

  function parseError(msg: string): ParseError {
    reportError(peek().line(), msg)
    return new ParseError(msg)
  }

  function advance() {
    if (!isAtEnd()) {
      current++
    }
  }

  // on catching a parse error, discard tokens until we're at the beginning
  // of the next statement/declaration so we can continue parsing w/o cascading 
  // errors
  function synchronize() {
    advance()

    while (!isAtEnd()) {
      if (previous().type === TokenType.SEMICOLON) {
        return
      }

      switch (peek().type) {
        case TokenType.DEF:
        case TokenType.VAR:
        case TokenType.IF:
        case TokenType.PRINT:
        case TokenType.RETURN:
        case TokenType.WHILE: {
          return
        }
        default: {
          break
        }
      }

      advance()
    }
  }

  function isAtEnd(): boolean {
    return peek().type === TokenType.EOF
  }

  function topDecl(): ast.TopStmt {
    if (match(TokenType.DEF)) return funDecl()
    if (match(TokenType.VAR)) return varDecl()

    throw parseError("Only variable declarations and function definitions allowed at the top-level.")
  }

  function funDecl(): ast.FunctionStmt {
    const name = consume(TokenType.IDENTIFIER, "Expect identifier after 'def'.")
    
    consume(TokenType.LEFT_PAREN, "Expect '(' after function name.")
    const params: ast.Param[] = []
    while (!check(TokenType.RIGHT_PAREN) && !isAtEnd()) {
      if (params.length > 0) {
        consume(TokenType.COMMA, "Missing comma after parameter.")
      }
      const paramName = consume(TokenType.IDENTIFIER, "Expect identifier.")
      const paramType = type()
      params.push({
        name: paramName,
        type: paramType
      })
    }
    consume(TokenType.RIGHT_PAREN, "Expect ')' after parameters.")

    let returnType: ast.Type = ast.VoidType
    if (!check(TokenType.LEFT_BRACE)) {
      returnType = type()
    }
    
    consume(TokenType.LEFT_BRACE, "Expect '{' before function body.")
    const body = block()
    
    return {
      kind: ast.NodeKind.FUNCTION_STMT,
      name,
      params,
      returnType,
      body
    }
  }

  function varDecl(): ast.VarStmt {
    const name = consume(TokenType.IDENTIFIER, "Expect identifier after 'var'.")
    
    // null means `infer from initializer`.
    let varType: ast.Type | null = null
    if (!check(TokenType.EQUAL)) {
      varType = type()
    }
    consume(TokenType.EQUAL, "Expect '=' after variable declaration.")
    const expr = expression()
    consume(TokenType.SEMICOLON, "Expect ';' after statement.")
    return {
      kind: ast.NodeKind.VAR_STMT,
      name,
      initializer: expr,
      type: varType
    }
  }

  function statement(): ast.Stmt {
    if (match(TokenType.IF)) {
      return ifStmt()
    }
    if (match(TokenType.PRINT)) {
      return printStmt()
    }
    if (match(TokenType.WHILE)) {
      return whileStmt()
    }
    if (match(TokenType.RETURN)) {
      return returnStmt()
    }
    if (match(TokenType.LEFT_BRACE)) {
      return {
        kind: ast.NodeKind.BLOCK_STMT,
        statements: block()
      }
    }

    const expr = expression()
    consume(TokenType.SEMICOLON, "Expect ';' after expression statement.")
    return {
      kind: ast.NodeKind.EXPRESSION_STMT,
      expression: expr
    }
  }

  function ifStmt(): ast.IfStmt {
    consume(TokenType.LEFT_PAREN, "Expect '(' after 'if'.")
    const expr = expression()
    consume(TokenType.RIGHT_PAREN, "Expect ')' after if condition.")

    const thenBranch = statement()
    let elseBranch: ast.Stmt | null = null
    if (match(TokenType.ELSE)) {
      elseBranch = statement()
    }
    return {
      kind: ast.NodeKind.IF_STMT,
      expression: expr,
      thenBranch,
      elseBranch
    }
  }

  function printStmt(): ast.PrintStmt {
    const expr = expression()
    consume(TokenType.SEMICOLON, "expect ';' after print statement.")
    return {
      kind: ast.NodeKind.PRINT_STMT,
      expression: expr
    }
  }

  function returnStmt(): ast.ReturnStmt {
    const keyword = previous()
    if (match(TokenType.SEMICOLON)) {
      return {
        kind: ast.NodeKind.RETURN_STMT,
        keyword,
        value: null
      }
    }
    const value = expression()
    consume(TokenType.SEMICOLON, "Expect ';' after return statement.")
    return {
      kind: ast.NodeKind.RETURN_STMT,
      keyword,
      value
    }
  }

  function whileStmt(): ast.WhileStmt {
    consume(TokenType.LEFT_PAREN, "Expect '(' after 'while'.")
    const condition = expression()
    consume(TokenType.RIGHT_PAREN, "Expect ')' after loop condition.")

    const body = statement()
    return {
      kind: ast.NodeKind.WHILE_STMT,
      expression: condition,
      body
    }
  }

  function block(): ast.Stmt[] {
    const statements: ast.Stmt[] = []
    while (!check(TokenType.RIGHT_BRACE) && !isAtEnd()) {
      try {
        if (match(TokenType.VAR)) {
          const varStmt = varDecl()
          statements.push(varStmt)
        } else {
          const stmt = statement()
          statements.push(stmt)
        }
      } catch (e) {
        if (e instanceof ParseError) {
          synchronize()
        } else {
          throw e
        }
      }
    }
    consume(TokenType.RIGHT_BRACE, "Expect '}' after block.")
    return statements
  }

  function type(): ast.Type {
    if (match(TokenType.LEFT_BRACKET)) {
      const elementType = type()
      consume(TokenType.SEMICOLON, "Expect ';' in array type.")
      const length = consume(TokenType.NUMBER, "Expect array length specifier.").literal
      consume(TokenType.RIGHT_BRACKET, "Expect ']' after array type.")
      return {
        category: ast.TypeCategory.ARRAY,
        elementType,
        length
      }
    }
    if (match(TokenType.INT)) {
      return ast.IntType
    }
    if (match(TokenType.FLOAT)) {
      return ast.FloatType
    }
    if (match(TokenType.BYTE)) {
      return ast.ByteType
    }
    if (match(TokenType.BOOL)) {
      return ast.BoolType
    }
    throw parseError(`Invalid type specifier starting at '${peek().lexeme}' in line:\n'${peek().lineStr()}'`)
  }

  function expression(): ast.Expr {
    return exprAssignment()
  }

  function exprAssignment(): ast.Expr {
    let expr = exprOr()
    if (match(TokenType.EQUAL)) {
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR) {
        return {
          kind: ast.NodeKind.ASSIGN_EXPR,
          left: expr,
          right
        }
      }
      // No need to panic (throw error) and synchronize.
      // Report error; it's still valuable to continue parsing
      // the rest of whatever statement we're in to indicate
      // remaining syntax errors to the user.
      parseError("Invalid assignment target.")
    }
    return expr
  }

  function exprOr(): ast.Expr {
    let expr = exprAnd()
    while (match(TokenType.BAR_BAR)) {
      const operator = previous()
      const right = exprAnd()
      expr = {
        kind: ast.NodeKind.LOGICAL_EXPR,
        left: expr,
        operator,
        right
      }
    }
    return expr
  }

  function exprAnd(): ast.Expr {
    let expr = exprEquality()
    while (match(TokenType.AMP_AMP)) {
      const operator = previous()
      const right = exprEquality()
      expr = {
        kind: ast.NodeKind.LOGICAL_EXPR,
        left: expr,
        operator,
        right
      }
    }
    return expr
  }

  function exprEquality(): ast.Expr {
    let expr = exprComparison()
    while (match(TokenType.EQUAL_EQUAL) || match(TokenType.BANG_EQUAL)) {
      const operator = previous()
      const right = exprComparison()
      expr = {
        kind: ast.NodeKind.BINARY_EXPR,
        left: expr,
        operator,
        right
      }
    }
    return expr
  }

  function exprComparison(): ast.Expr {
    let expr = exprTerm()
    while (match(TokenType.GREATER) || match(TokenType.GREATER_EQUAL) || match(TokenType.LESS) || match(TokenType.LESS_EQUAL)) {
      const operator = previous()
      const right = exprTerm()
      expr = {
        kind: ast.NodeKind.BINARY_EXPR,
        left: expr,
        operator,
        right
      }
    }
    return expr
  }

  function exprTerm(): ast.Expr {
    let expr = exprFactor()
    while (match(TokenType.MINUS) || match(TokenType.PLUS)) {
      const operator = previous()
      const right = exprFactor()
      expr = {
        kind: ast.NodeKind.BINARY_EXPR,
        left: expr,
        operator,
        right
      }
    }
    return expr
  }

  function exprFactor(): ast.Expr {
    let expr = exprUnary()
    while (match(TokenType.SLASH) || match(TokenType.STAR)) {
      const operator = previous()
      const right = exprUnary()
      expr = {
        kind: ast.NodeKind.BINARY_EXPR,
        left: expr,
        operator,
        right
      }
    }
    return expr
  }

  function exprUnary(): ast.Expr {
    if (match(TokenType.BANG) || match(TokenType.MINUS)) {
      const operator = previous()
      const right = exprUnary()
      return {
        kind: ast.NodeKind.UNARY_EXPR,
        operator,
        right
      }
    }
    return exprCall()
  }

  function exprCall(): ast.Expr {
    let expr = exprPrimary()
    // can have at most one call in series of calls/indexes (no first class functions)
    if (match(TokenType.LEFT_PAREN)) {
      const paren = previous()
      const args: ast.Expr[] = []
      while (!check(TokenType.RIGHT_PAREN) && !isAtEnd()) {
        if (args.length > 0) {
          consume(TokenType.COMMA, "Expect ',' between arguments.")
        }
        const arg = expression()
        args.push(arg)
      }
      consume(TokenType.RIGHT_PAREN, "Expect ')' after arguments.")
      expr = {
        kind: ast.NodeKind.CALL_EXPR,
        callee: expr,
        paren,
        args
      }
    } 
    // can have any number of indexes
    while (match(TokenType.LEFT_BRACKET)) {
      const bracket = previous()
      const index = expression()
      consume(TokenType.RIGHT_BRACKET, "Expect ']' after index.")
      expr = {
        kind: ast.NodeKind.INDEX_EXPR,
        callee: expr,
        bracket,
        index
      }
    }
    return expr
  }

  function exprPrimary(): ast.Expr {
    if (match(TokenType.TRUE) || match(TokenType.FALSE)) {
      return {
        kind: ast.NodeKind.LITERAL_EXPR,
        value: previous().type === TokenType.TRUE ? true : false,
        type: ast.BoolType
      }
    }
    if (match(TokenType.NUMBER)) {
      return {
        kind: ast.NodeKind.LITERAL_EXPR,
        value: previous().literal,
        type: ast.IntType
      }
    }
    if (match(TokenType.NUMBER_DECIMAL)) {
      return {
        kind: ast.NodeKind.LITERAL_EXPR,
        value: previous().literal,
        type: ast.FloatType
      }
    }
    if (match(TokenType.STRING)) {
      // TODO fixme
      throw parseError("Strings not yet supported")
    }
    if (match(TokenType.IDENTIFIER)) {
      return {
        kind: ast.NodeKind.VARIABLE_EXPR,
        name: previous()
      }
    }
    if (match(TokenType.LEFT_PAREN)) {
      const expr = expression()
      consume(TokenType.RIGHT_PAREN, "Expect ')' matching '('.")
      return {
        kind: ast.NodeKind.GROUP_EXPR,
        expression: expr
      }
    }
    if (match(TokenType.LEFT_BRACKET)) {
      if (!check(TokenType.RIGHT_BRACKET)) {
        // disambiguate between [x; N] and [x, y, z] literals
        const arg = expression()
        if (match(TokenType.SEMICOLON)) {
          const length = consume(TokenType.NUMBER, "Expect length specifier in array repeat literal.")
          // TODO fixme
          throw parseError("Arrays not yet supported")
        }
      }
      // TODO fixme
      throw parseError("Arrays not yet supported")
    }

    try {
      // cast expression
      const castType = type()
      switch (castType.category) {
        case ast.TypeCategory.INT: 
        case ast.TypeCategory.FLOAT: 
        case ast.TypeCategory.BYTE: 
        case ast.TypeCategory.BOOL: {
          break
        }
        default: {
          throw parseError("Cannot cast to this type.")
        }
      }
      consume(TokenType.LEFT_PAREN, "Expect '(' after type in cast expression.")
      const value = expression()
      consume(TokenType.RIGHT_PAREN, "Expect ')' after cast expression.")
      return {
        kind: ast.NodeKind.CAST_EXPR,
        type: castType,
        value
      }
    } catch (e) {
      // errors in the above are likely not malformed cast expressions, 
      // they are probably not expressions at all
      throw parseError("Expect expression.")
    }
  }

  const topLevelStatements: ast.TopStmt[] = []
  while (!isAtEnd()) {
    try {
      const stmt = topDecl()
      topLevelStatements.push(stmt)
    } catch (e) {
      if (e instanceof ParseError) {
        synchronize()
      } else {
        throw e
      }
    }
  }

  return topLevelStatements
}

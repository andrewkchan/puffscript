import { ReportError, UTF8Codec } from './util'
import { TokenType } from './tokens'
import { Token, fakeToken } from './scanner'
import * as ast from './nodes'

class ParseError extends Error {}

const codec = new UTF8Codec()

// 1. Construct AST from stream of tokens
// 2. Create scopes for blocks and functions
// 3. Emplace symbol declarations into scopes
// 4. Ensure no duplicate symbols in same scope
export function parse(tokens: Token[], reportError: ReportError): ast.Context {
  const topLevelStatements: ast.TopStmt[] = []
  const global = new ast.Scope(null)
  const context = new ast.Context(global, topLevelStatements)
  const scopes = [global]

  function peekScope(): ast.Scope {
    return scopes[scopes.length - 1]
  }

  function pushScope() {
    scopes.push(new ast.Scope(peekScope()))
  }

  function popScope(): ast.Scope {
    return scopes.pop()!
  }

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
    return parseErrorForToken(peek(), msg)
  }

  function parseErrorForToken(token: Token, msg: string): ParseError {
    reportError(token.line(), msg)
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
    pushScope()
    params.forEach((param) => {
      const scope = peekScope()
      if (scope.hasDirect(param.name.lexeme)) {
        // Don't throw; Function body will be parsed + resolved as if duplicate doesn't exist.
        // Calls will still be parsed + resolved with arity including duplicate.
        parseErrorForToken(param.name, `'${param.name.lexeme}' is already declared in this scope.`)
      } else {
        scope.define(param.name.lexeme, context.paramSymbol(param))
      }
    })
    const body = block()
    const scope = popScope()

    const node = ast.functionStmt({
      name,
      params,
      returnType,
      body,
      scope,
      symbol: null
    })
    const outerScope = peekScope()
    if (outerScope.hasDirect(name.lexeme)) {
      // Throw; we want to ignore this function and synchronize to next statement
      throw parseErrorForToken(name, `'${name.lexeme}' is already declared in this scope.`)
    } else {
      const symbol = context.functionSymbol(node)
      outerScope.define(name.lexeme, symbol)
      node.symbol = symbol
    }
    return node
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
    const node = ast.varStmt({
      name,
      initializer: expr,
      type: varType,
      symbol: null
    })
    const scope = peekScope()
    if (scope.hasDirect(name.lexeme)) {
      parseErrorForToken(name, `'${name.lexeme}' is already declared in this scope.`)
    } else {
      const symbol = context.variableSymbol(node, scope === global)
      scope.define(name.lexeme, symbol)
      node.symbol = symbol
    }
    return node
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
    if (match(TokenType.FOR)) {
      return forStmt()
    }
    if (match(TokenType.RETURN)) {
      return returnStmt()
    }
    if (match(TokenType.LEFT_BRACE)) {
      pushScope()
      const statements = block()
      const scope = popScope()
      return ast.blockStmt({
        statements,
        scope
      })
    }

    return expressionStmt()
  }

  function expressionStmt(): ast.ExpressionStmt {
    const expr = expression()
    consume(TokenType.SEMICOLON, "Expect ';' after expression statement.")
    return ast.expressionStmt({
      expression: expr
    })
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
    return ast.ifStmt({
      expression: expr,
      thenBranch,
      elseBranch
    })
  }

  function printStmt(): ast.PrintStmt {
    const expr = expression()
    consume(TokenType.SEMICOLON, "expect ';' after print statement.")
    return ast.printStmt({
      expression: expr
    })
  }

  function returnStmt(): ast.ReturnStmt {
    const keyword = previous()
    if (match(TokenType.SEMICOLON)) {
      return ast.returnStmt({
        keyword,
        value: null
      })
    }
    const value = expression()
    consume(TokenType.SEMICOLON, "Expect ';' after return statement.")
    return ast.returnStmt({
      keyword,
      value
    })
  }

  function whileStmt(): ast.WhileStmt {
    consume(TokenType.LEFT_PAREN, "Expect '(' after 'while'.")
    const condition = expression()
    consume(TokenType.RIGHT_PAREN, "Expect ')' after loop condition.")

    const body = statement()
    return ast.whileStmt({
      expression: condition,
      body
    })
  }

  function forStmt(): ast.Stmt {
    // This is desugared into initializer, while loop, and increment statements
    consume(TokenType.LEFT_PAREN, "Expect '(' after 'for'.")
    pushScope()

    let initializer: ast.Stmt | null = null
    if (match(TokenType.SEMICOLON)) {
      initializer = null
    } else if (match(TokenType.VAR)) {
      initializer = varDecl()
    } else {
      initializer = expressionStmt()
    }
    let condition: ast.Expr | null = null
    if (!check(TokenType.SEMICOLON)) {
      condition = expression()
    } else {
      condition = ast.literalExpr({
        value: true,
        type: ast.BoolType
      })
    }
    consume(TokenType.SEMICOLON, "Expect ';' after loop condition.")
    let increment: ast.Expr | null = null;
    if (!check(TokenType.RIGHT_PAREN)) {
      increment = expression();
    }
    consume(TokenType.RIGHT_PAREN, "Expect ')' after for clauses.");
    pushScope()
    let body: ast.Stmt = statement()
    const innerScope = popScope()
    const outerScope = popScope()

    const loop = ast.whileStmt({
      expression: condition,
      body: ast.blockStmt({
        statements: increment ? [body, ast.expressionStmt({ expression: increment })] : [body],
        scope: innerScope
      })
    })

    return ast.blockStmt({
      statements: initializer ? [initializer, loop] : [loop],
      scope: outerScope
    })
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
    let baseType: ast.Type | null = null
    if (match(TokenType.LEFT_BRACKET)) {
      const elementType = type()
      consume(TokenType.SEMICOLON, "Expect ';' in array type.")
      const length = consume(TokenType.NUMBER, "Expect array length specifier.").literal
      consume(TokenType.RIGHT_BRACKET, "Expect ']' after array type.")
      baseType = {
        category: ast.TypeCategory.ARRAY,
        elementType,
        length
      }
    } else if (match(TokenType.INT)) {
      baseType = ast.IntType
    } else if (match(TokenType.FLOAT)) {
      baseType = ast.FloatType
    } else if (match(TokenType.BYTE)) {
      baseType = ast.ByteType
    } else if (match(TokenType.BOOL)) {
      baseType = ast.BoolType
    }

    if (baseType !== null) {
      let outType: ast.Type = baseType
      while (match(TokenType.TILDE)) {
        if (ast.isValidElementType(outType)) {
          outType = {
            category: ast.TypeCategory.POINTER,
            elementType: outType
          }
        } else {
          throw parseError(`Invalid type specifier starting at '${peek().lexeme}'.`)
        }
      }
      return outType
    } else {
      throw parseError(`Invalid type specifier starting at '${peek().lexeme}'.`)
    }
  }

  function expression(): ast.Expr {
    return exprAssignment()
  }

  function exprAssignment(): ast.Expr {
    let expr = exprOr()
    if (match(TokenType.EQUAL)) {
      const operator = previous()
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR || expr.kind === ast.NodeKind.DEREF_EXPR) {
        return ast.assignExpr({
          operator,
          left: expr,
          right
        })
      }
      // No need to panic (throw error) and synchronize.
      // Report error; it's still valuable to continue parsing
      // the rest of whatever statement we're in to indicate
      // remaining syntax errors to the user.
      parseError("Invalid assignment target.")
    } else if (match(TokenType.PLUS_EQUAL)) {
      const combinedOperator = previous()
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR || expr.kind === ast.NodeKind.DEREF_EXPR) {
        return ast.assignExpr({
          operator: combinedOperator,
          left: expr,
          right: ast.binaryExpr({
            left: expr,
            operator: fakeToken(TokenType.PLUS, "+", combinedOperator),
            right
          })
        })
      }
      parseError("Invalid assignment target.")
    } else if (match(TokenType.MINUS_EQUAL)) {
      const combinedOperator = previous()
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR || expr.kind === ast.NodeKind.DEREF_EXPR) {
        return ast.assignExpr({
          operator: combinedOperator,
          left: expr,
          right: ast.binaryExpr({
            left: expr,
            operator: fakeToken(TokenType.MINUS, "-", combinedOperator),
            right
          })
        })
      }
      parseError("Invalid assignment target.")
    } else if (match(TokenType.STAR_EQUAL)) {
      const combinedOperator = previous()
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR || expr.kind === ast.NodeKind.DEREF_EXPR) {
        return ast.assignExpr({
          operator: combinedOperator,
          left: expr,
          right: ast.binaryExpr({
            left: expr,
            operator: fakeToken(TokenType.STAR, "*", combinedOperator),
            right
          })
        })
      }
      parseError("Invalid assignment target.")
    } else if (match(TokenType.SLASH_EQUAL)) {
      const combinedOperator = previous()
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR || expr.kind === ast.NodeKind.DEREF_EXPR) {
        return ast.assignExpr({
          operator: combinedOperator,
          left: expr,
          right: ast.binaryExpr({
            left: expr,
            operator: fakeToken(TokenType.SLASH, "/", combinedOperator),
            right
          })
        })
      }
      parseError("Invalid assignment target.")
    } else if (match(TokenType.PERCENT_EQUAL)) {
      const combinedOperator = previous()
      const right = exprAssignment()
      if (expr.kind === ast.NodeKind.VARIABLE_EXPR || expr.kind === ast.NodeKind.INDEX_EXPR || expr.kind === ast.NodeKind.DEREF_EXPR) {
        return ast.assignExpr({
          operator: combinedOperator,
          left: expr,
          right: ast.binaryExpr({
            left: expr,
            operator: fakeToken(TokenType.PERCENT, "%", combinedOperator),
            right
          })
        })
      }
      parseError("Invalid assignment target.")
    }
    return expr
  }

  function exprOr(): ast.Expr {
    let expr = exprAnd()
    while (match(TokenType.BAR_BAR)) {
      const operator = previous()
      const right = exprAnd()
      expr = ast.logicalExpr({
        left: expr,
        operator,
        right
      })
    }
    return expr
  }

  function exprAnd(): ast.Expr {
    let expr = exprEquality()
    while (match(TokenType.AMP_AMP)) {
      const operator = previous()
      const right = exprEquality()
      expr = ast.logicalExpr({
        left: expr,
        operator,
        right
      })
    }
    return expr
  }

  function exprEquality(): ast.Expr {
    let expr = exprComparison()
    while (match(TokenType.EQUAL_EQUAL) || match(TokenType.BANG_EQUAL)) {
      const operator = previous()
      const right = exprComparison()
      expr = ast.binaryExpr({
        left: expr,
        operator,
        right
      })
    }
    return expr
  }

  function exprComparison(): ast.Expr {
    let expr = exprTerm()
    while (match(TokenType.GREATER) || match(TokenType.GREATER_EQUAL) || match(TokenType.LESS) || match(TokenType.LESS_EQUAL)) {
      const operator = previous()
      const right = exprTerm()
      expr = ast.binaryExpr({
        left: expr,
        operator,
        right
      })
    }
    return expr
  }

  function exprTerm(): ast.Expr {
    let expr = exprFactor()
    while (match(TokenType.MINUS) || match(TokenType.PLUS)) {
      const operator = previous()
      const right = exprFactor()
      expr = ast.binaryExpr({
        left: expr,
        operator,
        right
      })
    }
    return expr
  }

  function exprFactor(): ast.Expr {
    let expr = exprUnary()
    while (match(TokenType.SLASH) || match(TokenType.STAR) || match(TokenType.PERCENT)) {
      const operator = previous()
      const right = exprUnary()
      expr = ast.binaryExpr({
        left: expr,
        operator,
        right
      })
    }
    return expr
  }

  function exprUnary(): ast.Expr {
    if (match(TokenType.BANG) || match(TokenType.MINUS) || match(TokenType.AMP)) {
      const operator = previous()
      const value = exprUnary()
      return ast.unaryExpr({
        operator,
        value
      })
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
      expr = ast.callExpr({
        callee: expr,
        paren,
        args
      })
    }
    // can have any number of indexes or pointer dereferences
    while (match(TokenType.LEFT_BRACKET) || match(TokenType.TILDE)) {
      const operator = previous()
      switch (operator.lexeme) {
        case "[": {
          const index = expression()
          consume(TokenType.RIGHT_BRACKET, "Expect ']' after index.")
          expr = ast.indexExpr({
            callee: expr,
            bracket: operator,
            index
          })
          break
        }
        case "~": {
          expr = ast.derefExpr({
            operator,
            value: expr
          })
          break
        }
        default: {
          throw new Error("Unhandled operator in call group")
        }
      }
    }
    return expr
  }

  function exprPrimary(): ast.Expr {
    if (match(TokenType.TRUE) || match(TokenType.FALSE)) {
      return ast.literalExpr({
        value: previous().type === TokenType.TRUE ? true : false,
        type: ast.BoolType
      })
    }
    if (match(TokenType.NUMBER)) {
      return ast.literalExpr({
        value: previous().literal,
        type: ast.IntType
      })
    }
    if (match(TokenType.NUMBER_DECIMAL)) {
      return ast.literalExpr({
        value: previous().literal,
        type: ast.FloatType
      })
    }
    if (match(TokenType.NUMBER_HEX)) {
      return ast.literalExpr({
        value: previous().literal,
        type: ast.IntType
      })
    }
    if (match(TokenType.STRING)) {
      // TODO fixme
      throw parseError("Strings not yet supported")
    }
    if (match(TokenType.SINGLE_QUOTE_STRING)) {
      const c = previous().literal
      if (c.length !== 1) {
        throw parseError("Invalid character literal (use double quotes for strings).")
      } else if (!codec.isValidASCII(c)) {
        throw parseError("Invalid character literal (only ASCII characters allowed).")
      }
      return ast.literalExpr({
        value: codec.encodeASCIIChar(c),
        type: ast.ByteType
      })
    }
    if (match(TokenType.IDENTIFIER)) {
      return ast.variableExpr({
        name: previous()
      })
    }
    if (match(TokenType.LEFT_PAREN)) {
      const expr = expression()
      consume(TokenType.RIGHT_PAREN, "Expect ')' matching '('.")
      return ast.groupExpr({
        expression: expr
      })
    }
    if (match(TokenType.LEFT_BRACKET)) {
      const bracket = previous()
      const values: ast.Expr[] = []
      if (!check(TokenType.RIGHT_BRACKET)) {
        // disambiguate between [x; N] and [x, y, z] literals
        const value = expression()
        if (match(TokenType.SEMICOLON)) {
          const length = consume(TokenType.NUMBER, "Expect length specifier in array repeat literal.").literal as number
          if (length < 0) {
            throw parseError("Array length specifier must be >=0.")
          }
          consume(TokenType.RIGHT_BRACKET, "Expect ']' after list literal.")
          return ast.repeatExpr({
            bracket,
            value,
            length
          })
        }
        values.push(value)
        while (!check(TokenType.RIGHT_BRACKET) && !isAtEnd()) {
          if (values.length > 0) {
            consume(TokenType.COMMA, "Expect ',' between items in list literal.")
          }
          const val = expression()
          values.push(val)
        }
      }
      consume(TokenType.RIGHT_BRACKET, "Expect ']' after list literal.")
      return ast.listExpr({ bracket, values })
    }

    if (check(TokenType.INT) || check(TokenType.FLOAT) || check(TokenType.BYTE) || check(TokenType.BOOL)) {
      // cast expression
      // TODO: allow pointers to arrays
      const castType = type()
      switch (castType.category) {
        case ast.TypeCategory.INT:
        case ast.TypeCategory.FLOAT:
        case ast.TypeCategory.BYTE:
        case ast.TypeCategory.BOOL:
        case ast.TypeCategory.POINTER: {
          break
        }
        default: {
          throw parseError("Cannot cast to this type.")
        }
      }
      consume(TokenType.LEFT_PAREN, "Expect '(' after type in cast expression.")
      const paren = previous()
      const value = expression()
      consume(TokenType.RIGHT_PAREN, "Expect ')' after cast expression.")
      return ast.castExpr({
        token: paren,
        type: castType,
        value
      })
    }

    if (match(TokenType.LEN)) {
      consume(TokenType.LEFT_PAREN, "Expect '(' before len expression.")
      const value = expression()
      consume(TokenType.RIGHT_PAREN, "Expect ')' after len expression.")
      return ast.lenExpr({ value })
    }

    throw parseError("Expect expression.")
  }

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

  return context
}

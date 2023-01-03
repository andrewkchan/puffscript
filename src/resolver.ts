import { ReportError, assertUnreachable } from './util'
import * as ast from './nodes'
import { Token } from './scanner'
import { TokenType } from './tokens'

class ResolveError extends Error {}

function fakeToken(type: TokenType, lexeme: string): Token {
  return new Token(type, lexeme, null, 0, "")
}

// 1. Resolve AST types and type check all expressions + initializers
// 2. Determine dependencies of global symbols
// 3. Match `return` statements to enclosing functions
// 4. Check arity of function calls
// 5. Ensure no cyclic variable declarations
export function resolve(context: ast.Context, reportError: ReportError) {
  const global = context.global
  let scopes = [global]
  function peekScope(): ast.Scope {
    return scopes[scopes.length - 1]
  }
  function pushScope(scope: ast.Scope) {
    scopes.push(scope)
  }
  function popScope(): ast.Scope {
    return scopes.pop()!
  }

  let functionStack: ast.FunctionStmt[] = []
  function peekFunction(): ast.FunctionStmt | null {
    return functionStack.length > 0 ? functionStack[functionStack.length - 1] : null
  }
  function pushFunction(fn: ast.FunctionStmt) {
    functionStack.push(fn)
  }
  function popFunction(): ast.FunctionStmt {
    return functionStack.pop()!
  }

  let loopStack: ast.WhileStmt[] = []
  function peekLoop(): ast.WhileStmt | null {
    return loopStack.length > 0 ? loopStack[loopStack.length - 1] : null
  }
  function pushLoop(loop: ast.WhileStmt) {
    loopStack.push(loop)
  }
  function popLoop(): ast.WhileStmt {
    return loopStack.pop()!
  }

  // Keeps track of all AST nodes (including from non-tree dependency edges)
  // walked starting from a top-level statement.
  //
  // Currently used only for symbol cycle detection.
  const walkedSet: Set<ast.Node> = new Set();
  const walked: ast.Node[] = []
  function preVisit(node: ast.Node) {
    walkedSet.add(node)
    walked.push(node)
  }
  function postVisit(node: ast.Node) {
    if (node.kind === ast.NodeKind.VAR_STMT) {
      const isGlobal = scopes.length === 1
      if (isGlobal) {
        globalInitOrder.push(node as ast.VarStmt)
      }
    }
    walkedSet.delete(node)
    walked.pop()
  }

  const visited: Set<ast.Node> = new Set();
  const globalInitOrder: ast.VarStmt[] = []

  function resolveError(token: Token, msg: string): ResolveError {
    reportError(token.line(), msg)
    return new ResolveError(msg)
  }

  // Resolve `node` while attempting to coerce it to `type`.
  // If coercion is possible, returns `node` wrapped in a cast expression if needed.
  // If coercion is not possible, reports an error at `token` and returns `node`.
  function resolveNodeWithCoercion(node: ast.Expr, isLiveAtEnd: boolean, type: ast.Type, token: Token): ast.Expr {
    let out = node
    resolveNode(node, isLiveAtEnd)
    if (!ast.isEqual(node.resolvedType!, type)) {
      if (ast.canCoerce(node.resolvedType!, type) || (node.kind === ast.NodeKind.LITERAL_EXPR && ast.canCoerceNumberLiteral(node.value, type))) {
        out = ast.castExpr({
          token: fakeToken(TokenType.EOF, ""),
          type,
          value: node
        })
        resolveNode(out, isLiveAtEnd)
      } else {
        resolveError(token, `Cannot implicitly convert operand to '${ast.typeToString(type)}'.`)
      }
    }
    return out
  }

  function resolveNode(node: ast.Node, isLiveAtEnd: boolean): void {
    if (visited.has(node)) {
      return
    }
    visited.add(node)
    preVisit(node)
    switch (node.kind) {
      // expressions
      //
      // Note only expressions have `resolvedType`
      case ast.NodeKind.ASSIGN_EXPR: {
        const op = node as ast.AssignExpr
        resolveNode(op.left, isLiveAtEnd)
        op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, op.left.resolvedType!, op.operator)
        op.resolvedType = op.left.resolvedType
        break
      }
      case ast.NodeKind.BINARY_EXPR: {
        const op = node as ast.BinaryExpr
        resolveNode(op.left, isLiveAtEnd)
        resolveNode(op.right, isLiveAtEnd)
        switch (op.operator.lexeme) {
          case "<":
          case "<=":
          case ">":
          case ">=": {
            const lct = ast.getLowestCommonNumeric(op.left.resolvedType!, op.right.resolvedType!)
            if (lct) {
              op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator)
              op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator)
            } else {
              resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`)
            }
            op.resolvedType = ast.BoolType
            break
          }
          case "!=":
          case "==": {
            const lct = ast.getLowestCommonNumeric(op.left.resolvedType!, op.right.resolvedType!)
            if (lct) {
              op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator)
              op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator)
            } else if (!ast.isEqual(op.left.resolvedType!, op.right.resolvedType!)) {
              const leftTypeStr = ast.typeToString(op.left.resolvedType!)
              const rightTypeStr = ast.typeToString(op.right.resolvedType!)
              resolveError(op.operator, `Cannot compare ${leftTypeStr} to ${rightTypeStr}.`)
            }
            op.resolvedType = ast.BoolType
            break
          }
          case "%": {
            const lct = ast.getLowestCommonNumeric(op.left.resolvedType!, op.right.resolvedType!)
            if (lct && (ast.isEqual(lct, ast.IntType) || ast.isEqual(lct, ast.ByteType))) {
              op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator)
              op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator)
            } else {
              resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`)
            }
            op.resolvedType = op.left.resolvedType!
            break
          }
          case "+":
          case "-":
          case "*":
          case "/": {
            const leftType = op.left.resolvedType!
            const rightType = op.right.resolvedType!
            const lct = ast.getLowestCommonNumeric(leftType, rightType)
            if (lct) {
              op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator)
              op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator)
              op.resolvedType = lct
            } else if (op.operator.lexeme === '+' || op.operator.lexeme === '-') {
              // Rules for pointer arithmetic:
              // 1. Only allowed between a pointer and a numeric. Operating on 2 pointers is not allowed.
              // 2. (numeric + pointer) and (pointer + numeric) are both allowed.
              // 3. (pointer - numeric) is allowed, (numeric - pointer) is not allowed.
              if (leftType.category === ast.TypeCategory.POINTER && ast.isNumeric(rightType)) {
                op.right = ast.binaryExpr({
                  left: ast.literalExpr({
                    value: ast.sizeof(leftType.elementType),
                    type: ast.IntType
                  }),
                  right: resolveNodeWithCoercion(op.right, isLiveAtEnd, ast.IntType, op.operator),
                  operator: fakeToken(TokenType.STAR, "*")
                })
                resolveNode(op.right, isLiveAtEnd)
                op.resolvedType = leftType
              } else if (rightType.category === ast.TypeCategory.POINTER && ast.isNumeric(leftType) && op.operator.lexeme === '+') {
                op.left = ast.binaryExpr({
                  left: ast.literalExpr({
                    value: ast.sizeof(rightType.elementType),
                    type: ast.IntType
                  }),
                  right: resolveNodeWithCoercion(op.left, isLiveAtEnd, ast.IntType, op.operator),
                  operator: fakeToken(TokenType.STAR, "*")
                })
                resolveNode(op.left, isLiveAtEnd)
                op.resolvedType = rightType
              } else {
                resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`)
                op.resolvedType = ast.ErrorType
              }
            } else {
              if (!ast.isEqual(leftType, ast.ErrorType) && !ast.isEqual(rightType, ast.ErrorType)) {
                resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`)
              }
              op.resolvedType = ast.ErrorType
            }
            break
          }
          default: {
            throw new Error(`unreachable`)
          }
        }
        break
      }
      case ast.NodeKind.CALL_EXPR: {
        const op = node as ast.CallExpr
        resolveNode(op.callee, isLiveAtEnd)
        // If we ever add first-class functions, this should instead
        // check resolvedType of callee is "Function" type
        if (op.callee.kind !== ast.NodeKind.VARIABLE_EXPR) {
          resolveError(op.paren, `Cannot call this type.`)
        } else {
          const callee = op.callee as ast.VariableExpr
          const symbol = callee.resolvedSymbol
          if (!symbol) {
            // We already reported 'Undefined symbol' error earlier when resolving the callee VariableExpr
          } else if (symbol.kind !== ast.SymbolKind.FUNCTION) {
            resolveError(callee.name, `Cannot call this type.`)
          } else {
            const fn = symbol as ast.FunctionSymbol
            // Check arity and types of arguments
            if (op.args.length !== fn.node.params.length) {
              resolveError(op.paren, `Expected ${fn.node.params.length} arguments but got ${op.args.length} in call to ${fn.node.name.lexeme}.`)
            } else {
              for (let i = 0; i < op.args.length; i++) {
                const param = fn.node.params[i]
                op.args[i] = resolveNodeWithCoercion(op.args[i], isLiveAtEnd, param.type, op.paren)
                const arg = op.args[i]
              }
            }
            op.resolvedType = fn.node.returnType
          }
        }
        op.resolvedType = op.resolvedType ?? ast.ErrorType
        break
      }
      case ast.NodeKind.CAST_EXPR: {
        const op = node as ast.CastExpr
        resolveNode(op.value, isLiveAtEnd)
        if (!ast.canCast(op.value.resolvedType!, op.type)) {
          resolveError(op.token, `Cannot cast from ${ast.typeToString(op.value.resolvedType!)} to ${ast.typeToString(op.type)}.`)
        }
        op.resolvedType = op.type
        break
      }
      case ast.NodeKind.DEREF_EXPR: {
        const op = node as ast.DerefExpr
        resolveNode(op.value, isLiveAtEnd)
        if (op.value.resolvedType?.category === ast.TypeCategory.POINTER) {
          op.resolvedType = op.value.resolvedType.elementType
        } else {
          if (op.value.resolvedType?.category !== ast.TypeCategory.ERROR) {
            resolveError(op.operator, `Invalid operand for dereferencing operator '~'.`)
          }
          op.resolvedType = ast.ErrorType
        }
        break
      }
      case ast.NodeKind.GROUP_EXPR: {
        const op = node as ast.GroupExpr
        resolveNode(op.expression, isLiveAtEnd)
        op.resolvedType = op.expression.resolvedType
        break
      }
      case ast.NodeKind.INDEX_EXPR: {
        const op = node as ast.IndexExpr
        resolveNode(op.callee, isLiveAtEnd)
        resolveNode(op.index, isLiveAtEnd)
        if (op.callee.resolvedType!.category !== ast.TypeCategory.ARRAY) {
          resolveError(op.bracket, `Index operator requires array type.`)
          op.resolvedType = ast.ErrorType
        } else {
          const arrayType = op.callee.resolvedType! as ast.ArrayType
          switch (op.index.resolvedType!) {
            case ast.IntType:
            case ast.ByteType: {
              op.resolvedType = arrayType.elementType
              break
            }
            default: {
              resolveError(op.bracket, `Index operator requires int or byte type.`)
              op.resolvedType = arrayType.elementType
              break
            }
          }
        }
        break
      }
      case ast.NodeKind.LEN_EXPR: {
        const op = node as ast.LenExpr
        resolveNode(op.value, isLiveAtEnd)
        if (op.value.resolvedType?.category === ast.TypeCategory.ARRAY) {
          op.resolvedLength = op.value.resolvedType.length
        } else {
          op.resolvedLength = 0
        }
        break
      }
      case ast.NodeKind.LIST_EXPR: {
        const op = node as ast.ListExpr
        const initializer = op.initializer
        let elementType: ast.Type | null = null
        if (initializer.kind === ast.ListKind.LIST) {
          if (initializer.values.length > 0) {
            resolveNode(initializer.values[0], isLiveAtEnd)
            elementType = initializer.values[0].resolvedType!
            for (let i = 1; i < initializer.values.length; i++) {
              resolveNode(initializer.values[i], isLiveAtEnd)
              if (!ast.isEqual(initializer.values[i].resolvedType!, elementType)) {
                elementType = null
                break
              }
            }
          }
          // Note resolving an empty array will always throw a resolve error
          // even if a type specifier for e.g. declaration or return value
          // is given. Callers should not resolve the literal in that case.
          if (elementType && ast.isValidElementType(elementType)) {
            op.resolvedType = ast.arrayType(elementType, initializer.values.length)
          } else {
            if (initializer.values.length === 0) {
              resolveError(op.bracket, "Zero-length arrays are not allowed.")
            } else {
              resolveError(op.bracket, "Cannot infer type for literal.")
            }
            op.resolvedType = ast.ErrorType
          }
        } else {
          resolveNode(initializer.value, isLiveAtEnd)
          if (initializer.length === 0) {
            resolveError(op.bracket, "Zero-length arrays are not allowed.")
            op.resolvedType = ast.ErrorType
          } else if (!ast.isValidElementType(initializer.value.resolvedType!)) {
            resolveError(op.bracket, "Cannot infer type for literal.")
            op.resolvedType = ast.ErrorType
          } else {
            op.resolvedType = ast.arrayType(initializer.value.resolvedType!, initializer.length)
          }
        }
        break
      }
      case ast.NodeKind.LITERAL_EXPR: {
        const op = node as ast.LiteralExpr
        op.resolvedType = op.type
        break
      }
      case ast.NodeKind.LOGICAL_EXPR: {
        const op = node as ast.LogicalExpr
        switch (op.operator.lexeme) {
          case "&&":
          case "||": {
            op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, ast.BoolType, op.operator)
            op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, ast.BoolType, op.operator)
            op.resolvedType = ast.BoolType
            break
          }
          default: {
            throw new Error(`unreachable`)
          }
        }
        break
      }
      case ast.NodeKind.UNARY_EXPR: {
        const op = node as ast.UnaryExpr
        switch (op.operator.lexeme) {
          case "!": {
            op.value = resolveNodeWithCoercion(op.value, isLiveAtEnd, ast.BoolType, op.operator)
            op.resolvedType = ast.BoolType
            break
          }
          case "-": {
            resolveNode(op.value, isLiveAtEnd)
            if (!ast.isNumeric(op.value.resolvedType!)) {
              resolveError(op.operator, `Invalid operand type for unary operator '-'.`)
              op.resolvedType = ast.IntType
            } else {
              if (ast.isEqual(op.value.resolvedType!, ast.ByteType)) {
                op.value = resolveNodeWithCoercion(op.value, isLiveAtEnd, ast.IntType, op.operator)
              }
              op.resolvedType = op.value.resolvedType
            }
            break
          }
          case "&": {
            resolveNode(op.value, isLiveAtEnd)
            if (ast.isValidElementType(op.value.resolvedType!)) {
              if (op.value.kind === ast.NodeKind.VARIABLE_EXPR) {
                const symbol = op.value.resolvedSymbol
                if (symbol?.kind === ast.SymbolKind.PARAM || symbol?.kind === ast.SymbolKind.VARIABLE) {
                  symbol.isAddressTaken = true
                }
                op.resolvedType = {
                  category: ast.TypeCategory.POINTER,
                  elementType: op.value.resolvedType!
                }
              } else if (op.value.kind === ast.NodeKind.INDEX_EXPR) {
                op.resolvedType = {
                  category: ast.TypeCategory.POINTER,
                  elementType: op.value.resolvedType!
                }
              }
            }

            if (op.resolvedType === null) {
              resolveError(op.operator, `Invalid operand for unary operator '&'.`)
              op.resolvedType = ast.ErrorType
            }
            break
          }
          default: {
            throw new Error(`unreachable`)
          }
        }
        break
      }
      case ast.NodeKind.VARIABLE_EXPR: {
        const op = node as ast.VariableExpr
        const symbol = peekScope().lookup(op.name.lexeme, (sym) => {
          if (sym.kind === ast.SymbolKind.PARAM) {
            return true
          } else if (sym.kind === ast.SymbolKind.FUNCTION) {
            return true
          } else {
            const varSym = sym as ast.VariableSymbol
            return visited.has(varSym.node) || varSym.isGlobal
          }
        })
        if (symbol === null) {
          resolveError(op.name, `Undefined symbol '${op.name.lexeme}'.`)
          op.resolvedType = ast.ErrorType
        } else {
          op.resolvedSymbol = symbol
          let resolveTypeFromSymbol = true

          const fnSymbol = symbol?.kind === ast.SymbolKind.FUNCTION ? symbol as ast.FunctionSymbol : null
          const varSymbol = symbol?.kind === ast.SymbolKind.VARIABLE ? symbol as ast.VariableSymbol : null
          const symbolDecl = fnSymbol?.node ?? varSymbol?.node

          if (symbolDecl && !visited.has(symbolDecl)) {
            // Globals can be declared and used out-of-order.
            const isGlobal = fnSymbol !== null || (varSymbol !== null && varSymbol.isGlobal)
            // `lookup` should've filtered out un-visited locals
            console.assert(isGlobal)
            // Resolve the out-of-order global declaration. This is needed to:
            // 1. Resolve type of this variable expression.
            // 2. Detect cyclic declarations in case this variable expression
            //    is part of a global's initializer.
            const oldScopes = scopes
            const oldFunctionStack = functionStack
            // Reset stacks since we're following non-tree edge back to top-level
            scopes = [global]
            functionStack = []
            resolveNode(symbolDecl!, true)
            scopes = oldScopes
            functionStack = oldFunctionStack
          } else if (symbolDecl && walkedSet.has(symbolDecl)) {
            // Detect cyclic variable declarations (declarations using this variable expr in initializer).
            // Note `symbolDecl` may not be the cylic variable in the following case:
            // V1 -----> F1 -----> V2
            //            ^        |
            //            +--------+
            // If we start at `V1`, we will detect a cycle at `F1`. To find
            // the cyclic variable declaration, backtrack in `visitedStack`
            // and return any variable symbol between the top and `symbolDecl`.
            let cyclicVar: ast.VarStmt | null = null
            if (symbolDecl.kind === ast.NodeKind.VAR_STMT) {
              cyclicVar = symbolDecl
            } else {
              for (let i = walked.length - 1; walked[i] !== symbolDecl; i--) {
                if (walked[i].kind === ast.NodeKind.VAR_STMT) {
                  cyclicVar = walked[i] as ast.VarStmt
                  break
                }
              }
            }
            if (cyclicVar !== null) {
              resolveError(cyclicVar.name, `Declaration of '${cyclicVar.name.lexeme}' is cyclic. Defined here:\n${cyclicVar.name.lineStr()}`)
              op.resolvedType = ast.ErrorType
              resolveTypeFromSymbol = false
            }
          }
          if (resolveTypeFromSymbol) {
            switch (symbol.kind) {
              case ast.SymbolKind.FUNCTION: {
                // TODO: Either make `CallExpr` only use names and not sub-expressions, or add a function type
                op.resolvedType = ast.VoidType
                break
              }
              case ast.SymbolKind.PARAM: {
                op.resolvedType = (symbol as ast.ParamSymbol).param.type
                break
              }
              case ast.SymbolKind.VARIABLE: {
                const varSymbol = symbol as ast.VariableSymbol
                // We should've filled this in after resolving the declaration
                console.assert(varSymbol.node.type !== null)
                op.resolvedType = varSymbol.node.type
                break
              }
            }
          }
        }
        break
      }

      // statements
      //
      // Note only statements have `isLiveAtEnd`
      case ast.NodeKind.BLOCK_STMT: {
        const op = node as ast.BlockStmt
        pushScope(op.scope)
        if (op.statements.length > 0) {
          let prevIsLiveAtEnd = isLiveAtEnd
          for (let i = 0; i < op.statements.length; i++) {
            resolveNode(op.statements[i], prevIsLiveAtEnd)
            prevIsLiveAtEnd = !!op.statements[i].isLiveAtEnd
          }
          op.isLiveAtEnd = op.statements[op.statements.length - 1].isLiveAtEnd
        } else {
          op.isLiveAtEnd = isLiveAtEnd
        }
        popScope()
        break
      }
      case ast.NodeKind.EXPRESSION_STMT: {
        const op = node as ast.ExpressionStmt
        resolveNode(op.expression, isLiveAtEnd)
        op.isLiveAtEnd = isLiveAtEnd
        break
      }
      case ast.NodeKind.FUNCTION_STMT: {
        const op = node as ast.FunctionStmt

        pushScope(op.scope)
        pushFunction(op)
        // 1. Ensure all return statements match the return type of the function
        // 2. If the function has a return type, ensure all control paths return a value
        let missingReturn = false
        if (op.body.length > 0) {
          let prevIsLiveAtEnd = true // functions start as live
          for (let i = 0; i < op.body.length; i++) {
            resolveNode(op.body[i], prevIsLiveAtEnd)
            prevIsLiveAtEnd = !!op.body[i].isLiveAtEnd
          }
          if (op.body[op.body.length - 1].isLiveAtEnd) {
            if (!ast.isEqual(op.returnType, ast.VoidType)) {
              missingReturn = true
            }
          }
        } else if (!ast.isEqual(op.returnType, ast.VoidType)) {
          missingReturn = true
        }
        if (missingReturn) {
          resolveError(
            op.name,
            `All control paths for ${op.name.lexeme} must return a value of type '${ast.typeToString(op.returnType)}'.`
          )
        }
        popFunction()
        popScope()
        break
      }
      case ast.NodeKind.IF_STMT: {
        const op = node as ast.IfStmt
        resolveNode(op.expression, isLiveAtEnd)
        resolveNode(op.thenBranch, isLiveAtEnd)
        const isLiveAfterThen = !!op.thenBranch.isLiveAtEnd
        let isLiveAfterElse = isLiveAtEnd
        if (op.elseBranch !== null) {
          resolveNode(op.elseBranch, isLiveAtEnd)
          isLiveAfterElse = !!op.elseBranch.isLiveAtEnd
        }
        op.isLiveAtEnd = isLiveAfterThen || isLiveAfterElse
        break
      }
      case ast.NodeKind.LOOP_CONTROL_STMT: {
        const op = node as ast.LoopControlStmt
        if (peekLoop() === null) {
          resolveError(op.keyword, `Cannot ${op.keyword.lexeme} outside a loop.`)
        }
        // Control flow is considered live as long as we don't hit a "return".
        // This is not affected by breaks/continues.
        op.isLiveAtEnd = isLiveAtEnd
        break
      }
      case ast.NodeKind.PRINT_STMT: {
        const op = node as ast.PrintStmt
        resolveNode(op.expression, isLiveAtEnd)
        if (ast.isEqual(op.expression.resolvedType!, ast.VoidType)) {
          resolveError(op.keyword, `Cannot print value of type 'void'.`)
        }
        op.isLiveAtEnd = isLiveAtEnd
        break
      }
      case ast.NodeKind.RETURN_STMT: {
        const op = node as ast.ReturnStmt
        const inFunction = peekFunction()
        if (inFunction === null) {
          resolveError(op.keyword, `Cannot return from top-level code.`)
        } else if (op.value !== null) {
          const value = op.value
          resolveNode(value, isLiveAtEnd)
          console.assert(value.resolvedType !== null)
          if (!ast.isEqual(inFunction.returnType, value.resolvedType!)) {
            resolveError(op.keyword, `Expected a value of type '${ast.typeToString(inFunction.returnType)}'.`)
          }
        } else {
          if (!ast.isEqual(inFunction.returnType, ast.VoidType)) {
            resolveError(op.keyword, `Expected a value of type '${ast.typeToString(inFunction.returnType)}'.`)
          }
        }
        op.isLiveAtEnd = false
        break
      }
      case ast.NodeKind.VAR_STMT: {
        const op = node as ast.VarStmt
        resolveNode(op.initializer, isLiveAtEnd)
        if (op.initializer.resolvedType === null) {
          console.log(`${ast.astToSExpr(op)}`)
          throw new Error(`${ast.astToSExpr(op)}`)
        }
        if (op.type === null) {
          op.type = op.initializer.resolvedType!
        } else if (!ast.isEqual(op.type, op.initializer.resolvedType!) && !ast.isEqual(op.initializer.resolvedType!, ast.ErrorType)) {
          // TODO: allow implicit conversions when possible
          resolveError(
            op.name,
            `Cannot assign value of type '${ast.typeToString(op.initializer.resolvedType!)}' to variable of type '${ast.typeToString(op.type)}'.`
          )
        }
        const inFunction = peekFunction()
        if (inFunction && inFunction.scope !== peekScope() && op.symbol) {
          if (inFunction.hoistedLocals === null) {
            inFunction.hoistedLocals = new Set()
          }
          inFunction.hoistedLocals.add(op.symbol)
        }

        op.isLiveAtEnd = isLiveAtEnd
        break
      }
      case ast.NodeKind.WHILE_STMT: {
        const op = node as ast.WhileStmt
        resolveNode(op.expression, isLiveAtEnd)
        pushLoop(op)
        resolveNode(op.body, isLiveAtEnd)
        popLoop()
        if (op.increment) {
          // This is an expression statement and cannot affect op.isLiveAtEnd
          resolveNode(op.increment, isLiveAtEnd)
        }
        op.isLiveAtEnd = op.body.isLiveAtEnd
        break
      }

      default: {
        assertUnreachable(node.kind)
      }
    }
    postVisit(node)
  }

  context.topLevelStatements.forEach(stmt => {
    resolveNode(stmt, true)
  })
  context.globalInitOrder = globalInitOrder
}
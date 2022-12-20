import { ReportError } from './util'
import * as ast from './nodes'
import { Token } from './scanner'
import { Context } from './parser'

class ResolveError extends Error {}

// 1. Resolve AST types and type check all expressions + initializers
// 2. Determine dependencies of global symbols (TODO)
// 3. Match `return` statements to enclosing functions
// 4. Check arity of function calls
// 5. Ensure no cyclic variable declarations
export function resolve(context: Context, reportError: ReportError) {
  const global = context.global
  const scopes = [global]
  function peekScope(): ast.Scope {
    return scopes[scopes.length - 1]
  }
  function pushScope(scope: ast.Scope) {
    scopes.push(scope)
  }
  function popScope(): ast.Scope {
    return scopes.pop()!
  }

  const functionStack: ast.FunctionStmt[] = []
  function peekFunction(): ast.FunctionStmt | null {
    return functionStack.length > 0 ? functionStack[functionStack.length - 1] : null
  }
  function pushFunction(fn: ast.FunctionStmt) {
    functionStack.push(fn)
  }
  function popFunction(): ast.FunctionStmt {
    return functionStack.pop()!
  }

  function resolveError(token: Token, msg: string): ResolveError {
    reportError(token.line(), msg)
    return new ResolveError(msg)
  }

  function resolveNode(node: ast.Node, isLiveAtEnd: boolean): void {
    switch (node.kind) {
      // expressions
      //
      // Note only expressions have `resolvedType`
      case ast.NodeKind.ASSIGN_EXPR: {
        const op = node as ast.AssignExpr
        resolveNode(op.left, isLiveAtEnd)
        resolveNode(op.right, isLiveAtEnd)
        // TODO: What if left index expr is for a temporary?
        if (!ast.isEqual(op.left.resolvedType!, op.right.resolvedType!)) {
          // TODO: allow implicit conversions when possible
          resolveError(op.operator, `Invalid operand types for assignment operator '${op.operator.lexeme}'.`)
        }
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
            // TODO: Automatic float conversion and promotion for byte to ints?
            const leftIsNumberType = [ast.IntType, ast.FloatType, ast.ByteType].some(t => ast.isEqual(t, op.left.resolvedType!))
            if (!leftIsNumberType || !ast.isEqual(op.left.resolvedType!, op.right.resolvedType!)) {
              resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`)
            }
            op.resolvedType = ast.BoolType
            break
          }
          case "!=":
          case "==": {
            // TODO: Automatic float conversion and promotion for byte to ints?
            if (!ast.isEqual(op.left.resolvedType!, op.right.resolvedType!)) {
              const leftTypeStr = ast.typeToString(op.left.resolvedType!)
              const rightTypeStr = ast.typeToString(op.right.resolvedType!)
              resolveError(op.operator, `Cannot compare ${leftTypeStr} to ${rightTypeStr}.`)
            }
            op.resolvedType = ast.BoolType
            break
          }
          case "+":
          case "-":
          case "*":
          case "/": {
            // TODO: Automatic float conversion and promotion for byte to ints?
            const leftIsNumberType = [ast.IntType, ast.FloatType, ast.ByteType].some(t => ast.isEqual(t, op.left.resolvedType!))
            if (!leftIsNumberType || !ast.isEqual(op.left.resolvedType!, op.right.resolvedType!)) {
              resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`)
            }
            op.resolvedType = op.left.resolvedType!
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
          const symbol = peekScope().lookup(callee.name.lexeme)
          if (!symbol) {
            resolveError(callee.name, `Undefined symbol '${callee.name.lexeme}'.`)
          } else if (symbol.kind !== ast.SymbolKind.FUNCTION) {
            resolveError(callee.name, `Cannot call this type.`)
          } else {
            const fn = symbol as ast.FunctionSymbol
            // Check arity and types of arguments
            if (op.args.length !== fn.node.params.length) {
              resolveError(op.paren, `Expected ${fn.node.params.length} arguments but got ${op.args.length}.`)
            } else {
              for (let i = 0; i < op.args.length; i++) {
                const arg = op.args[i]
                const param = fn.node.params[i]
                resolveNode(arg, isLiveAtEnd)
                if (!ast.isEqual(arg.resolvedType!, param.type)) {
                  const paramTypeStr = ast.typeToString(param.type)
                  const argTypeStr = ast.typeToString(arg.resolvedType!)
                  resolveError(op.paren, `Expected type '${paramTypeStr}' but got '${argTypeStr}'.`)
                }
              }
            }
            op.resolvedType = fn.node.returnType
          }
        }
        op.resolvedType = op.resolvedType ?? ast.VoidType
        break
      }
      case ast.NodeKind.CAST_EXPR: {
        const op = node as ast.CastExpr
        resolveNode(op.value, isLiveAtEnd)
        op.resolvedType = op.type
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
          op.resolvedType = ast.VoidType
        } else {
          const arrayType = op.callee.resolvedType! as ast.ArrayType
          switch (op.index.resolvedType!) {
            case ast.IntType:
            case ast.ByteType: {
              op.resolvedType = arrayType.elementType
            }
            default: {
              resolveError(op.bracket, `Index operator requires int or byte type.`)
              op.resolvedType = arrayType.elementType
            }
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
        resolveNode(op.left, isLiveAtEnd)
        resolveNode(op.right, isLiveAtEnd)
        switch (op.operator.lexeme) {
          case "&&":
          case "||": {
            // TODO: Allow implicit conversion to bool
            if (!ast.isEqual(op.left.resolvedType!, ast.BoolType) || !ast.isEqual(op.right.resolvedType!, ast.BoolType)) {
              resolveError(op.operator, `Logical operator '${op.operator.lexeme}' requires bool operands.`)
            }
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
        resolveNode(op.right, isLiveAtEnd)
        switch (op.operator.lexeme) {
          case "!": {
            if (op.right.resolvedType !== ast.BoolType) {
              // TODO: Allow implicit conversion to bool
              resolveError(op.operator, `Unary operator '!' requires bool operand.`)
            }
            op.resolvedType = ast.BoolType
            break
          }
          case "-": {
            if (op.right.resolvedType !== ast.IntType && op.right.resolvedType !== ast.FloatType) {
              // TODO: Allow implicit conversion of byte to int
              resolveError(op.operator, `Unary operator '-' requires int or float operand.`)
              op.resolvedType = ast.IntType
            } else {
              op.resolvedType = op.right.resolvedType
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
        const symbol = peekScope().lookup(op.name.lexeme)
        if (symbol === null) {
          resolveError(op.name, `Undefined variable '${op.name.lexeme}'.`)
          op.resolvedType = ast.VoidType
        } else if (symbol.state == ast.SymbolState.RESOLVING) {
          const varSymbol = symbol as ast.VariableSymbol
          // Handle cyclic declarations (declarations using this variable expr in initializer)
          resolveError(op.name, `Declaration of '${op.name.lexeme}' is cyclic. Defined here:\n${varSymbol.node.name.lineStr()}`)
          op.resolvedType = ast.VoidType
        } else {
          const varSymbol = symbol as ast.VariableSymbol
          // We should've filled this in after resolving the declaration
          console.assert(varSymbol.node.type !== null)
          op.resolvedType = varSymbol.node.type
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
        const symbol = peekScope().lookup(op.name.lexeme)! as ast.FunctionSymbol
        // No intermediate `resolving` state for functions to allow recursion
        symbol.state = ast.SymbolState.RESOLVED

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
            `All control paths for ${op.name.lexeme} must return a value of type "${ast.typeToString(op.returnType)}".`
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
        let isLiveAfterElse = false
        if (op.elseBranch !== null) {
          resolveNode(op.elseBranch, isLiveAtEnd)
          isLiveAfterElse = !!op.elseBranch.isLiveAtEnd
        }
        op.isLiveAtEnd = isLiveAfterThen || isLiveAfterElse
        break
      }
      case ast.NodeKind.PRINT_STMT: {
        const op = node as ast.PrintStmt
        resolveNode(op.expression, isLiveAtEnd)
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
            resolveError(op.keyword, `Expected a value of type "${ast.typeToString(inFunction.returnType)}".`)
          }
        } else {
          if (!ast.isEqual(inFunction.returnType, ast.VoidType)) {
            resolveError(op.keyword, `Expected a value of type "${ast.typeToString(inFunction.returnType)}".`)
          }
        }
        op.isLiveAtEnd = false
        break
      }
      case ast.NodeKind.VAR_STMT: {
        const op = node as ast.VarStmt
        const symbol = peekScope().lookup(op.name.lexeme)! as ast.VariableSymbol
        // Handle code like
        // ```
        // var a = "outer";
        // {
        //   var a = a; // --> error!
        // }
        // ```
        // by marking the inner symbol as "resolving" before 
        // resolving the initializer.
        symbol.state = ast.SymbolState.RESOLVING
        resolveNode(op.initializer, isLiveAtEnd)
        console.assert(op.initializer.resolvedType !== null)
        if (op.type === null) {
          op.type = op.initializer.resolvedType!
        } else if (!ast.isEqual(op.type, op.initializer.resolvedType!)) {
          // TODO: allow implicit conversions when possible
          resolveError(
            op.name, 
            `Cannot assign type ${ast.typeToString(op.type)} to type ${ast.typeToString(op.initializer.resolvedType!)}`
          )
        }
        symbol.state = ast.SymbolState.RESOLVED

        op.isLiveAtEnd = isLiveAtEnd
        break
      }
      case ast.NodeKind.WHILE_STMT: {
        const op = node as ast.WhileStmt
        resolveNode(op.expression, isLiveAtEnd)
        resolveNode(op.body, isLiveAtEnd)
        op.isLiveAtEnd = op.body.isLiveAtEnd
        break
      }
      
      default: {
        throw new Error(`unreachable`)
      }
    }
  }

  context.topLevelStatements.forEach(stmt => {
    resolveNode(stmt, true)
  })
}
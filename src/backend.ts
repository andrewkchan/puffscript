import * as ast from './nodes'

function wasmType(type: ast.Type): "i32" | "f32" {
  switch (type.category) {
    case ast.TypeCategory.BOOL:
    case ast.TypeCategory.BYTE:
    case ast.TypeCategory.INT: {
      return "i32"
    }
    case ast.TypeCategory.FLOAT: {
      return "f32"
    }
    default: {
      throw new Error(`Unhandled type ${ast.TypeCategory[type.category]} for WASM backend`)
    }
  }
}

function defaultForWasmType(type: "i32" | "f32"): string {
  return `${type}.const 0`
}

function wasmId(name: string, mangler?: number): string {
  let identifier = "$" + name
  if (mangler !== undefined) {
    identifier += "_" + mangler
  }
  return identifier
}

// Emits WAT code for the resolved context.
export function emit(context: ast.Context): string {

  const INDENT_UNIT = "  "
  let _indent = ""
  function indent() {
    _indent += INDENT_UNIT
  }
  function dedent() {
    _indent = _indent.substring(0, _indent.length - INDENT_UNIT.length)
  }

  let output = ""
  function emit(text: string) {
    output += text
  }
  function line(text: string) {
    emit(_indent + text + "\n")
  }

  const skip: Set<ast.Node> = new Set()

  let nextLabelID = 0

  function visit(node: ast.Node) {
    if (skip.has(node)) {
      return
    }

    switch (node.kind) {
      // expressions
      case ast.NodeKind.ASSIGN_EXPR: {
        const op = node as ast.AssignExpr
        // TODO: handle index expressions on LHS
        if (op.left.kind === ast.NodeKind.VARIABLE_EXPR) {
          const symbol = op.left.resolvedSymbol!
          visit(op.right)
          if (symbol?.kind === ast.SymbolKind.VARIABLE) {
            if (symbol.isGlobal) {
              line(`global.set ${wasmId(symbol.node.name.lexeme)}`)
            } else {
              line(`local.set ${wasmId(symbol.node.name.lexeme, symbol.id)}`)
            }
          } else if (symbol.kind === ast.SymbolKind.PARAM) {
            line(`local.set ${wasmId(symbol.param.name.lexeme, symbol.id)}`)
          } else {
            throw new Error("Bad symbol for assignment")
          }
        } else {
          throw new Error("Unhandled left operand for assignment")
        }
        break
      }
      case ast.NodeKind.BINARY_EXPR: {
        const op = node as ast.BinaryExpr
        visit(op.left)
        visit(op.right)
        switch (op.operator.lexeme) {
          case "<": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.lt`)
            } else if (ast.isEqual(op.left.resolvedType!, ast.ByteType)) {
              line(`i32.lt_u`)
            } else {
              line(`i32.lt_s`)
            }
            break
          }
          case "<=": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.le`)
            } else if (ast.isEqual(op.left.resolvedType!, ast.ByteType)) {
              line(`i32.le_u`)
            } else {
              line(`i32.le_s`)
            }
            break
          }
          case ">": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.gt`)
            } else if (ast.isEqual(op.left.resolvedType!, ast.ByteType)) {
              line(`i32.gt_u`)
            } else {
              line(`i32.gt_s`)
            }
            break
          }
          case ">=": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.ge`)
            } else if (ast.isEqual(op.left.resolvedType!, ast.ByteType)) {
              line(`i32.ge_u`)
            } else {
              line(`i32.ge_s`)
            }
            break
          }
          case "!=": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.ne`)
            } else {
              line(`i32.ne`)
            }
            break
          }
          case "==": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.eq`)
            } else {
              line(`i32.eq`)
            }
            break
          }
          case "+": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.add`)
            } else {
              line(`i32.add`)
            }
            break
          }
          case "-": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.sub`)
            } else {
              line(`i32.sub`)
            }
            break
          }
          case "*": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.mul`)
            } else {
              line(`i32.mul`)
            }
            break
          }
          case "/": {
            if (ast.isEqual(op.left.resolvedType!, ast.FloatType)) {
              line(`f32.div`)
            } else {
              // TODO: why not i32.div_u?
              line(`i32.div_s`)
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
        if (op.callee.kind === ast.NodeKind.VARIABLE_EXPR) {
          const symbol = (op.callee as ast.VariableExpr).resolvedSymbol
          if (symbol?.kind === ast.SymbolKind.FUNCTION) {
            op.args.forEach((arg) => {
              visit(arg)
            })
            line(`call ${wasmId(symbol.node.name.lexeme)}`)
          } else {
            throw new Error("Unexpected callee")  
          }
        } else {
          throw new Error("Unexpected callee")
        }
        break
      }
      case ast.NodeKind.CAST_EXPR: {
        const op = node as ast.CastExpr
        visit(op.value)
        switch (op.type.category) {
          case ast.TypeCategory.BOOL: {
            switch (op.value.resolvedType?.category) {
              case ast.TypeCategory.BOOL:
              case ast.TypeCategory.BYTE:
              case ast.TypeCategory.INT: {
                line(`i32.eqz`)
                line(`i32.eqz`)
                break
              }
              case ast.TypeCategory.FLOAT: {
                line(`f32.const 0`)
                line(`f32.ne`)
                break
              }
              default: {
                throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast source`)
              }
            }
            break
          }
          case ast.TypeCategory.BYTE: {
            switch (op.value.resolvedType?.category) {
              case ast.TypeCategory.BOOL:
              case ast.TypeCategory.BYTE:
              case ast.TypeCategory.INT: {
                // no conversions needed
                break
              }
              case ast.TypeCategory.FLOAT: {
                // convert from f32 to signed i32 rounding towards zero (.5 will be lost)
                // byte will interpret the 8 LSB as unsigned
                line(`i32.trunc_f32_s`)
                break
              }
              default: {
                throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast source`)
              }
            }
            break
          }
          case ast.TypeCategory.INT: {
            switch (op.value.resolvedType?.category) {
              case ast.TypeCategory.BOOL: 
              case ast.TypeCategory.BYTE: 
              case ast.TypeCategory.INT: {
                // no conversion needed as all are represented by i32
                break
              }
              case ast.TypeCategory.FLOAT: {
                // convert from f32 to signed i32 rounding towards zero (.5 will be lost)
                line(`i32.trunc_f32_s`)
                break
              }
              default: {
                throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast source`)
              }
            }
            break
          }
          case ast.TypeCategory.FLOAT: {
            switch (op.value.resolvedType?.category) {
              case ast.TypeCategory.BOOL: 
              case ast.TypeCategory.BYTE: 
              case ast.TypeCategory.INT: {
                line(`f32.convert_i32_s`)
                break
              }
              case ast.TypeCategory.FLOAT: {
                // no conversions needed
                break
              }
              default: {
                throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast source`)
              }
            }
            break
          }
          default: {
            throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast target`)
          }
        }
        break
      }
      case ast.NodeKind.GROUP_EXPR: {
        const op = node as ast.GroupExpr
        visit(op.expression)
        break
      }
      case ast.NodeKind.INDEX_EXPR: {
        // TODO implement me
        throw new Error("Array indexing is not yet supported")
        break
      }
      case ast.NodeKind.LITERAL_EXPR: {
        const op = node as ast.LiteralExpr
        switch (op.type.category) {
          case ast.TypeCategory.BOOL: {
            line(`i32.const ${op.value === true ? "1" : "0"}`)
            break
          }
          case ast.TypeCategory.BYTE:
          case ast.TypeCategory.INT: {
            line(`i32.const ${op.value}`)
            break
          }
          case ast.TypeCategory.FLOAT: {
            line(`f32.const ${op.value}`)
            break
          }
          default: {
            // TODO: handle strings and arrays
            throw new Error(`Unhandled literal type ${ast.typeToString(op.type)}`)
          }
        }
        break
      }
      case ast.NodeKind.LOGICAL_EXPR: {
        const op = node as ast.LogicalExpr
        // Can use bitwise equivalents assuming operands are bools (0 or 1)
        visit(op.left)
        visit(op.right)
        switch (op.operator.lexeme) {
          case "&&": {
            line(`i32.and`)
            break
          }
          case "||": {
            line(`i32.or`)
            break
          }
          default: {
            break
          }
        }
        break
      }
      case ast.NodeKind.UNARY_EXPR: {
        const op = node as ast.UnaryExpr
        switch (op.operator.lexeme) {
          case "!": {
            visit(op.right)
            line(`i32.eqz`)
            break
          }
          case "-": {
            line(`i32.const 0`)
            visit(op.right)
            line(`i32.sub`)
            break
          }
          default: {
            throw new Error("Unhandled unary operator")
          }
        }
        break
      }
      case ast.NodeKind.VARIABLE_EXPR: {
        const op = node as ast.VariableExpr
        const symbol = op.resolvedSymbol
        if (symbol) {
          if (symbol.kind === ast.SymbolKind.VARIABLE) {
            if (symbol.isGlobal) {
              line(`global.get ${wasmId(op.name.lexeme)}`)
            } else {
              line(`local.get ${wasmId(op.name.lexeme, symbol.id)}`)
            }
          } else if (symbol.kind === ast.SymbolKind.PARAM) {
            line(`local.get ${wasmId(op.name.lexeme, symbol.id)}`)
          } else {
            // We shouldn't be visiting variable expressions of function type.
            // Function calls emit their own code (see case for CALL_EXPR).
            console.assert(false)
          }
        } else {
          throw new Error("Unresolved symbol in variable expression")
        }
        break
      }

      // statements
      case ast.NodeKind.BLOCK_STMT: {
        const op = node as ast.BlockStmt
        op.statements.forEach((statement) => {
          visit(statement)
        })
        break
      }
      case ast.NodeKind.EXPRESSION_STMT: {
        const op = node as ast.ExpressionStmt
        // TODO: Do we need to discard evaluated result from stack?
        visit(op.expression)
        break
      }
      case ast.NodeKind.FUNCTION_STMT: {
        const op = node as ast.FunctionStmt
        if (op.name.lexeme === "main") {
          line(`(func ${wasmId("main")} (export "main")`)
        } else {
          line(`(func ${wasmId(op.name.lexeme)}`)
        }
        {
          indent()
          op.scope.forEach((name, local) => {
            if (local.kind === ast.SymbolKind.PARAM) {
              line(`(param ${wasmId(name, local.id)} ${wasmType(local.param.type)})`)
            }
          })
          if (!ast.isEqual(op.returnType, ast.VoidType)) {
            // TODO: handle array return type
            line(`(result ${wasmType(op.returnType)})`)
          }
          // WASM doesn't have block scope, and `func` definitions require all locals to be 
          // declared ahead-of-time, so we need to hoist all locals in descendant scopes
          // to the top, so:
          // ```
          // def foo() {
          //   var a = 1;
          //   // ...
          //   {
          //     var b = 1;
          //     // ...
          //   } 
          // }
          // ```
          // becomes
          // ```
          // (func $foo (local $a i32) (local $b i32)
          //   ;; ...
          // )
          // ```
          op.scope.forEach((name, local) => {
            if (local.kind === ast.SymbolKind.VARIABLE) {
              line(`(local ${wasmId(name, local.id)} ${wasmType(local.node.type!)})`)
            }
          })
          op.hoistedLocals?.forEach((local) => {
            const name = local.node.name.lexeme
            line(`(local ${wasmId(name, local.id)} ${wasmType(local.node.type!)})`)
          })
          op.body.forEach((statement) => {
            visit(statement)
          })
          dedent()
        }
        line(`)`)
        break
      }
      case ast.NodeKind.IF_STMT: {
        const op = node as ast.IfStmt
        visit(op.expression)
        line(`(if`)
        {
          indent()
          line(`(then`)
          {
            indent()
            visit(op.thenBranch)
            dedent()
          }
          line(`)`)
          if (op.elseBranch) {
            line(`(else`)
            {
              indent()
              visit(op.elseBranch)
              dedent()
            }
            line(`)`)
          }
          dedent()
        }
        line(`)`)
        break
      }
      case ast.NodeKind.PRINT_STMT: {
        const op = node as ast.PrintStmt
        visit(op.expression)
        switch (op.expression.resolvedType?.category) {
          case ast.TypeCategory.BYTE: {
            // mask 24 MSB before logging
            line(`i32.const 0x000000FF`)
            line(`i32.and`)
            line(`call ${wasmId("__log_i32__")}`)
            break
          }
          case ast.TypeCategory.BOOL:
          case ast.TypeCategory.INT: {
            line(`call ${wasmId("__log_i32__")}`)
            break
          }
          case ast.TypeCategory.FLOAT: {
            line(`call ${wasmId("__log_f32__")}`)
            break
          }
          default: {
            // TODO: Handle array types (esp. strings)
            throw new Error("Unexpected type for print")
          }
        }
        break
      }
      case ast.NodeKind.RETURN_STMT: {
        const op = node as ast.ReturnStmt
        if (op.value) {
          visit(op.value)
        }
        line(`return`)
        break
      }
      case ast.NodeKind.VAR_STMT: {
        const op = node as ast.VarStmt
        visit(op.initializer)
        // TODO: Handle array types
        if (op.symbol?.isGlobal) {
          line(`global.set ${wasmId(op.name.lexeme)}`)
        } else {
          line(`local.set ${wasmId(op.name.lexeme, op.symbol!.id)}`)
        }
        break
      }
      case ast.NodeKind.WHILE_STMT: {
        const op = node as ast.WhileStmt
        const outerLabel = wasmId(nextLabelID++ + "")
        const innerLabel = wasmId(nextLabelID++ + "")
        line(`(block ${outerLabel}`)
        {
          indent()
          line(`(loop ${innerLabel}`)
          {
            indent()
            visit(op.expression)
            line(`i32.eqz`)
            line(`br_if ${outerLabel}`)
            visit(op.body)
            line(`br ${innerLabel}`)
            dedent()
          }
          line(`)`)
          dedent()
        }
        line(`)`)
        break
      }
    }
  }

  line(`(module`)
  {
    indent()

    line(`(import "console" "log" (func ${wasmId("__log_i32__")} (param i32)))`)
    line(`(import "console" "log" (func ${wasmId("__log_f32__")} (param f32)))`)

    context.globalInitOrder?.forEach((varDecl) => {
      if (varDecl.type !== null) {
        const type = wasmType(varDecl.type)
        line(`(global ${wasmId(varDecl.name.lexeme)} (mut ${type}) ${defaultForWasmType(type)})`)
      }
    })
  
    line(`(func (export "__init_globals__")`)
    {
      indent()
      context.globalInitOrder?.forEach((varDecl) => {
        if (varDecl.type !== null) {
          visit(varDecl)
          skip.add(varDecl)
        }
      })
      dedent()
    }
    line(`)`)
  
    context.topLevelStatements.forEach((statement) => {
      visit(statement)
    })
  
    dedent()
  }
  line(`)`)

  return output
}
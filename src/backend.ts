import * as ast from './nodes'
import { assertUnreachable } from './util'

// The Puff "abstract machine", like C, has its own stack which
// is separate from the WASM stack and lives inside linear memory.
// "Locals" in WASM take the place of registers, and since
// WASM can have infinite locals, this means we have effectively
// infinite registers. So in Puffscript only variables which have
// their addresses taken (none right now since no pointers yet!)
// and structs/arrays need to go inside the in-memory stack.
//
// Like in C and most other models, Puff's stack grows downwards.
// The stack pointer is stored as $__stack_ptr__ WASM global.
const STACK_TOP_BYTE_OFFSET = 512*1024

enum ExprMode {
  LVALUE,
  RVALUE
}

// Returns the WASM type used to represent values of the given type in the WASM (host) stack.
// This may be different than the WASM type representing the value in the Puff (in-memory) stack.
// E.g. integer arrays are represented by sequences of i32 in the in-memory stack but only 
// represented by a single i32 address in the WASM stack.
function registerType(type: ast.Type): "i32" | "f32" {
  switch (type.category) {
    case ast.TypeCategory.ARRAY:
    case ast.TypeCategory.BOOL:
    case ast.TypeCategory.BYTE:
    case ast.TypeCategory.INT:
    case ast.TypeCategory.POINTER: {
      return "i32"
    }
    case ast.TypeCategory.FLOAT: {
      return "f32"
    }
    case ast.TypeCategory.VOID: {
      throw new Error(`Unhandled type ${ast.TypeCategory[type.category]} for WASM backend`)
    }
  }
}

function defaultForRegisterType(type: "i32" | "f32"): string {
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

  // Emit code to:
  // 1. push a value of the given type to the in-memory stack (+adjust __stack_ptr__)
  // 2. return the new stack ptr, which points to the pushed value
  // PRECOND: Address of value to push is top item of WASM stack.
  function emitPushMem(type: ast.Type) {
    emitAllocStackVal(type)
    // memcpy value to stack ptr
    line(`global.get ${wasmId("__stack_ptr__")}`)
    line(`i32.const ${ast.sizeof(type)}`)
    line(`call ${wasmId("__memcpy__")}`)
    // return stack ptr
    line(`global.get ${wasmId("__stack_ptr__")}`)
  }
  
  // Emit code to:
  // 1. push a scalar value of the given type to the in-memory stack (+adjust __stack_ptr__)
  // 2. return the new stack ptr, which points to the pushed value
  // PRECOND: Value is stored in the given local register.
  function emitPushScalar(type: ast.Type, local: string) {
    emitAllocStackVal(type)
    line(`global.get ${wasmId("__stack_ptr__")}`)
    line(`local.get ${wasmId(local)}`)
    emitStoreScalar(type)
    line(`global.get ${wasmId("__stack_ptr__")}`)
  }

  // Emit code to duplicate the value at the top of the stack.
  // PRECOND: inside a function.
  function emitDupTop(register: "i32" | "f32") {
    const teeRegister = "__tee_" + register + "__"
    line(`local.tee ${wasmId(teeRegister)}`)
    line(`local.get ${wasmId(teeRegister)}`)
  }

  // Emit code to store a scalar value to given address.
  // No return value.
  // PRECOND: stack contains 2 values:
  // - stack[n-1]: address to store at
  // - stack[n]: scalar value to store
  function emitStoreScalar(type: ast.Type) {
    switch (type.category) {
      case ast.TypeCategory.BOOL:
      case ast.TypeCategory.BYTE: {
        line(`i32.store8`)
        break
      }
      case ast.TypeCategory.FLOAT: {
        line(`f32.store`)
        break
      }
      case ast.TypeCategory.INT:
      case ast.TypeCategory.POINTER: {
        line(`i32.store`)
        break
      }
      default: {
        throw new Error(`Unhandled element type ${ast.typeToString(type)} for emitStoreScalar`)
      }
    }
  }

  // Emit code to load and return a scalar value from given address.
  // PRECOND: stack contains 1 value:
  // - stack[n]: address to load from
  function emitLoadScalar(type: ast.Type) {
    switch (type.category) {
      case ast.TypeCategory.BOOL:
      case ast.TypeCategory.BYTE: {
        line(`i32.load8_u`)
        break
      }
      case ast.TypeCategory.FLOAT: {
        line(`f32.load`)
        break
      }
      case ast.TypeCategory.INT:
      case ast.TypeCategory.POINTER: {
        line(`i32.load`)
        break
      }
      default: {
        throw new Error(`Unhandled type ${ast.typeToString(type)} for emitLoadScalar`)
      }
    }
  }

  // Emit code to grow stack by sizeof(type) and adjust __stack_ptr__.
  // No return value.
  function emitAllocStackVal(type: ast.Type) {
    line(`global.get ${wasmId("__stack_ptr__")}`)
    line(`i32.const ${ast.sizeof(type)}`)
    line(`i32.sub`)
    line(`global.set ${wasmId("__stack_ptr__")}`)
  }

  // Emit code to shrink stack by sizeof(type) and adjust __stack_ptr__.
  // No return value.
  function emitFreeStackVal(type: ast.Type) {
    line(`global.get ${wasmId("__stack_ptr__")}`)
    line(`i32.const ${ast.sizeof(type)}`)
    line(`i32.add`)
    line(`global.set ${wasmId("__stack_ptr__")}`)
  }

  function visit(node: ast.Node, exprMode: ExprMode = ExprMode.RVALUE) {
    if (skip.has(node)) {
      return
    }

    switch (node.kind) {
      // expressions
      case ast.NodeKind.ASSIGN_EXPR: {
        const op = node as ast.AssignExpr
        if (op.left.kind === ast.NodeKind.VARIABLE_EXPR) {
          const symbol = op.left.resolvedSymbol!
          visit(op.right)
          if (symbol?.kind === ast.SymbolKind.VARIABLE) {
            if (symbol.isGlobal) {
              emitDupTop(registerType(op.resolvedType!))
              line(`global.set ${wasmId(symbol.node.name.lexeme)}`)
            } else {
              line(`local.tee ${wasmId(symbol.node.name.lexeme, symbol.id)}`)
            }
          } else if (symbol.kind === ast.SymbolKind.PARAM) {
            line(`local.tee ${wasmId(symbol.param.name.lexeme, symbol.id)}`)
          } else {
            throw new Error("Bad symbol for assignment")
          }
        } else {
          // Assigning to an index expression, e.g. `(...)[i] = ...`
          const elementType = op.resolvedType!

          if (ast.isScalar(elementType)) {
            visit(op.left, ExprMode.LVALUE) // gets address of indexed element
            visit(op.right) // gets value

            const teeRegister = "__tee_" + registerType(op.resolvedType!) + "__"
            {
              line(`local.tee ${wasmId(teeRegister)}`) // for chained assignment
              emitStoreScalar(elementType)
              line(`local.get ${wasmId(teeRegister)}`)
            }
          } else {
            visit(op.right) // gets address of value
            visit(op.left, ExprMode.LVALUE) // gets address of indexed element

            const teeRegister = "__tee_" + registerType(op.resolvedType!) + "__"
            {
              line(`local.tee ${wasmId(teeRegister)}`) // for chained assignment
              line(`i32.const ${ast.sizeof(elementType)}`)
              line(`call ${wasmId("__memcpy__")}`)
  
              line(`local.get ${wasmId(teeRegister)}`)
            }
          }
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
              case ast.TypeCategory.BYTE: {
                // mask 24 MSB
                line(`i32.const 0x000000FF`)
                line(`i32.and`)
                break
              }
              case ast.TypeCategory.BOOL: 
              case ast.TypeCategory.INT: {
                // no conversion needed
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
        const op = node as ast.IndexExpr
        const elementType = op.resolvedType!
        visit(op.callee) // push address of array start
        visit(op.index) // push index
        // pop 2, push address of indexed element
        line(`i32.const ${ast.sizeof(elementType)}`)
        line(`i32.mul`)
        line(`i32.add`)
        if (exprMode === ExprMode.LVALUE) {
          // done; address of indexed element returned
        } else {
          // get value of indexed element
          if (ast.isScalar(elementType)) {
            emitLoadScalar(elementType)
          } else {
            emitPushMem(elementType)
          }
        }
        break
      }
      case ast.NodeKind.LEN_EXPR: {
        const op = node as ast.LenExpr
        line(`i32.const ${op.resolvedLength}`)
        break
      }
      case ast.NodeKind.LIST_EXPR: {
        // TODO: Maybe desugar this into index + assignment expressions before codegen step
        const op = node as ast.ListExpr
        const initializer = op.initializer
        const elementType = (op.resolvedType as ast.ArrayType).elementType
        if (initializer.kind === ast.ListKind.LIST) {
          if (ast.isScalar(elementType)) {
            for (const value of initializer.values) {
              emitAllocStackVal(elementType)
              // store item to sp
              line(`global.get ${wasmId("__stack_ptr__")}`)
              visit(value) // value to store
              emitStoreScalar(elementType)
            }
          } else {
            for (const value of initializer.values) {
              visit(value) // addr of value to store
              emitPushMem(elementType)
              line(`drop`)
            }
          }
        } else {
          if (ast.isScalar(elementType)) {
            visit(initializer.value) // returns value to store
            const teeRegister = `__tee_${registerType(elementType)}__`
            line(`local.set ${wasmId(teeRegister)}`)
            for (let i = 0; i < initializer.length; i++) {
              emitPushScalar(elementType, teeRegister) // returns mutated __stack_ptr__
              line(`drop`)
            }
          } else if (initializer.length > 0) {
            // Call repeat expression to create first array item
            // INVARIANT: Repeat expression pushes only the evaluation result (and nothing else) to stack
            visit(initializer.value) // pushes to stack and returns mutated __stack_ptr__
            for (let i = 1; i < initializer.length; i++) {
              emitPushMem(elementType) // returns mutated __stack_ptr__
            }
          }
        }
        line(`global.get ${wasmId("__stack_ptr__")}`)
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
            // TODO: handle strings
            throw new Error(`Unhandled literal type ${ast.typeToString(op.type)}`)
          }
        }
        break
      }
      case ast.NodeKind.LOGICAL_EXPR: {
        const op = node as ast.LogicalExpr
        // Can use bitwise equivalents assuming operands are bools (0 or 1)
        const label = wasmId(nextLabelID++ + "")
        line(`(block ${label} (result i32)`)
        indent()
        switch (op.operator.lexeme) {
          case "&&": {
            visit(op.left)
            emitDupTop(`i32`)
            line(`i32.eqz`)
            line(`br_if ${label}`)
            visit(op.right)
            line(`i32.eq`)
            break
          }
          case "||": {
            visit(op.left)
            emitDupTop(`i32`)
            line(`br_if ${label}`)
            line(`drop`)
            visit(op.right)
            break
          }
          default: {
            break
          }
        }
        dedent()
        line(`)`)
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
            const t = registerType(op.right.resolvedType!)
            line(`${t}.const 0`)
            visit(op.right)
            line(`${t}.sub`)
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
        visit(op.expression)
        const t = op.expression.resolvedType!
        if (!ast.isEqual(t, ast.VoidType)) {
          // discard result
          if (!ast.isScalar(t)) {
            emitFreeStackVal(t)
          }
          line(`drop`) 
        }
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
              line(`(param ${wasmId(name, local.id)} ${registerType(local.param.type)})`)
            }
          })
          if (!ast.isEqual(op.returnType, ast.VoidType)) {
            // TODO: handle array return type
            line(`(result ${registerType(op.returnType)})`)
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
          line(`(local ${wasmId("__tee_i32__")} i32)`)
          line(`(local ${wasmId("__tee_f32__")} f32)`)
          op.scope.forEach((name, local) => {
            if (local.kind === ast.SymbolKind.VARIABLE) {
              line(`(local ${wasmId(name, local.id)} ${registerType(local.node.type!)})`)
            }
          })
          op.hoistedLocals?.forEach((local) => {
            const name = local.node.name.lexeme
            line(`(local ${wasmId(name, local.id)} ${registerType(local.node.type!)})`)
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
      default: {
        assertUnreachable(node.kind)
      }
    }
  }

  line(`(module`)
  {
    indent()

    line(`(import "console" "log" (func ${wasmId("__log_i32__")} (param i32)))`)
    line(`(import "console" "log" (func ${wasmId("__log_f32__")} (param f32)))`)

    line(`(memory $memory 1)`)

    line(`(global ${wasmId("__stack_ptr__")} (mut i32) i32.const ${STACK_TOP_BYTE_OFFSET})`)
    context.globalInitOrder?.forEach((varDecl) => {
      if (varDecl.type !== null) {
        const type = registerType(varDecl.type)
        line(`(global ${wasmId(varDecl.name.lexeme)} (mut ${type}) ${defaultForRegisterType(type)})`)
      }
    })
  
    line(`(func (export "__init_globals__")`)
    {
      indent()
      line(`(local ${wasmId("__tee_i32__")} i32)`)
      line(`(local ${wasmId("__tee_f32__")} f32)`)
      context.globalInitOrder?.forEach((varDecl) => {
        if (varDecl.type !== null) {
          visit(varDecl)
          skip.add(varDecl)
        }
      })
      dedent()
    }
    line(`)`)

    line(`(func ${wasmId("__memcpy__")} (param $src i32) (param $dst i32) (param $numBytes i32)`)
    {
      indent()
      /*
      while (numBytes > 0) {
        *dst = *src;
        src++;
        dst++;
        numBytes--;
      }
      */
      const outerLabel = wasmId(nextLabelID++ + "")
      const innerLabel = wasmId(nextLabelID++ + "")
      line(`(block ${outerLabel}`)
      {
        indent()
        line(`(loop ${innerLabel}`)
        {
          indent()
          line(`local.get $numBytes`)
          line(`i32.const 0`)
          line(`i32.gt_s`)
          line(`i32.eqz`)
          line(`br_if ${outerLabel}`)
          // *dst = *src;
          line(`local.get $dst`)
          line(`local.get $src`)
          line(`i32.load8_u`)
          line(`i32.store8`)
          // src++, dst++;
          line(`local.get $src`)
          line(`i32.const 1`)
          line(`i32.add`)
          line(`local.set $src`)
          line(`local.get $dst`)
          line(`i32.const 1`)
          line(`i32.add`)
          line(`local.set $dst`)
          // numBytes--;
          line(`local.get $numBytes`)
          line(`i32.const 1`)
          line(`i32.sub`)
          line(`local.set $numBytes`)
          line(``)
          line(`br ${innerLabel}`)
          dedent()
        }
        line(`)`)
        dedent()
      }
      line(`)`)
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
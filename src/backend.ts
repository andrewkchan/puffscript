import * as ast from './nodes'
import { assertUnreachable, UTF8Codec } from './util'

const codec = new UTF8Codec()

////////////////////////////////////////////////////
// Puff memory layout
////////////////////////////////////////////////////
// ----------------------- 0
//
// -----------------------
//            ^ grows toward zero
//        stack (locals)
// ----------------------- STACK_TOP_BYTE_OFFSET
//        data (globals)
// ----------------------- DATA_TOP_BYTE_OFFSET
//
//
//
// ----------------------- max byte offset
////////////////////////////////////////////////////
//
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
const DATA_TOP_BYTE_OFFSET = 1024*1024

const INITIAL_PAGES = (8*1024*1024) / (64*1024);

enum ExprMode {
  LVALUE,
  RVALUE
}

// WAT strings cannot contain backslashes, ASCII control sequences, or quotes:
// https://webassembly.github.io/spec/core/text/values.html#strings
function escapeString(str: string): string {
  return str.replace(/'/, '\'').replace(/\\/, '\\\\').replace(/"/, '\"')
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
    case ast.TypeCategory.ERROR:
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

function isVariableInRegister(symbol: ast.VariableSymbol | ast.ParamSymbol): boolean {
  if (symbol.isAddressTaken) {
    return false
  }
  const type = symbol.kind === ast.SymbolKind.PARAM ?
    symbol.param.type : symbol.node.type
  return type !== null && ast.isScalar(type)
}

const DEBUG_COMMENTS = true

// Emits WAT code for the resolved context.
export function emit(context: ast.Context): string {
  // stores locations of globals.
  const globalLocs: Map<ast.Symbol, number> = new Map()
  // stores locations of string literals (these live in same segment as globals)
  const stringLocs: Map<string, number> = new Map()
  // stores distance of locals from function base pointer.
  // distances are positive and must be added to base pointer to get runtime location.
  let localLocs: Map<ast.Symbol, number> | null = null

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
  function debugLine(text: string) {
    if (DEBUG_COMMENTS) {
      line(text)
    }
  }

  const skip: Set<ast.Node> = new Set()

  let nextLabelID = 0

  // Emit code to:
  // 1. push a value of the given type to the in-memory stack (+adjust __stack_ptr__)
  // 2. return the new stack ptr, which points to the pushed value
  // PRECOND: Address of value to push is top item of WASM stack.
  function emitPushMem(type: ast.Type) {
    debugLine(`;; emitPushMem(${ast.typeToString(type)})`)
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
    debugLine(`;; emitPushScalar(${ast.typeToString(type)})`)
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

  // Emit code to swap stack[n] and stack[n-1].
  // PRECOND: inside a function.
  function emitSwapTop(topRegister: "i32" | "f32", secondRegister: "i32" | "f32") {
    line(`local.set ${wasmId("__swapa_" + topRegister + "__")}`)
    line(`local.set ${wasmId("__swapb_" + secondRegister + "__")}`)
    line(`local.get ${wasmId("__swapa_" + topRegister + "__")}`)
    line(`local.get ${wasmId("__swapb_" + secondRegister + "__")}`)
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

  // Emit code to compute the address of a local or global variable.
  // Returns address.
  function emitLoc(symbol: ast.VariableSymbol | ast.ParamSymbol) {
    if (symbol.kind === ast.SymbolKind.VARIABLE && symbol.isGlobal) {
      const loc = globalLocs.get(symbol)
      if (loc) {
        line(`i32.const ${loc}`)
      } else {
        throw new Error(`Cannot find global '${symbol.node.name.lexeme}' in emitLoc`)
      }
    } else {
      const offset = localLocs?.get(symbol)
      if (offset) {
        line(`local.get ${wasmId("__base_ptr__")}`)
        line(`i32.const ${offset}`)
        line(`i32.sub`)
      } else {
        throw new Error(`Cannot find local in emitLoc`)
      }
    }
  }

  // Emit code to set the given symbol to the value currently at top of the host WASM stack.
  // Returns the set value or address of non-scalar symbol.
  // PRECOND:
  // - stack[n]: Scalar value or address of non-scalar value to copy
  function emitSetSymbol(symbol: ast.VariableSymbol | ast.ParamSymbol) {
    const varSymbol = symbol.kind === ast.SymbolKind.VARIABLE ? symbol as ast.VariableSymbol : null
    const paramSymbol = symbol.kind === ast.SymbolKind.PARAM ? symbol as ast.ParamSymbol : null
    if (isVariableInRegister(symbol)) {
      if (varSymbol && varSymbol.isGlobal) {
        emitDupTop(registerType(varSymbol.node.type!))
        line(`global.set ${wasmId(varSymbol.node.name.lexeme)}`)
      } else {
        const name = varSymbol?.node.name.lexeme ?? paramSymbol?.param.name.lexeme
        line(`local.tee ${wasmId(name!, symbol.id)}`)
      }
    } else {
      const type = varSymbol?.node.type ?? paramSymbol?.param.type
      if (ast.isScalar(type!)) {
        emitDupTop(registerType(type!)) // for return value
        emitLoc(symbol)
        emitSwapTop("i32", registerType(type!))
        emitStoreScalar(type!)
      } else {
        emitLoc(symbol)
        line(`i32.const ${ast.sizeof(type!)}`)
        line(`call ${wasmId("__memcpy__")}`)
        emitLoc(symbol) // return dest address
      }
    }
  }

  // Emits code to get the given symbol.
  // - If symbol is scalar, returns value.
  // - If symbol is non-scalar, returns address.
  function emitGetSymbol(symbol: ast.VariableSymbol | ast.ParamSymbol) {
    const varSymbol = symbol.kind === ast.SymbolKind.VARIABLE ? symbol as ast.VariableSymbol : null
    const paramSymbol = symbol.kind === ast.SymbolKind.PARAM ? symbol as ast.ParamSymbol : null
    if (isVariableInRegister(symbol)) {
      if (varSymbol && varSymbol.isGlobal) {
        line(`global.get ${wasmId(varSymbol.node.name.lexeme)}`)
      } else {
        const name = varSymbol?.node.name.lexeme ?? paramSymbol?.param.name.lexeme
        line(`local.get ${wasmId(name!, symbol.id)}`)
      }
    } else {
      emitLoc(symbol)
      const type = varSymbol?.node.type ?? paramSymbol?.param.type
      if (ast.isScalar(type!)) {
        emitLoadScalar(type!)
      } else {
        // Nothing to do, return address above
      }
    }
  }

  // Emit code to print the given ASCII character.
  // No return value.
  function emitPrintASCIIChars(chars: string) {
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i]
      line(`i32.const ${codec.encodeASCIIChar(c)}`)
      line(`call ${wasmId("__putc__")}`)
    }
  }

  // Emit code to print a value of the given type.
  // No return value.
  // PRECOND: Stack contains 1 value:
  // - stack[n]: Scalar value or address of non-scalar value to print
  function emitPrintVal(type: ast.Type) {
    switch (type.category) {
      case ast.TypeCategory.ARRAY: {
        // TODO: When we implement strings, desugar me?
        const elementType = type.elementType
        if (ast.isEqual(elementType, ast.ByteType)) {
          // Byte arrays are printed as string literals
          // TODO: support UTF-8
          for (let i = 0; i < type.length; i++) {
            const isLast = i === type.length - 1
            if (!isLast) {
              emitDupTop("i32")
            }
            line(`i32.const ${i * ast.sizeof(elementType)}`)
            line(`i32.add`)
            emitLoadScalar(elementType)
            line(`call ${wasmId("__putc__")}`)
          }
        } else {
          emitPrintASCIIChars(`[`)
          for (let i = 0; i < type.length; i++) {
            const isLast = i === type.length - 1
            if (!isLast) {
              emitDupTop("i32")
            }
            line(`i32.const ${i * ast.sizeof(elementType)}`)
            line(`i32.add`)
            if (ast.isScalar(elementType)) {
              emitLoadScalar(elementType)
              emitPrintVal(elementType)
            } else {
              emitPrintVal(elementType)
            }
            if (!isLast) {
              emitPrintASCIIChars(`, `)
            }
          }
          emitPrintASCIIChars(`]`)
        }
        break
      }
      case ast.TypeCategory.BYTE: {
        // mask 24 MSB before logging
        line(`i32.const 0x000000FF`)
        line(`i32.and`)
        line(`call ${wasmId("__puti__")}`)
        break
      }
      case ast.TypeCategory.BOOL:
      case ast.TypeCategory.INT: {
        line(`call ${wasmId("__puti__")}`)
        break
      }
      case ast.TypeCategory.FLOAT: {
        line(`call ${wasmId("__putf__")}`)
        break
      }
      default: {
        // TODO: Handle strings and pointers
        throw new Error("Unexpected type for print")
      }
    }
  }

  function emitDebugComments(node: ast.Node) {
    switch (node.kind) {
      case ast.NodeKind.BINARY_EXPR:
      case ast.NodeKind.CAST_EXPR:
      case ast.NodeKind.GROUP_EXPR:
      case ast.NodeKind.LEN_EXPR:
      case ast.NodeKind.LITERAL_EXPR:
      case ast.NodeKind.LOGICAL_EXPR:
      case ast.NodeKind.UNARY_EXPR:
      case ast.NodeKind.VARIABLE_EXPR: {
        // these are too noisy
        return
      }
    }
    debugLine(``)
    debugLine(`;; visit ${ast.NodeKind[node.kind]}`)
    debugLine(`;; ${ast.astToSExpr(node)}`)
    debugLine(``)
  }

  function visit(node: ast.Node, exprMode: ExprMode = ExprMode.RVALUE) {
    if (skip.has(node)) {
      return
    }

    emitDebugComments(node)

    switch (node.kind) {
      // expressions
      case ast.NodeKind.ASSIGN_EXPR: {
        const op = node as ast.AssignExpr
        op.operator.lineStr(true).split("\n").forEach((l) => {
          debugLine(`;; ${l}`)
        })
        debugLine(``)

        if (op.left.kind === ast.NodeKind.VARIABLE_EXPR) {
          const symbol = op.left.resolvedSymbol!
          visit(op.right)
          if (symbol.kind === ast.SymbolKind.VARIABLE || symbol.kind === ast.SymbolKind.PARAM) {
            emitSetSymbol(symbol)
          } else {
            throw new Error("Cannot assign to function symbol")
          }
        } else {
          // Assigning to an index or dereference expression, e.g. `(...)[i] = ...` or `(...)~ = ...`
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
          case "%": {
            if (ast.isEqual(op.left.resolvedType!, ast.ByteType)) {
              line(`i32.rem_u`)
            } else {
              line(`i32.rem_s`)
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
            const returnType = op.resolvedType!
            const pushReturnValToStack = !ast.isScalar(returnType) && !ast.isEqual(returnType, ast.VoidType)
            if (pushReturnValToStack) {
              emitAllocStackVal(returnType)
            }

            line(`call ${wasmId(symbol.node.name.lexeme)}`)

            if (pushReturnValToStack) {
              // Call above returned address of return value.
              // Memcpy it to the earlier reservation
              line(`global.get ${wasmId("__stack_ptr__")}`)
              line(`i32.const ${ast.sizeof(returnType)}`)
              line(`call ${wasmId("__memcpy__")}`)
              // return stack ptr
              line(`global.get ${wasmId("__stack_ptr__")}`)
            }
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
          case ast.TypeCategory.POINTER: {
            if (op.value.resolvedType?.category === ast.TypeCategory.POINTER) {
              // no conversions needed
            } else {
              throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast source`)
            }
            break
          }
          default: {
            throw new Error(`Unexpected type ${ast.typeToString(op.type)} for cast target`)
          }
        }
        break
      }
      case ast.NodeKind.DEREF_EXPR: {
        const op = node as ast.DerefExpr

        const elementType = op.resolvedType!
        visit(op.value, ExprMode.RVALUE) // returns an address pointing to value of type `elementType`
        if (exprMode === ExprMode.LVALUE) {
          // Done; return address of value
        } else {
          if (ast.isScalar(elementType)) {
            emitLoadScalar(elementType)
          } else {
            // Allows construction of temporaries like:
            // ```
            // var mat [[int; 2]; 2] = [row1~, row2~];
            // ```
            emitPushMem(elementType)
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
        // TODO: trap on out-of-bounds access
        const op = node as ast.IndexExpr
        op.bracket.lineStr(true).split("\n").forEach((l) => {
          debugLine(`;; ${l}`)
        })
        debugLine(``)

        const elementType = op.resolvedType!
        visit(op.callee, ExprMode.LVALUE) // get address of array start
        visit(op.index) // get index
        // eat 2, get address of indexed element
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
          emitAllocStackVal(op.resolvedType!)
          line(`global.get ${wasmId("__stack_ptr__")}`)
          if (ast.isScalar(elementType)) {
            for (let i = 0; i < initializer.values.length; i++) {
              emitDupTop("i32")
              line(`i32.const ${i * ast.sizeof(elementType)}`)
              line(`i32.add`)
              visit(initializer.values[i]) // value to store
              emitStoreScalar(elementType)
            }
          } else {
            for (let i = 0; i < initializer.values.length; i++) {
              emitDupTop("i32")
              line(`i32.const ${i * ast.sizeof(elementType)}`)
              line(`i32.add`)
              visit(initializer.values[i]) // address of value to store
              emitSwapTop("i32", "i32")
              line(`i32.const ${ast.sizeof(elementType)}`)
              line(`call ${wasmId("__memcpy__")}`)
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
            line(`drop`)
          }
          line(`global.get ${wasmId("__stack_ptr__")}`)
        }
        break
      }
      case ast.NodeKind.LITERAL_EXPR: {
        const op = node as ast.LiteralExpr
        switch (op.type.category) {
          case ast.TypeCategory.ARRAY: {
            const elementType = op.type.elementType
            if (!ast.isEqual(elementType, ast.ByteType)) {
              // If we're here, we probably meant to use a LIST_EXPR
              throw new Error("Literal node contains non-string array")
            }
            // TODO: Maybe string vars should be references only?
            const loc = stringLocs.get(op.value)!
            line(`i32.const ${loc}`)
            emitPushMem(op.type)
            break
          }
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
            visit(op.value)
            line(`i32.eqz`)
            break
          }
          case "-": {
            const t = registerType(op.value.resolvedType!)
            line(`${t}.const 0`)
            visit(op.value)
            line(`${t}.sub`)
            break
          }
          case "&": {
            switch (op.value.kind) {
              case ast.NodeKind.VARIABLE_EXPR: {
                const symbol = op.value.resolvedSymbol
                if (symbol?.kind === ast.SymbolKind.PARAM || symbol?.kind === ast.SymbolKind.VARIABLE) {
                  emitLoc(symbol)
                } else {
                  throw new Error("Unhandled operand for operator '&'.")
                }
                break
              }
              case ast.NodeKind.INDEX_EXPR: {
                // `&arr[i]` should return address of the ith element in `arr`.
                visit(op.value, ExprMode.LVALUE)
                break
              }
              default: {
                throw new Error("Unhandled operand for operator '&'.")
              }
            }
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
          if (symbol.kind === ast.SymbolKind.VARIABLE || symbol.kind === ast.SymbolKind.PARAM) {
            emitGetSymbol(symbol)
            if (!ast.isScalar(op.resolvedType!) && exprMode === ExprMode.RVALUE) {
              // When evaluating non-scalar variables as rvals, copy the value as a temporary to the stack
              emitPushMem(op.resolvedType!)
            }
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
      //
      // TODO: Track any unbound temporaries pushed to the puff stack and pop them.
      // E.g. for code like this:
      // ```
      // var x = [1, 2, 3][0];
      // ```
      // We should either not be pushing [1, 2, 3] on the stack, or removing it once
      // we extract its length. Not sure if this is easiest to do on statement boundaries.
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
          // TODO: free unused stack memory? Tricky to know if its really unused
          line(`drop`)
        }
        break
      }
      case ast.NodeKind.FUNCTION_STMT: {
        const op = node as ast.FunctionStmt
        localLocs = new Map()
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
            line(`(result ${registerType(op.returnType)})`)
          }
          // WASM doesn't have block scope, and `func` definitions require all local registers
          // to be declared ahead-of-time, so we need to hoist all locals in descendant scopes
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
          {
            line(`(local ${wasmId("__base_ptr__")} i32)`)
            line(`(local ${wasmId("__tee_i32__")} i32)`)
            line(`(local ${wasmId("__tee_f32__")} f32)`)
            line(`(local ${wasmId("__swapa_i32__")} i32)`)
            line(`(local ${wasmId("__swapb_i32__")} i32)`)
            line(`(local ${wasmId("__swapb_f32__")} f32)`)
            line(`(local ${wasmId("__swapa_f32__")} f32)`)

            let localOffset = 0
            const allocateRegisterOrStackLoc = (local: ast.Symbol) => {
              if (local.kind !== ast.SymbolKind.FUNCTION) {
                if (isVariableInRegister(local) && local.kind === ast.SymbolKind.VARIABLE) {
                  line(`(local ${wasmId(local.node.name.lexeme, local.id)} ${registerType(local.node.type!)})`)
                } else {
                  const type = local.kind === ast.SymbolKind.VARIABLE ?
                    local.node.type : local.param.type
                  localOffset += ast.sizeof(type!)
                  localLocs?.set(local, localOffset)
                }
              }
            }
            op.scope.forEach((_, local) => allocateRegisterOrStackLoc(local))
            op.hoistedLocals?.forEach((local) => allocateRegisterOrStackLoc(local))
            line(`global.get ${wasmId("__stack_ptr__")}`)
            line(`local.set ${wasmId("__base_ptr__")}`)

            line(`global.get ${wasmId("__stack_ptr__")}`)
            line(`i32.const ${localOffset}`)
            line(`i32.sub`)
            line(`global.set ${wasmId("__stack_ptr__")}`)
          }

          // Copy + push nonregister args to stack
          op.params.forEach((param) => {
            const symbol = op.scope.lookup(param.name.lexeme, (_) => true) as ast.ParamSymbol
            if (symbol && !isVariableInRegister(symbol)) {
              line(`local.get ${wasmId(param.name.lexeme, symbol!.id)}`)
              emitSetSymbol(symbol)
              // After this, we should only ever be using `emitGetSymbol` to access the symbol.
              // The local is meaningless.
            }
          })

          op.body.forEach((statement) => {
            visit(statement)
          })

          line(`local.get ${wasmId("__base_ptr__")}`)
          line(`global.set ${wasmId("__stack_ptr__")}`)
          dedent()
        }
        line(`)`)
        localLocs = null
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
        emitPrintVal(op.expression.resolvedType!)
        line(`call ${wasmId("__flush__")}`)
        break
      }
      case ast.NodeKind.RETURN_STMT: {
        const op = node as ast.ReturnStmt
        if (op.value) {
          visit(op.value)
        }
        line(`local.get ${wasmId("__base_ptr__")}`)
        line(`global.set ${wasmId("__stack_ptr__")}`)
        line(`return`)
        break
      }
      case ast.NodeKind.VAR_STMT: {
        const op = node as ast.VarStmt
        visit(op.initializer)
        emitSetSymbol(op.symbol!) // returns address/value that was set
        line(`drop`)
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

    line(`(import "io" "log" (func ${wasmId("__log_i32__")} (param i32)))`)
    line(`(import "io" "log" (func ${wasmId("__log_f32__")} (param f32)))`)
    line(`(import "io" "putchar" (func ${wasmId("__putc__")} (param i32)))`)
    line(`(import "io" "putf" (func ${wasmId("__putf__")} (param f32)))`)
    line(`(import "io" "puti" (func ${wasmId("__puti__")} (param i32)))`)
    line(`(import "io" "flush" (func ${wasmId("__flush__")}))`)

    line(`(memory $memory ${INITIAL_PAGES})`)

    line(`(global ${wasmId("__stack_ptr__")} (mut i32) i32.const ${STACK_TOP_BYTE_OFFSET})`)
    let globalByteOffset = DATA_TOP_BYTE_OFFSET
    context.stringLiterals.forEach((literal) => {
      globalByteOffset -= ast.sizeof(literal.type)
      stringLocs.set(literal.value, globalByteOffset)
      line(`(data (i32.const ${globalByteOffset}) "${escapeString(literal.value)}")`)
    })
    context.globalInitOrder?.forEach((varDecl) => {
      const symbol = varDecl.symbol
      if (symbol !== null && varDecl.type !== null) {
        if (isVariableInRegister(symbol)) {
          const type = registerType(varDecl.type)
          line(`(global ${wasmId(varDecl.name.lexeme)} (mut ${type}) ${defaultForRegisterType(type)})`)
        } else {
          globalByteOffset -= ast.sizeof(varDecl.type)
          globalLocs.set(symbol, globalByteOffset)
        }
      }
    })

    line(`(func (export "__init_globals__")`)
    {
      indent()
      line(`(local ${wasmId("__base_ptr__")} i32)`)
      line(`(local ${wasmId("__tee_i32__")} i32)`)
      line(`(local ${wasmId("__tee_f32__")} f32)`)
      line(`(local ${wasmId("__swapa_i32__")} i32)`)
      line(`(local ${wasmId("__swapb_i32__")} i32)`)
      line(`(local ${wasmId("__swapb_f32__")} f32)`)
      line(`(local ${wasmId("__swapa_f32__")} f32)`)

      line(`global.get ${wasmId("__stack_ptr__")}`)
      line(`local.set ${wasmId("__base_ptr__")}`)

      context.globalInitOrder?.forEach((varDecl) => {
        if (varDecl.type !== null) {
          visit(varDecl)
          skip.add(varDecl)
        }
      })

      line(`local.get ${wasmId("__base_ptr__")}`)
      line(`global.set ${wasmId("__stack_ptr__")}`)
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
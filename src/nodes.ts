import { Token } from './scanner'
import { assertUnreachable } from './util'

export enum NodeKind {
  // expressions
  ASSIGN_EXPR,
  BINARY_EXPR,
  CALL_EXPR,
  CAST_EXPR,
  DEREF_EXPR,
  GROUP_EXPR,
  INDEX_EXPR,
  LEN_EXPR,
  LIST_EXPR,
  LITERAL_EXPR,
  LOGICAL_EXPR,
  UNARY_EXPR,
  VARIABLE_EXPR,

  // statements
  BLOCK_STMT,
  EXPRESSION_STMT,
  FUNCTION_STMT,
  IF_STMT,
  PRINT_STMT,
  RETURN_STMT,
  VAR_STMT,
  WHILE_STMT
}

export interface Node {
  kind: NodeKind
}

export type Expr = AssignExpr | BinaryExpr | CallExpr | CastExpr | DerefExpr | GroupExpr | IndexExpr | LenExpr | ListExpr | LiteralExpr | LogicalExpr | UnaryExpr | VariableExpr

export interface AssignExpr extends Node {
  kind: NodeKind.ASSIGN_EXPR
  operator: Token
  left: IndexExpr | VariableExpr | DerefExpr
  right: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function assignExpr({ left, operator, right }: { left: IndexExpr | VariableExpr | DerefExpr; operator: Token; right: Expr }): AssignExpr {
  return {
    kind: NodeKind.ASSIGN_EXPR,
    operator,
    left,
    right,
    resolvedType: null
  }
}

export interface BinaryExpr extends Node {
  kind: NodeKind.BINARY_EXPR
  left: Expr
  operator: Token
  right: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function binaryExpr({ left, operator, right }: { left: Expr; operator: Token; right: Expr }): BinaryExpr {
  return {
    kind: NodeKind.BINARY_EXPR,
    left,
    operator,
    right,
    resolvedType: null
  }
}

export interface CallExpr extends Node {
  kind: NodeKind.CALL_EXPR
  callee: Expr
  paren: Token
  args: Expr[]
  resolvedType: Type | null // filled in by resolver pass
}

export function callExpr({ callee, paren, args }: { callee: Expr; paren: Token; args: Expr[] }): CallExpr {
  return {
    kind: NodeKind.CALL_EXPR,
    callee,
    paren,
    args,
    resolvedType: null
  }
}

export interface CastExpr extends Node {
  kind: NodeKind.CAST_EXPR
  token: Token
  type: Type
  value: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function castExpr({ token, type, value }: { token: Token; type: Type; value: Expr }): CastExpr {
  return {
    kind: NodeKind.CAST_EXPR,
    token,
    type,
    value,
    resolvedType: null
  }
}

export interface DerefExpr extends Node {
  kind: NodeKind.DEREF_EXPR
  operator: Token
  value: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function derefExpr({ operator, value }: { operator: Token; value: Expr }): DerefExpr {
  return {
    kind: NodeKind.DEREF_EXPR,
    operator,
    value,
    resolvedType: null
  }
}

export interface GroupExpr extends Node {
  kind: NodeKind.GROUP_EXPR
  expression: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function groupExpr({ expression }: { expression: Expr }): GroupExpr {
  return {
    kind: NodeKind.GROUP_EXPR,
    expression,
    resolvedType: null
  }
}

export interface IndexExpr extends Node {
  kind: NodeKind.INDEX_EXPR
  callee: Expr
  bracket: Token
  index: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function indexExpr({ callee, bracket, index }: { callee: Expr; bracket: Token; index: Expr }): IndexExpr {
  return {
    kind: NodeKind.INDEX_EXPR,
    callee,
    bracket,
    index,
    resolvedType: null
  }
}

export interface LenExpr extends Node {
  kind: NodeKind.LEN_EXPR
  value: Expr
  resolvedLength: number | null // filled in by resolver pass
  resolvedType: typeof IntType
}

export function lenExpr({ value }: { value: Expr }): LenExpr {
  return {
    kind: NodeKind.LEN_EXPR,
    value,
    resolvedLength: null,
    resolvedType: IntType
  }
}

export enum ListKind {
  LIST,
  REPEAT
}

interface ListInitializer {
  kind: ListKind.LIST
  values: Expr[]
}

interface RepeatInitializer {
  kind: ListKind.REPEAT
  value: Expr
  length: number
}

export interface ListExpr extends Node {
  kind: NodeKind.LIST_EXPR
  bracket: Token
  initializer: ListInitializer | RepeatInitializer
  resolvedType: Type | null // filled in by resolver pass
}

export function listExpr({ values, bracket }: { values: Expr[]; bracket: Token }): ListExpr {
  return {
    kind: NodeKind.LIST_EXPR,
    bracket,
    initializer: {
      kind: ListKind.LIST,
      values
    },
    resolvedType: null
  }
}

export function repeatExpr({ bracket, value, length }: { bracket: Token; value: Expr; length: number }): ListExpr {
  return {
    kind: NodeKind.LIST_EXPR,
    bracket,
    initializer: {
      kind: ListKind.REPEAT,
      value,
      length
    },
    resolvedType: null
  }
}

export interface LiteralExpr extends Node {
  kind: NodeKind.LITERAL_EXPR
  value: any
  type: Type
  resolvedType: Type | null // filled in by resolver pass
}

export function literalExpr({ value, type }: { value: any; type: Type }): LiteralExpr {
  return {
    kind: NodeKind.LITERAL_EXPR,
    value,
    type,
    resolvedType: null
  }
}

export interface LogicalExpr extends Node {
  kind: NodeKind.LOGICAL_EXPR
  left: Expr
  operator: Token
  right: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function logicalExpr({ left, operator, right }: { left: Expr; operator: Token; right: Expr }): LogicalExpr {
  return {
    kind: NodeKind.LOGICAL_EXPR,
    left,
    operator,
    right,
    resolvedType: null
  }
}

export interface UnaryExpr extends Node {
  kind: NodeKind.UNARY_EXPR
  operator: Token
  value: Expr
  resolvedType: Type | null // filled in by resolver pass
}

export function unaryExpr({ operator, value }: { operator: Token; value: Expr }): UnaryExpr {
  return {
    kind: NodeKind.UNARY_EXPR,
    operator,
    value,
    resolvedType: null
  }
}

export interface VariableExpr extends Node {
  kind: NodeKind.VARIABLE_EXPR
  name: Token
  resolvedType: Type | null // filled in by resolver pass
  resolvedSymbol: Symbol | null // filled in by resolver pass
}

export function variableExpr({ name }: { name: Token }): VariableExpr {
  return {
    kind: NodeKind.VARIABLE_EXPR,
    name,
    resolvedType: null,
    resolvedSymbol: null
  }
}

export enum TypeCategory {
  ARRAY,
  BOOL,
  BYTE,
  ERROR,
  FLOAT,
  INT,
  POINTER,
  VOID
}

export const ErrorType = {
  category: TypeCategory.ERROR as const
}

export const VoidType = {
  category: TypeCategory.VOID as const
}

export const IntType = {
  category: TypeCategory.INT as const
}

export const FloatType = {
  category: TypeCategory.FLOAT as const
}

export const ByteType = {
  category: TypeCategory.BYTE as const
}

export const BoolType = {
  category: TypeCategory.BOOL as const
}

export type SimpleType = typeof IntType | typeof FloatType | typeof ByteType | typeof BoolType

export interface ArrayType {
  category: TypeCategory.ARRAY
  elementType: Type
  length: number
}

export function arrayType(elementType: Type, length: number): ArrayType {
  return {
    category: TypeCategory.ARRAY,
    elementType,
    length
  }
}

export interface PointerType {
  category: TypeCategory.POINTER
  elementType: Type
}

export function ptrType(elementType: Type): PointerType {
  return {
    category: TypeCategory.POINTER,
    elementType
  }
}

export type Type = ArrayType | PointerType | SimpleType | typeof ErrorType | typeof VoidType

export function isEqual(a: Type, b: Type): boolean {
  if (a.category === TypeCategory.ARRAY && b.category === TypeCategory.ARRAY) {
    return isEqual(a.elementType, b.elementType) && a.length === b.length
  }
  if (a.category === TypeCategory.POINTER && b.category === TypeCategory.POINTER) {
    return isEqual(a.elementType, b.elementType)
  }
  return a.category === b.category
}

export function isValidElementType(t: Type): boolean {
  if (isEqual(t, ErrorType)) {
    return true
  }
  return sizeof(t) > 0
}

export function sizeof(t: Type): number {
  switch (t.category) {
    case TypeCategory.ARRAY: {
      return sizeof(t.elementType) * t.length
    }
    case TypeCategory.POINTER: {
      return sizeof(t.elementType)
    }
    case TypeCategory.INT:
    case TypeCategory.FLOAT: {
      return 4
    }
    case TypeCategory.BYTE:
    case TypeCategory.BOOL: {
      return 1
    }
    case TypeCategory.VOID: {
      return 0
    }
    case TypeCategory.ERROR: {
      throw new Error(`Unhandled type ${typeToString(t)} for sizeof`)
    }
  }
}

export function isScalar(t: Type): boolean {
  switch (t.category) {
    case TypeCategory.ARRAY:
    case TypeCategory.ERROR:
    case TypeCategory.VOID: {
      return false
    }
    case TypeCategory.BOOL:
    case TypeCategory.BYTE:
    case TypeCategory.FLOAT:
    case TypeCategory.INT:
    case TypeCategory.POINTER: {
      return true
    }
  }
}

export function isNumeric(t: Type): boolean {
  switch (t.category) {
    case TypeCategory.ARRAY:
    case TypeCategory.BOOL:
    case TypeCategory.ERROR:
    case TypeCategory.POINTER:
    case TypeCategory.VOID: {
      return false
    }
    case TypeCategory.INT:
    case TypeCategory.FLOAT:
    case TypeCategory.BYTE: {
      return true
    }
  }
}

export function canCast(from: Type, to: Type): boolean {
  if (isEqual(from, ErrorType) || isEqual(to, ErrorType)) {
    // We already threw an error somewhere.
    // Pretend we can cast the result so we don't cascade errors.
    return true
  }
  if ((isNumeric(from) || isEqual(from, BoolType)) && (isNumeric(to) || isEqual(to, BoolType))) {
    // Numerics and bools can always be casted to and from each other.
    return true
  }
  if (from.category === TypeCategory.POINTER && to.category === TypeCategory.POINTER) {
    // Pointers are a type escape hatch and can always be casted to/from each other.
    return true
  }
  return isEqual(from, to)
}

export function canCoerce(from: Type, to: Type): boolean {
  if (from.category === TypeCategory.ERROR || to.category === TypeCategory.ERROR) {
    // We already threw an error somewhere.
    // Pretend we can coerce the result so we don't cascade errors.
    return true
  }
  if (isEqual(from, to)) {
    return true
  }
  switch (from.category) {
    case TypeCategory.ARRAY:
    case TypeCategory.VOID:
    case TypeCategory.POINTER: {
      return false
    }
  }
  switch (to.category) {
    case TypeCategory.ARRAY:
    case TypeCategory.VOID:
    case TypeCategory.POINTER: {
      return false
    }
  }
  switch (from.category) {
    case TypeCategory.INT: {
      switch (to.category) {
        case TypeCategory.INT: {
          return true
        }
        case TypeCategory.FLOAT: {
          return true
        }
        case TypeCategory.BYTE: {
          return false
        }
        case TypeCategory.BOOL: {
          return true
        }
      }
    }
    case TypeCategory.FLOAT: {
      switch (to.category) {
        case TypeCategory.INT: {
          return false
        }
        case TypeCategory.FLOAT: {
          return true
        }
        case TypeCategory.BYTE: {
          return false
        }
        case TypeCategory.BOOL: {
          return true
        }
      }
    }
    case TypeCategory.BYTE: {
      switch (to.category) {
        case TypeCategory.INT: {
          return true
        }
        case TypeCategory.FLOAT: {
          return true
        }
        case TypeCategory.BYTE: {
          return true
        }
        case TypeCategory.BOOL: {
          return true
        }
      }
    }
    case TypeCategory.BOOL: {
      switch (to.category) {
        case TypeCategory.INT: {
          return false
        }
        case TypeCategory.FLOAT: {
          return false
        }
        case TypeCategory.BYTE: {
          return false
        }
        case TypeCategory.BOOL: {
          return true
        }
      }
    }
  }
}

export function canCoerceNumberLiteral(value: number, to: Type): boolean {
  if (!isNumeric(to)) {
    return false
  }
  switch (to.category) {
    case TypeCategory.BYTE: {
      return Number.isInteger(value) && value >= BYTE_MIN && value <= BYTE_MAX
    }
    case TypeCategory.INT: {
      return Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX
    }
    case TypeCategory.FLOAT: {
      return true
    }
    default: {
      return false
    }
  }
}

const NUMERIC_TYPE_PRECEDENCE: readonly SimpleType[] = [ByteType, IntType, FloatType]

// Get lowest common numeric type to which we can coerce both `a` and `b`.
// If one of the args is not a numeric, returns null.
export function getLowestCommonNumeric(a: Type, b: Type): Type | null {
  if (!isNumeric(a) || !isNumeric(b)) {
    return null
  }
  if (isEqual(a, b)) {
    return a
  }
  for (let i = 0; i < NUMERIC_TYPE_PRECEDENCE.length; i++) {
    const t = NUMERIC_TYPE_PRECEDENCE[i]
    if (canCoerce(a, t) && canCoerce(b, t)) {
      return t
    }
  }
  return null
}

export const INT_MIN = -2147483647
export const INT_MAX = 2147483647
export const BYTE_MIN = 0
export const BYTE_MAX = 255

export interface Param {
  type: Type
  name: Token
}

export type Stmt = BlockStmt | ExpressionStmt | IfStmt | PrintStmt | ReturnStmt | VarStmt | WhileStmt
export type TopStmt = FunctionStmt | VarStmt

export interface BlockStmt extends Node {
  kind: NodeKind.BLOCK_STMT
  statements: Stmt[]
  scope: Scope
  isLiveAtEnd: boolean | null // filled in by resolver pass
}

export function blockStmt({ statements, scope }: { statements: Stmt[]; scope: Scope }): BlockStmt {
  return {
    kind: NodeKind.BLOCK_STMT,
    statements,
    scope,
    isLiveAtEnd: null
  }
}

export interface ExpressionStmt extends Node {
  kind: NodeKind.EXPRESSION_STMT
  expression: Expr
  isLiveAtEnd: boolean | null // filled in by resolver pass
}

export function expressionStmt({ expression }: { expression: Expr }): ExpressionStmt {
  return {
    kind: NodeKind.EXPRESSION_STMT,
    expression,
    isLiveAtEnd: null
  }
}

export interface FunctionStmt extends Node {
  kind: NodeKind.FUNCTION_STMT
  name: Token
  params: Param[]
  returnType: Type
  body: Stmt[]
  scope: Scope
  symbol: FunctionSymbol | null // filled in by parser
  // After resolve pass, `hoistedLocals` should contain
  // all local variables declared in descendant scopes
  // (e.g. nested blocks) *not* including the function
  // scope itself.
  hoistedLocals: Set<VariableSymbol> | null // filled in by resolver
}

export function functionStmt(
  { name, params, returnType, body, scope, symbol }: {
    name: Token;
    params: Param[];
    returnType: Type;
    body: Stmt[];
    scope: Scope;
    symbol: FunctionSymbol | null
}): FunctionStmt {
  return {
    kind: NodeKind.FUNCTION_STMT,
    name,
    params,
    returnType,
    body,
    scope,
    symbol,
    hoistedLocals: null
  }
}

export interface IfStmt extends Node {
  kind: NodeKind.IF_STMT
  expression: Expr
  thenBranch: Stmt
  elseBranch: Stmt | null
  isLiveAtEnd: boolean | null // filled in by resolver pass
}

export function ifStmt({ expression, thenBranch, elseBranch }: { expression: Expr; thenBranch: Stmt; elseBranch: Stmt | null }): IfStmt {
  return {
    kind: NodeKind.IF_STMT,
    expression,
    thenBranch,
    elseBranch,
    isLiveAtEnd: null
  }
}

export interface PrintStmt extends Node {
  kind: NodeKind.PRINT_STMT
  keyword: Token
  expression: Expr
  isLiveAtEnd: boolean | null // filled in by resolver pass
}

export function printStmt({ expression, keyword }: { expression: Expr; keyword: Token }): PrintStmt {
  return {
    kind: NodeKind.PRINT_STMT,
    keyword,
    expression,
    isLiveAtEnd: null
  }
}

export interface ReturnStmt extends Node {
  kind: NodeKind.RETURN_STMT
  keyword: Token
  value: Expr | null
  isLiveAtEnd: boolean | null // filled in by resolver pass
}

export function returnStmt({ keyword, value }: { keyword: Token; value: Expr | null }): ReturnStmt {
  return {
    kind: NodeKind.RETURN_STMT,
    keyword,
    value,
    isLiveAtEnd: null
  }
}

export interface VarStmt extends Node {
  kind: NodeKind.VAR_STMT
  name: Token
  initializer: Expr
  type: Type | null // null means 'infer from initializer in resolver step'
  isLiveAtEnd: boolean | null // filled in by resolver pass
  symbol: VariableSymbol | null // filled in by parser
}

export function varStmt({ name, initializer, type, symbol }: { name: Token; initializer: Expr; type: Type | null; symbol: VariableSymbol | null }): VarStmt {
  return {
    kind: NodeKind.VAR_STMT,
    name,
    initializer,
    type,
    isLiveAtEnd: null,
    symbol
  }
}

export interface WhileStmt extends Node {
  kind: NodeKind.WHILE_STMT
  expression: Expr
  body: Stmt
  isLiveAtEnd: boolean | null // filled in by resolver pass
}

export function whileStmt({ expression, body }: { expression: Expr; body: Stmt }): WhileStmt {
  return {
    kind: NodeKind.WHILE_STMT,
    expression,
    body,
    isLiveAtEnd: null
  }
}

export enum SymbolKind {
  VARIABLE,
  FUNCTION,
  PARAM
}

export type Symbol = VariableSymbol | FunctionSymbol | ParamSymbol

export interface VariableSymbol {
  kind: SymbolKind.VARIABLE
  node: VarStmt
  isGlobal: boolean
  id: number
  isAddressTaken: boolean
}

export interface FunctionSymbol {
  kind: SymbolKind.FUNCTION
  node: FunctionStmt
  id: number
}

export interface ParamSymbol {
  kind: SymbolKind.PARAM
  param: Param
  id: number
  isAddressTaken: boolean
}

export class Scope {
  private readonly parent: Scope | null
  private readonly map: Map<string, Symbol>

  constructor(parent: Scope | null) {
    this.parent = parent
    this.map = new Map()
  }

  define(name: string, symbol: Symbol): void {
    this.map.set(name, symbol)
  }

  hasDirect(name: string): boolean {
    return this.map.has(name)
  }

  forEach(cb: (name: string, symbol: Symbol) => void): void {
    this.map.forEach((symbol, key) => {
      cb(key, symbol)
    })
  }

  lookup(name: string, filter: (symbol: Symbol) => boolean): Symbol | null {
    if (this.map.has(name)) {
      const symbol = this.map.get(name)!
      if (filter(symbol)) {
        return symbol
      }
    }
    if (this.parent) {
      return this.parent.lookup(name, filter)
    }
    return null
  }
}

export class Context {
  global: Scope
  stringLiterals: Map<string, LiteralExpr>
  topLevelStatements: TopStmt[]
  globalInitOrder: VarStmt[] | null // filled in by resolver

  private nextID: number = 0

  constructor(global: Scope, topLevelStatements: TopStmt[]) {
    this.global = global
    this.stringLiterals = new Map()
    this.topLevelStatements = topLevelStatements
    this.globalInitOrder = null
  }

  variableSymbol(node: VarStmt, isGlobal: boolean): VariableSymbol {
    return {
      kind: SymbolKind.VARIABLE,
      node,
      isGlobal,
      id: this.nextID++,
      isAddressTaken: false
    }
  }

  functionSymbol(node: FunctionStmt): FunctionSymbol {
    return {
      kind: SymbolKind.FUNCTION,
      node,
      id: this.nextID++
    }
  }

  paramSymbol(param: Param): ParamSymbol {
    return {
      kind: SymbolKind.PARAM,
      param,
      id: this.nextID++,
      isAddressTaken: false
    }
  }
}

function typeToSExpr(type: Type): string {
  switch (type.category) {
    case TypeCategory.ARRAY: {
      return `(arraytype ${type.length} ${typeToSExpr(type.elementType)})`
    }
    case TypeCategory.POINTER: {
      return `(ptr ${typeToSExpr(type.elementType)})`
    }
    case TypeCategory.ERROR: {
      return "<error-type>"
    }
    case TypeCategory.INT:
    case TypeCategory.FLOAT:
    case TypeCategory.BYTE:
    case TypeCategory.BOOL:
    case TypeCategory.VOID: {
      return TypeCategory[type.category].toLowerCase()
    }
  }
}

export function typeToString(type: Type): string {
  switch (type.category) {
    case TypeCategory.ARRAY: {
      return `[${typeToString(type.elementType)}; ${type.length}]`
    }
    case TypeCategory.POINTER: {
      return `${typeToString(type.elementType)}~`
    }
    case TypeCategory.ERROR: {
      return "<error-type>"
    }
    case TypeCategory.INT:
    case TypeCategory.FLOAT:
    case TypeCategory.BYTE:
    case TypeCategory.BOOL:
    case TypeCategory.VOID: {
      return TypeCategory[type.category].toLowerCase()
    }
  }
}

export function astToSExpr(node: Node): string {
  let out = ""
  switch (node.kind) {
    // expressions
    case NodeKind.ASSIGN_EXPR: {
      const op = node as AssignExpr
      out += "("
      out += `assign ${astToSExpr(op.left)} ${astToSExpr(op.right)}`
      out += ")"
      break
    }
    case NodeKind.BINARY_EXPR: {
      const op = node as BinaryExpr
      const operator = op.operator.lexeme
      out += "("
      out += `${operator} ${astToSExpr(op.left)} ${astToSExpr(op.right)}`
      out += ")"
      break
    }
    case NodeKind.CALL_EXPR: {
      const op = node as CallExpr
      out += "("
      out += `call ${astToSExpr(op.callee)} `
      out += "("
      op.args.forEach((arg, i) => {
        if (i > 0) out += " "
        out += astToSExpr(arg)
      })
      out += ")"
      out += ")"
      break
    }
    case NodeKind.CAST_EXPR: {
      const op = node as CastExpr
      out += "("
      out += `${typeToSExpr(op.type)} ${astToSExpr(op.value)}`
      out += ")"
      break
    }
    case NodeKind.DEREF_EXPR: {
      const op = node as DerefExpr
      out += `(deref ${astToSExpr(op.value)})`
      break
    }
    case NodeKind.GROUP_EXPR: {
      const op = node as GroupExpr
      out += "("
      out += astToSExpr(op.expression)
      out += ")"
      break
    }
    case NodeKind.INDEX_EXPR: {
      const op = node as IndexExpr
      out += "("
      out += `index ${astToSExpr(op.callee)} ${astToSExpr(op.index)}`
      out += ")"
      break
    }
    case NodeKind.LEN_EXPR: {
      const op = node as LenExpr
      out += `(len ${astToSExpr(op.value)})`
      break
    }
    case NodeKind.LIST_EXPR: {
      const op = node as ListExpr
      out += "("
      if (op.initializer.kind === ListKind.LIST) {
        out += "list-initializer"
        op.initializer.values.forEach((val) => {
          out += ` ${astToSExpr(val)}`
        })
      } else {
        out += `repeat-initializer ${op.initializer.length} ${astToSExpr(op.initializer.value)}`
      }
      out += ")"
      break
    }
    case NodeKind.LITERAL_EXPR: {
      const op = node as LiteralExpr
      if (op.type.category === TypeCategory.FLOAT && Number.isInteger(op.value)) {
        out += (op.value as Number).toFixed(1)
      } else {
        out += JSON.stringify(op.value)
      }
      break
    }
    case NodeKind.LOGICAL_EXPR: {
      const op = node as LogicalExpr
      const operator = op.operator.lexeme
      out += "("
      out += `${operator} ${astToSExpr(op.left)} ${astToSExpr(op.right)}`
      out += ")"
      break
    }
    case NodeKind.UNARY_EXPR: {
      const op = node as UnaryExpr
      const operator = op.operator.lexeme
      out += "("
      out += `${operator} ${astToSExpr(op.value)}`
      out += ")"
      break
    }
    case NodeKind.VARIABLE_EXPR: {
      const op = node as VariableExpr
      out += op.name.lexeme
      break
    }

    // statements
    case NodeKind.BLOCK_STMT: {
      const op = node as BlockStmt
      out += "("
      out += "block "
      op.statements.forEach((stmt, i) => {
        if (i > 0) out += " "
        out += astToSExpr(stmt)
      })
      out += ")"
      break
    }
    case NodeKind.EXPRESSION_STMT: {
      const op = node as ExpressionStmt
      out += astToSExpr(op.expression)
      break
    }
    case NodeKind.FUNCTION_STMT: {
      const op = node as FunctionStmt
      out += "("
      out += `def ${op.name.lexeme} `
      out += "("
      op.params.forEach((param, i) => {
        if (i > 0) out += " "
        out += `(param ${param.name.lexeme} ${typeToSExpr(param.type)})`
      })
      out += ") "
      out += "("
      op.body.forEach((stmt, i) => {
        if (i > 0) out += " "
        out += astToSExpr(stmt)
      })
      out += ")"
      out += ")"
      break
    }
    case NodeKind.IF_STMT: {
      const op = node as IfStmt
      out += "("
      out += `if ${astToSExpr(op.expression)} ${astToSExpr(op.thenBranch)} `
      if (op.elseBranch !== null) {
        out += `${astToSExpr(op.elseBranch)} `
      }
      out += ")"
      break
    }
    case NodeKind.PRINT_STMT: {
      const op = node as PrintStmt
      out += "("
      out += `print ${astToSExpr(op.expression)}`
      out += ")"
      break
    }
    case NodeKind.RETURN_STMT: {
      const op = node as ReturnStmt
      out += "("
      out += `return ${op.value !== null ? astToSExpr(op.value) : "void"}`
      out += ")"
      break
    }
    case NodeKind.VAR_STMT: {
      const op = node as VarStmt
      out += "("
      out += `var ${op.name.lexeme} `
      if (op.type !== null) {
        out += `${typeToSExpr(op.type)} `
      }
      out += `${astToSExpr(op.initializer)}`
      out += ")"
      break
    }
    case NodeKind.WHILE_STMT: {
      const op = node as WhileStmt
      out += "("
      out += `while ${astToSExpr(op.expression)} ${astToSExpr(op.body)}`
      out += ")"
      break
    }
    default: {
      assertUnreachable(node.kind)
    }
  }
  return out
}
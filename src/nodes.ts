import { Token } from './scanner'

export enum NodeKind {
  // expressions
  ASSIGN_EXPR,
  BINARY_EXPR,
  CALL_EXPR,
  CAST_EXPR,
  GROUP_EXPR,
  INDEX_EXPR,
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

export type Expr = AssignExpr | BinaryExpr | CallExpr | CastExpr | GroupExpr | IndexExpr | LiteralExpr | LogicalExpr | UnaryExpr | VariableExpr

export interface AssignExpr extends Node {
  kind: NodeKind.ASSIGN_EXPR
  left: IndexExpr | VariableExpr
  right: Expr
}

export interface BinaryExpr extends Node {
  kind: NodeKind.BINARY_EXPR
  left: Expr
  operator: Token
  right: Expr
}

export interface CallExpr extends Node {
  kind: NodeKind.CALL_EXPR
  callee: Expr
  paren: Token
  args: Expr[]
}

export interface CastExpr extends Node {
  kind: NodeKind.CAST_EXPR
  type: Type
  value: Expr
}

export interface GroupExpr extends Node {
  kind: NodeKind.GROUP_EXPR
  expression: Expr
}

export interface IndexExpr extends Node {
  kind: NodeKind.INDEX_EXPR
  callee: Expr
  bracket: Token
  index: Expr
}

export interface LiteralExpr extends Node {
  kind: NodeKind.LITERAL_EXPR
  value: any
  type: Type
}

export interface LogicalExpr extends Node {
  kind: NodeKind.LOGICAL_EXPR
  left: Expr
  operator: Token
  right: Expr
}

export interface UnaryExpr extends Node {
  kind: NodeKind.UNARY_EXPR
  operator: Token
  right: Expr
}

export interface VariableExpr extends Node {
  kind: NodeKind.VARIABLE_EXPR
  name: Token
}

export enum TypeCategory {
  ARRAY,
  INT,
  FLOAT,
  BYTE,
  BOOL,
  VOID
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

interface SimpleType {
  category: TypeCategory.VOID | TypeCategory.INT | TypeCategory.FLOAT | TypeCategory.BYTE | TypeCategory.BOOL
}

interface ArrayType {
  category: TypeCategory.ARRAY
  elementType: Type
  length: number
}

export type Type = ArrayType | SimpleType

export interface Param {
  type: Type
  name: Token
}

export type Stmt = BlockStmt | ExpressionStmt | IfStmt | PrintStmt | ReturnStmt | VarStmt | WhileStmt
export type TopStmt = FunctionStmt | VarStmt

export interface BlockStmt extends Node {
  kind: NodeKind.BLOCK_STMT
  statements: Stmt[]
}

export interface ExpressionStmt extends Node {
  kind: NodeKind.EXPRESSION_STMT
  expression: Expr
}

export interface FunctionStmt extends Node {
  kind: NodeKind.FUNCTION_STMT
  name: Token
  params: Param[]
  returnType: Type
  body: Stmt[]
}

export interface IfStmt extends Node {
  kind: NodeKind.IF_STMT
  expression: Expr
  thenBranch: Stmt
  elseBranch: Stmt | null
}

export interface PrintStmt extends Node {
  kind: NodeKind.PRINT_STMT
  expression: Expr
}

export interface ReturnStmt extends Node {
  kind: NodeKind.RETURN_STMT
  keyword: Token
  value: Expr | null
}

export interface VarStmt extends Node {
  kind: NodeKind.VAR_STMT
  name: Token
  initializer: Expr
  type: Type | null // null means 'infer from initializer'
}

export interface WhileStmt extends Node {
  kind: NodeKind.WHILE_STMT
  expression: Expr
  body: Stmt
}

function typeToSExpr(type: Type): string {
  let out = ""
  switch (type.category) {
    case TypeCategory.ARRAY: {
      out += "("
      out += `arraytype ${type.length} ${typeToSExpr(type.elementType)}`
      out += ")"
      break
    }
    case TypeCategory.INT:
    case TypeCategory.FLOAT:
    case TypeCategory.BYTE:
    case TypeCategory.BOOL:
    case TypeCategory.VOID: {
      out = TypeCategory[type.category].toLowerCase()
      break
    }
  }
  return out
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
      out += `${operator} ${astToSExpr(op.right)}`
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
  }
  return out
}
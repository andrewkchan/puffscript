import fs from 'fs'
import * as child_process from 'child_process'
import { scanTokens } from './src/scanner'
import { parse } from './src/parser'
import { ReportError } from './src/util'
import * as ast from './src/nodes'
import { TokenType } from './src/tokens'

describe("basic WASM test", () => {
  test("adds input numbers", async () => {
    fs.writeFileSync(
      "test/basic.wat",
      `
      (module
        (func (export "add") (param i32 i32) (result i32)
          local.get 0
          local.get 1
          i32.add))
      `.trim()
    )
    child_process.execSync(`npx -p wabt wat2wasm test/basic.wat -o test/basic.wasm`)
    const instance = await WebAssembly.instantiate(fs.readFileSync("test/basic.wasm"), {})
    expect(instance.instance.exports.add(1, 2)).toBe(3)
  })
})

describe("parser", () => {
  function expectAST(source: string, expected: string) {
    source = source.trim()
    const errors: string[] = []
    const reportError: ReportError = (line, msg) => {
      errors.push(`${line}: ${msg}`)
    }

    const tokens = scanTokens(source, reportError)
    const output = parse(tokens, reportError)

    let sexpr = "("
    output.topLevelStatements.forEach((stmt, i) => {
      if (i > 0) sexpr += " "
      sexpr += ast.astToSExpr(stmt)
    })
    sexpr += ")"
    expect(sexpr).toEqual(expected)
    expect(errors).toEqual([])
  }
  function expectErrors(source: string, expectedErrors: string[]) {
    source = source.trim()
    const errors: string[] = []
    const reportError: ReportError = (line, msg) => {
      errors.push(`${line}: ${msg}`)
    }

    const tokens = scanTokens(source, reportError)
    
    for (const token of tokens) {
      if (token.type == TokenType.IDENTIFIER && token.lexeme === "int") {
        console.log(token.lineStr())
      }
    }

    parse(tokens, reportError)
    expect(errors).toEqual(expectedErrors)
  }

  test("top-level statements", () => {
    expectAST(`
    var a = 1;
    var b = 2;
    def foo(x int, y byte) int {}
    var c = true;
    def bar(z bool) {}
    var d = 5.0;
    def main() {}
    var e = -4.0;
    `,
    "(" + 
      "(var a 1) " + 
      "(var b 2) " + 
      "(def foo ((param x int) (param y byte)) ()) " + 
      "(var c true) " + 
      "(def bar ((param z bool)) ()) " + 
      "(var d 5.0) " + 
      "(def main () ()) " + 
      "(var e (- 4.0))" + 
    ")")
  })

  test("operator precedence", () => {
    expectAST(`
    var a = 1 + 2 * -(3.5 - -7.0) / (float(1) + 5.) == int(5.0) > -4 || x && !!foo(bar(x, y), foo() && bar());
    `,
    "(" + 
      "(var a " + 
        "(|| " + 
          "(== " + 
            "(+ " +
              "1 " +
              "(/ " + 
                "(* " + 
                  "2 " + 
                  "(- ((- 3.5 (- 7.0))))" + 
                ") " +
                "((+ (float 1) 5.0))" + 
              ")" + 
            ") " +
            "(> (int 5.0) (- 4))" + 
          ") " + 
          "(&& " + 
            "x " + 
            "(! (! " + 
              "(call " + 
                "foo " + 
                "(" + 
                  "(call bar (x y)) " + 
                  "(&& " + 
                    "(call foo ()) " + 
                    "(call bar ())" + 
                  ")" + 
                ")" + 
              ")" + 
            "))" + 
          ")" + 
        ")" + 
      ")" + 
    ")")
  })

  test("operator associativity", () => {
    expectAST(`
    var a = 1 + 2 - 3 + 4 - 5;
    `,
    "(" + 
      "(var a " + 
        "(- " + 
          "(+ " + 
            "(- (+ 1 2) 3) " +
            "4" +
          ") " + 
          "5"+ 
        ")" +
      ")" +
    ")")

    expectAST(`
    var a = 1 * 2 / 3 * 4 / 5;
    `,
    "(" + 
      "(var a " + 
        "(/ " + 
          "(* " + 
            "(/ (* 1 2) 3) " +
            "4" +
          ") " + 
          "5"+ 
        ")" +
      ")" +
    ")")
  })

  test("Function definitions", () => {
    expectErrors(`
    def foo {}
    def foo() void {}
    def foo() blabla {}
    def foo(a, b) {}
    def foo(a int, b int) int;
    def foo(a int, b int) int {}
    def foo(a int, b int) int {
      print 3.14159265358979626;
    `,
    [
      "1: Expect '(' after function name.",
      "2: Invalid type specifier starting at 'void'.",
      "3: Invalid type specifier starting at 'blabla'.",
      "4: Invalid type specifier starting at ','.",
      "5: Expect '{' before function body.",
      "8: Expect '}' after block."
    ])

    // If we ever add nested functions, can remove this test
    expectErrors(`
    def foo() {
      def bar() {}
      print 123;
    }
    `,
    [
      "2: Expect expression."
    ])
  })

  test("Variable declaration outside block", () => {
    expectErrors(`
    var allowed1 = 1;
    def foo() {
      var allowed2 = 2;
      if (true) {
        var allowed3 = 3;
      } else var notAllowed1 = 1;
      if (true) var notAllowed2 = 2;
    }
    `,
    [
      "6: Expect expression.",
      "7: Expect expression."
    ])
  })

  test("Function call syntax", () => {
    expectErrors(`
    def main() {
      foo(x 1);
      foo(x,1;
      foo(x,1);
      foo(bar(x), foobar(1 + 2) * 3);
      // if we add first-class functions, this is not an error
      foo(x,1)();
    }
    `,
    [
      "2: Expect ',' between arguments.",
      "3: Expect ',' between arguments.",
      "7: Expect ';' after expression statement."
    ])
  })

  test("Duplicate symbol declaration", () => {
    expectErrors(`
    var a = 1;
    var b = 2;
    var a = b;
    `,
    [
      "3: 'a' is already declared in this scope."
    ])

    expectErrors(`
    var a = 1;
    var b = 2;
    def foo() {
      var a = b;
      var b = 3.14;
      {
        var a = b;
        var b = 42;
        var b = 42;
      }
    }
    def bar() {
      var a = -1;
      var b = 1337;
      var a = 0;
    }
    `,
    [
      "9: 'b' is already declared in this scope.",
      "15: 'a' is already declared in this scope."
    ])

    expectErrors(`
    def foo(a int, b int, a int) {}
    `,
    [
      "1: 'a' is already declared in this scope."
    ])
  })
})
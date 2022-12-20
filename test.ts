import fs from 'fs'
import * as child_process from 'child_process'
import { scanTokens } from './src/scanner'
import { parse } from './src/parser'
import { ReportError } from './src/util'
import * as ast from './src/nodes'

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
  function expectAST(source: string, expected: string, expectedErrors?: string[]) {
    source = source.trim()
    expectedErrors = expectedErrors || []
    const errors: any[] = []
    const reportError: ReportError = (line, msg) => {
      errors.push({line, msg})
    }

    const tokens = scanTokens(source, reportError)
    const output = parse(tokens, reportError)

    expect(errors).toEqual(expectedErrors)

    let sexpr = "("
    output.topLevelStatements.forEach((stmt, i) => {
      if (i > 0) sexpr += " "
      sexpr += ast.astToSExpr(stmt)
    })
    sexpr += ")"
    expect(sexpr).toEqual(expected)
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
})
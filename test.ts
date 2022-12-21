import fs from 'fs'
import * as child_process from 'child_process'
import { scanTokens } from './src/scanner'
import { parse } from './src/parser'
import { resolve } from './src/resolver'
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

enum Passes {
  SCAN =            1 << 0,
  PARSE =           1 << 1,
  RESOLVE =         1 << 2,
  THROUGH_PARSE =   SCAN | PARSE,
  THROUGH_RESOLVE = SCAN | PARSE | RESOLVE
}

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
function expectErrors(source: string, expectedErrors: string[], passes: Passes) {
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

  if (errors.length == 0 && (passes & Passes.PARSE)) {
    const context = parse(tokens, reportError)
    if (errors.length == 0 && (passes & Passes.RESOLVE)) {
      resolve(context, reportError)
    }
  }
  expect(errors).toEqual(expectedErrors)
}
describe("parser", () => {
  const expectParseErrors = (source: string, expectedErrors: string[]) => expectErrors(source, expectedErrors, Passes.THROUGH_PARSE)
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
    expectParseErrors(`
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
    expectParseErrors(`
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
    expectParseErrors(`
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
    expectParseErrors(`
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
    expectParseErrors(`
    var a = 1;
    var b = 2;
    var a = b;
    `,
    [
      "3: 'a' is already declared in this scope."
    ])

    expectParseErrors(`
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

    expectParseErrors(`
    def foo(a int, b int, a int) {}
    `,
    [
      "1: 'a' is already declared in this scope."
    ])
  })
})

describe("type checking", () => {
  const expectResolveErrors = (source: string, expectedErrors: string[]) => expectErrors(source, expectedErrors, Passes.THROUGH_RESOLVE)
  
  test("Operators", () => {
    expectResolveErrors(`
    var u = 1.0 == false;
    var v = -true;
    var w = !1.5;
    var x = 1 + true;
    var y = true / false;
    var z = true > false;
    // ok
    var a = 1.0 == 0.5;
    var b = -1;
    var c = !false;
    var d = 1 + 2;
    var e = 1.0 / 2.0;
    var f = 1.0 > 2.0;
    `,
    [
      "1: Cannot compare float to bool.",
      "2: Unary operator '-' requires int or float operand.",
      "3: Unary operator '!' requires bool operand.",
      "4: Invalid operand types for binary operator '+'.",
      "5: Invalid operand types for binary operator '/'.",
      "6: Invalid operand types for binary operator '>'."
    ])
  })

  test("Variable type annotation", () => {
    expectResolveErrors(`
    def returnsInt() int {
      return 42;
    }
    var x int = true;
    var y bool = 5.0;
    var z bool = returnsInt();
    `,
    [
      "4: Cannot assign value of type 'bool' to variable of type 'int'.",
      "5: Cannot assign value of type 'float' to variable of type 'bool'.",
      "6: Cannot assign value of type 'int' to variable of type 'bool'."
    ])
  })

  test("Type inference from initializer", () => {
    expectResolveErrors(`
    var x = 5;
    var y int = x;
    def foo() int {
      return 1;
    }
    var z = foo();
    var p = z;
    def bar(x int) {
      print x;
    }
    def main() {
      bar(z);
      bar(p);
    }
    `,
    [/* no errors*/])
  })
  
  test("Parameter mismatch", () => {
    expectResolveErrors(`
    def foo(x int, y int) {}
    def main() {
      foo(1, 2); // ok
      foo(1);
      foo(true, false);
    }
    `,
    [
      "4: Expected 2 arguments but got 1 in call to foo.",
      "5: Expected type 'int' but got 'bool' in call to foo.",
      "5: Expected type 'int' but got 'bool' in call to foo."
    ])
  })

  test("Non-callable symbol", () => {
    expectResolveErrors(`
    var foo = 1;
    def main() {
      foo();
      bar();
    }
    `,
    [
      "3: Cannot call this type.",
      "4: Undefined symbol 'bar'."
    ])
  })

  test("Return type mismatch", () => {
    expectResolveErrors(`
    def foo() {
      return 1;
    }
    def bar(x bool) int {
      if (x) {
        return 1;
      }
      return false;
    }
    def returnsFloat() float { return 5.0; }
    def foobar(x bool) bool {
      if (x) {
        return;
      }
      return returnsFloat();
    }
    `,
    [
      "2: Expected a value of type 'void'.",
      "8: Expected a value of type 'int'.",
      "13: Expected a value of type 'bool'.",
      "15: Expected a value of type 'bool'."
    ])
  })

  test("Missing return", () => {
    expectResolveErrors(`
    def foo() {
      print 1337;
      // ok to not return
    }
    def foo2() int {
      print 1337;
      // missing return
    }
    def bar(x bool) int {
      if (x) {
        return 1;
      } else {
        return 0;
      }
      // all paths satisfied
    }
    def bar2(x bool, y bool) int {
      if (x && y) {
        return 1;
      } else if (!x && !y) {
        return 2;
      }
      // missing return
    }
    def bar3(x bool, y bool) int {
      if (x && y) {
        return 1;
      }
      print x;
      if (x) {
        return 2;
      } else {
        return 3;
      }
      // all paths satisfied
    }
    `,
    [
      "5: All control paths for foo2 must return a value of type 'int'.",
      "17: All control paths for bar2 must return a value of type 'int'."
    ])
  })
})
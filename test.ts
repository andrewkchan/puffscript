import fs from 'fs'
import * as child_process from 'child_process'
import { scanTokens } from './src/scanner'
import { parse } from './src/parser'
import { resolve } from './src/resolver'
import { emit } from './src/backend'
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
function expectErrors(source: string, expectedErrors: string[], passes: Passes): ast.Context | null {
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

  let context: ast.Context | null = null
  if (errors.length == 0 && (passes & Passes.PARSE)) {
    context = parse(tokens, reportError)
    if (errors.length == 0 && (passes & Passes.RESOLVE)) {
      resolve(context, reportError)
    }
  }
  expect(errors).toEqual(expectedErrors)
  return context
}
async function expectOutput(source: string, expectedOutput: string) {
  const context = expectErrors(source, [], Passes.THROUGH_RESOLVE)
  if (context) {
    const code = emit(context)
    fs.writeFileSync("test/tmp.wat", code)
    child_process.execSync(`npx -p wabt wat2wasm test/tmp.wat -o test/tmp.wasm`)
    let output = ""
    const instance = await WebAssembly.instantiate(fs.readFileSync("test/tmp.wasm"), {
      console: {
        log: (x: any) => {
          output += x + "\n"
        }
      }
    })
    instance.instance.exports.__init_globals__()
    instance.instance.exports.main()
    expect(output).toBe(expectedOutput)
  }
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

  test("Return from void function", () => {
    expectResolveErrors(`
    def foobar() {
      return 1; // error
    }
    def foo() {
      print 1234;
      return;
    }
    def bar(x int) {
      if (x) {
        return;
      }
      foo();
    }
    `,
    [
      "2: Expected a value of type 'void'."
    ])
  })

  test("Global scope", () => {
    expectResolveErrors(`
    // ok for dependent globals to be declared out-of-order
    var x = y;
    var y = 1;
    // undeclared symbol is still an error
    var z1 = missing;
    var z2 = x * (y - missing);
    // missing global is reported in function body
    def foo() int {
      missing = 5; // implicit declaration not allowed
      return missing;
    }
    var z3 = foo();
    `,
    [
      "5: Undefined symbol 'missing'.",
      "6: Undefined symbol 'missing'.",
      "6: Invalid operand types for binary operator '-'.",
      "9: Undefined symbol 'missing'.",
      "9: Invalid operand types for assignment operator '='.",
      "10: Undefined symbol 'missing'.",
      "10: Expected a value of type 'int'.",
    ])
  })

  test("Function scope", () => {
    expectResolveErrors(`
    def inner(outerAndInnerParam bool, innerParam int) {
      var inner1 = 1;
      var outerAndInner = true;
      // cannot refer to vars declared only inside outer
      print outerBeforeInner;
      print outerParam;
      // ok
      print inner1;
      // wrong type
      print outerAndInner == 1.5;
      print outerAndInnerParam == 0.99;
      // ok
      print outerAndInner == true;
      print outerAndInnerParam == true;
    }
    def outer(outerAndInnerParam float, outerParam int) {
      var outerAndInner = 1.5;
      var outerBeforeInner = 1;
      inner(true, 2);
      // cannot refer to vars declared only inside inner
      print inner1;
      print innerParam;
      // ok
      print outerBeforeInner;
      // ok
      var outerAfterInner = 2;
      print outerAfterInner;
      // ok
      print outerAndInner == 1.5;
      print outerAndInnerParam == 0.99;
      // wrong type
      print outerAndInner == true;
      print outerAndInnerParam == true;
    }
    `,
    [
      "5: Undefined symbol 'outerBeforeInner'.",
      "6: Undefined symbol 'outerParam'.",
      "10: Cannot compare bool to float.",
      "11: Cannot compare bool to float.",
      "21: Undefined symbol 'inner1'.",
      "22: Undefined symbol 'innerParam'.",
      "32: Cannot compare float to bool.",
      "33: Cannot compare float to bool."
    ])
  })

  test("Block scope", () => {
    expectResolveErrors(`
    def main() {
      var a = 5.0;
      var b = 2.0;
      print a == true; // wrong type
      print a == 5.0; // ok
      print x; // undefined symbol
      {
        var a = true;
        var x = b;
        print a == true; // ok
        print a == 5.0; // wrong type
        print x; // ok
        print x == b; // ok
        print x == 5.0; // ok
        print x == a; // wrong type
      }
      print a == true; // wrong type
      print a == 5.0; // ok
      print x; // undefined symbol
    }
    `,
    [
      "4: Cannot compare float to bool.",
      "6: Undefined symbol 'x'.",
      "11: Cannot compare bool to float.",
      "15: Cannot compare float to bool.",
      "17: Cannot compare float to bool.",
      "19: Undefined symbol 'x'.",
    ])
  })

  test("Lexical scope", () => {
    expectResolveErrors(`
    def main() {
      var a = 1;
      var b = c; // error to reference locals out-of-order
      var c = a; // ok
      {
        var x = a; // ok
        var y = d; // error
        var z = x; // ok
      }
      var d = c; // ok
      {
        var p = x; // error
        var q = d; // ok
        var r = c; // ok
      }
    }
    `,
    [
      "3: Undefined symbol 'c'.",
      "7: Undefined symbol 'd'.",
      "12: Undefined symbol 'x'."
    ])
  })

  test("Lexical scope 2", () => {
    expectResolveErrors(`
    def main() {
      var a = 1.5;
      {
        print a == true; // error
        var a = true;
        print a == true; // ok
      }
    }
    `,
    [
      "4: Cannot compare float to bool."
    ])
  })

  test("Scope change due to out-of-order resolution", () => {
    expectResolveErrors(`
    def foo(y int) int {
      var localAndGlobal = true;
      var local = 1;
      var x = globalVar1 + y;
      var z = globalVar2;
      if (globalVar3) {
        return x + y;
      }
      return x + z;
    }
    var globalVar1 = int(y);
    var globalVar2 = int(local);
    var globalVar3 = localAndGlobal == 3.14;
    var localAndGlobal = 3.14;
    `,
    [
      "11: Undefined symbol 'y'.",
      "12: Undefined symbol 'local'."
    ])
  })

  test("Cyclic variable declaration", () => {
    expectResolveErrors(`
    var x = x;
    var y = z;
    var z = y;
    var a = foo();
    def foo() int {
      return bar();
    }
    def bar() int {
      return int(b);
    }
    var b = int(a);
    var p = foobar();
    def foobar() int {
      return int(q);
    }
    var q = foobar();
    def getGlobalG() int {
      return g;
    }
    var g = 1337;
    def main() {
      var g = getGlobalG(); // ok
    }
    `,
    [
      "1: Declaration of 'x' is cyclic. Defined here:\n" +
      "var x = x;\n" +
      "    ^",
      "2: Declaration of 'y' is cyclic. Defined here:\n" +
      "    var y = z;\n" +
      "        ^",
      "4: Declaration of 'a' is cyclic. Defined here:\n" +
      "    var a = foo();\n" +
      "        ^",
      "16: Declaration of 'q' is cyclic. Defined here:\n" +
      "    var q = foobar();\n" +
      "        ^"
    ])
  })

  test("Cyclic variable declaration inside block", () => {
    expectResolveErrors(`
    def main() {
      var a = 1;
      {
        var a = a; // --> error!
      }
    }
    `,
    [
      "4: Declaration of 'a' is cyclic. Defined here:\n" +
      "        var a = a; // --> error!\n" +
      "            ^"
    ])
  })

  test("Recursive functions", () => {
    expectResolveErrors(`
    def fib(n int) int {
      if (n <= 1) {
        return 1;
      }
      return fib(n-1) + fib(n-2);
    }
    def isEven(n int) bool {
      if (n == 0) {
        return true;
      }
      return !isOdd(n-1);
    }
    def isOdd(n int) bool {
      if (n == 1) {
        return true;
      }
      return !isEven(n-1);
    }
    `, 
    [/* no errors */])
  })

  test("Cyclic variable declaration with mutually recursive functions", () => {
    expectResolveErrors(`
    def foo(p int) int {
      if (p == 0) {
        return x;
      }
      return bar(p-1);
    }
    var x = int(bar(1));
    def bar(p int) int {
      return foo(p-1);
    }
    `,
    [
      "7: Declaration of 'x' is cyclic. Defined here:\n" +
      "    var x = int(bar(1));\n" +
      "        ^"
    ])
  })

  test("Valid variable declaration with mutually recursive functions", () => {
    expectResolveErrors(`
    var x = isEven(100);
    def isEven(n int) bool {
      if (n == 0) {
        return true;
      }
      return !isOdd(n-1);
    }
    def isOdd(n int) bool {
      if (n == 1) {
        return true;
      }
      return !isEven(n-1);
    }
    `,
    [/* no errors */])
  })
})

describe("end to end", () => {
  test("print", async () => {
    await expectOutput(`
    def main() {
      var bt = byte(256 + 42);
      var bl = true;
      var i = 256 + 42;
      var f = 3.1415927410125732;
      print bt;
      print bl;
      print i;
      print f;
    }
    `,
    `
42
1
298
3.1415927410125732
`.trim() + "\n")
  })

  test("int operators", async () => {
    await expectOutput(`
    def main() {
      print -5;

      print 5+3;
      print 5-3;
      print 5*3;
      print 5/3;

      print 5==3;
      print 5==5;
      print 5!=3;
      print 5>3;
      print 5>=3;
      print 5<3;
      print 5<=3;
    }
    `,
    `
-5
8
2
15
1
0
1
1
1
1
0
0
`.trim() + "\n")
  })

  test("float operators", async () => {
    await expectOutput(`
    def main() {
      print -5.5;

      print 5.5+3.0;
      print 5.5-3.0;
      print 5.5*3.0;
      print 5.0/3.0;

      print 5.0==3.0;
      print 5.0==5.0;
      print 5.0!=3.0;
      print 5.0>3.0;
      print 5.0>=3.0;
      print 5.0<3.0;
      print 5.0<=3.0;
    }
    `,
    `
-5.5
8.5
2.5
16.5
1.6666666269302368
0
1
1
1
1
0
0
`.trim() + "\n")
  })

  test("bool operators", async () => {
    await expectOutput(`
    def main() {
      print !true;
      print !false;
      print true && true;
      print true && false;
      print false && true;
      print false && false;
      print true || true;
      print true || false;
      print false || true;
      print false || false;
      print true == true;
      print true == false;
      print false == true;
      print false == false;
    }
    `,
    `
0
1
1
0
0
0
1
1
1
0
1
0
0
1
`.trim() + "\n")
  })

  test("add", async () => {
    await expectOutput(`
    def add(x int, y int) int {
      return x + y;
    }
    def main() {
      print add(42, -1337);
    }
    `,
    `
-1295
`.trim() + "\n")
  })

  test("fib", async () => {
  await expectOutput(`
  def fib(n int) int {
    if (n <= 0) {
      return 0;
    } else if (n == 1) {
      return 1;
    }
    return fib(n-1) + fib(n-2);
  }
  def main() {
    print fib(0);
    print fib(1);
    print fib(2);
    print fib(3);
    print fib(4);
    print fib(5);
    print fib(6);
  }
  `,
  `
0
1
1
2
3
5
8
`.trim() + "\n")
  })

  test("iterative factorial", async () => {
    await expectOutput(`
    def factorial(n int) int {
      var result = 1;
      while (n > 0) {
        result = result * n;
        n = n - 1;
      }
      return result;
    }
    def main() {
      print factorial(0);
      print factorial(3);
      print factorial(5);
    }
    `,
    `
1
6
120
`.trim() + "\n")
  })

  test("lexical scope", async () => {
    await expectOutput(`
    var a = 1;
    var b = 2;
    var c = 3;
    def printGlobals() {
      print a;
      print b;
      print c;
    }
    def incGlobals() {
      a = a + 1;
      b = b + 1;
      c = c + 1;
    }
    def main() {
      print a; // 1
      print b; // 2
      print c; // 3
      var a = 10;
      var b = 20;
      {
        print a; // 10
        var a = 100;
        b = b + 1;
        print a; // 100
        print b; // 21
        print c; // 3
      }
      print a; // 10
      print b; // 21
      print c; // 3
      b = b + 1;
      print b; // 22
      printGlobals();
      incGlobals();
      printGlobals();
    }
    `,
    `
1
2
3
10
100
21
3
10
21
3
22
1
2
3
2
3
4
  `.trim() + "\n")
  })

  test("global initializers 1", async () => {
    await expectOutput(`
    var y = add(10, x);
    var x = add(12, 34);
    def add(x int, y int) int {
      return x + y;
    }
    def main() {
      print x;
      print y;
    }
    `,
    `
46
56
`.trim() + "\n")
  })
})
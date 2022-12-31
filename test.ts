import fs from 'fs'
import * as child_process from 'child_process'
import { scanTokens } from './src/scanner'
import { parse } from './src/parser'
import { resolve } from './src/resolver'
import { emit } from './src/backend'
import { ReportError, UTF8Codec } from './src/util'
import * as ast from './src/nodes'
import { TokenType } from './src/tokens'

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
  console.log(tokens.map(t=>t.toString()))

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

    const codec = new UTF8Codec()
    let ioBuffer = ""
    let output = ""

    const instance = await WebAssembly.instantiate(fs.readFileSync("test/tmp.wasm"), {
      io: {
        log: (x: any) => {
          output += x + "\n"
        },
        putchar: (x: number) => {
          ioBuffer += codec.decodeASCIIChar(x)
        },
        putf: (x: number) => {
          ioBuffer += x
        },
        puti: (x: number) => {
          ioBuffer += x
        },
        flush: () => {
          output += ioBuffer + "\n"
          ioBuffer = ""
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

  test("Loop syntax", () => {
    expectParseErrors(`
    def main() {
      while (foo() == bar()) loop(); // ok
      while (foo() == bar()) { // ok
        loop();
      }
      while (var i = 0) loop(); // error
      while () loop(); // error
      for (;;) loop(); // ok
      for (;;) { // ok
        loop();
      }
      for (var p = n; p != end; p = next(n)) loop(); // ok
      for (var p = n;;) loop(); // ok
      for (; p != end;) loop(); // ok
      for (;; p = next(n)) loop(); // ok
      for (var p = n; var q = n; p = next(n)) loop(); // error
    }
    `,
    [
      "6: Expect expression.",
      "7: Expect expression.",
      "16: Expect expression.",
      // TODO: silence extra error, e.g. with a for loop error production
      "16: Expect ';' after expression statement."
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

  test("Invalid assignment target", () => {
    expectParseErrors(`
    def foo() int {
      return 1;
    }
    def main() {
      var a = 0;
      var y = true;
      var z = [1, 2, 3];
      var p = &a;
      2 = a; // error
      foo() = a; // error
      &a = p; // error
      false = y; // error
      [4, 5, 6] = z; // error
    }
    `,
    [
      "9: Invalid assignment target.",
      "10: Invalid assignment target.",
      "11: Invalid assignment target.",
      "12: Invalid assignment target.",
      "13: Invalid assignment target."
    ])
  })

  test("Hex literals", () => {
    expectParseErrors(`
    var x = 0xAABBCCDD; // ok
    var y = 0xAAABBCCDD; // error
    `,
    [
      "2: Hex literal does not fit in any numeric type.",
    ])
  })
})

describe("type checking", () => {
  const expectResolveErrors = (source: string, expectedErrors: string[]) => expectErrors(source, expectedErrors, Passes.THROUGH_RESOLVE)

  test("Operators", () => {
    expectResolveErrors(`
    var u = 1.0 == false;
    var v = -true;
    var w = !1.5; // ok
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

    var g = 5 % 2;
    var h = 5 % -2;
    var i = 5.0 % -2.0; // err
    `,
    [
      "1: Cannot compare float to bool.",
      "2: Invalid operand type for unary operator '-'.",
      "4: Invalid operand types for binary operator '+'.",
      "5: Invalid operand types for binary operator '/'.",
      "6: Invalid operand types for binary operator '>'.",
      "17: Invalid operand types for binary operator '%'."
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
      "5: Cannot implicitly convert operand to 'int'.",
      "5: Cannot implicitly convert operand to 'int'.",
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

  test("For loop scope", () => {
    expectResolveErrors(`
    def main() {
      {
        var i = 1337;
        for (var i = 0; i < 3; i = i + 1) {
          print i;
        }
      }
      for (var i = 0; i < 3; i = i + 1) {
        print i;
      }
      print i; // error
    }
    `,
    [
      "11: Undefined symbol 'i'."
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

  test("Array literals", () => {
    expectResolveErrors(`
    var a = [1, 2, 3]; // ok
    var b [int; 3] = [1, 2, 3]; // ok
    var c = [1, 2, true]; // err
    var d = [1+2+3; 5]; // ok
    var e [int; 5] = [1+2+3; 5]; // ok
    var f [bool; 5] = [1+2+3; 5]; // err
    var g = [[1, 2, 3], [4, 5, 6]]; // ok
    var h [[int; 3]; 2] = [[1, 2, 3], [4, 5, 6]]; // ok
    var i = [[1, 2], [1]]; // err
    var j = []; // err
    var k [int; 0] = []; // err
    var l = [-1; 0]; // err
    var m = [foo(), foo()]; // err
    def foo() {}
    `,
    [
      "3: Cannot infer type for literal.",
      "6: Cannot assign value of type '[int; 5]' to variable of type '[bool; 5]'.",
      "9: Cannot infer type for literal.",
      "10: Zero-length arrays are not allowed.",
      "11: Zero-length arrays are not allowed.",
      "12: Zero-length arrays are not allowed.",
      "13: Cannot infer type for literal."
    ])
  })

  test("Array operations", () => {
    expectResolveErrors(`
    var arr = [1, 2, 3];
    var x = arr[0]; // ok
    var y = arr[1+1]; // ok
    var z = arr[3.14]; // err
    var p int = len(arr); // ok
    `,
    [
      "4: Index operator requires int or byte type."
    ])
  })

  test("N-D array operations", () => {
    expectResolveErrors(`
    def main() {
      var arr = [[1, 2, 3], [4, 5, 6]]; // ok
      var x1 [int; 3] = arr[0]; // ok
      var x2 int = arr[0]; // err
      var y1 [int; 3] = arr[1+1][0]; // err
      var y2 int = arr[1+1][0]; // ok
      var p int = len(arr); // ok
      var q int = len(arr[0]); // ok
      arr[0] = [7, 8, 9]; // ok
      arr[0] = [1, 2]; // err
    }
    `,
    [
      "4: Cannot assign value of type '[int; 3]' to variable of type 'int'.",
      "5: Cannot assign value of type 'int' to variable of type '[int; 3]'.",
      "10: Cannot implicitly convert operand to '[int; 3]'."
    ])
  })

  test("assign pointer to non-address", () => {
    expectResolveErrors(`
    def main() {
      var p int~ = 1;
    }
    `,
    [
      "2: Cannot assign value of type 'int' to variable of type 'int~'.",
    ])
  })

  test("address-of operator", () => {
    expectResolveErrors(`
    var g = 1;
    var ag = &g; // ok
    var f1 = &1; // error
    var f2 = &(g + 1); // error
    var f3 = &foo(); // error
    var f4 = &bar(); // error
    var f5 = &foo; // error
    def foo() int {
      return 1;
    }
    def bar() {}
    def main() {
      var x = 1;
      var arr = [1, 2, 3];
      var ax = &x; // ok
      var acx = &bool(x); // error
      var aarr = &arr; // ok
      var aarr0 = &arr[0]; // ok
      var aag = &ag; // ok
      var fa = &[1, 2, 3]; // error
    }
    def foobar(x int, arr [int; 2]) {
      var px = &x; // ok
      var parr = &arr; // ok
    }
    `,
    [
      "3: Invalid operand for unary operator '&'.",
      "4: Invalid operand for unary operator '&'.",
      "5: Invalid operand for unary operator '&'.",
      "6: Invalid operand for unary operator '&'.",
      "7: Invalid operand for unary operator '&'.",
      "16: Invalid operand for unary operator '&'.",
      "20: Invalid operand for unary operator '&'.",
    ])
  })

  test("dereferencing rval variables", () => {
    expectResolveErrors(`
    def main() {
      var x = 5;
      var y = true;
      var mat = [[1, 2], [3, 4]];
      var arrp [int~; 2] = [&x, &x];

      var px int~ = &x;
      var py bool~ = &y;
      var pmat [[int; 2]; 2]~ = &mat;
      var prow [int; 2]~ = &mat[0];
      var pel int~ = &mat[0][0];
      var arrpel int~ = arrp[0];
      var pp int~~ = &px;

      print x~; // error
      var dpx int = px~; // ok
      print y~; // error
      var dpy bool = py~; // ok
      print mat~; // error
      var dpmat [[int; 2]; 2] = pmat~; // ok
      print mat[0]~; // error
      var dprow [int; 2] = prow~; // ok
      print mat[0][0]~; // error
      var dpel int = pel~; // ok
      var darrp int = arrp[0]~; // ok
      var dpp int~ = pp~; // ok
      var xdpp int = pp~; // error
      var ddpp int = pp~~; // ok
      print pp~~~; // error
    }
    `,
    [
      "15: Invalid operand for dereferencing operator '~'.",
      "17: Invalid operand for dereferencing operator '~'.",
      "19: Invalid operand for dereferencing operator '~'.",
      "21: Invalid operand for dereferencing operator '~'.",
      "23: Invalid operand for dereferencing operator '~'.",
      "27: Cannot assign value of type 'int~' to variable of type 'int'.",
      "29: Invalid operand for dereferencing operator '~'.",
    ])
  })

  test("dereferencing lval variables", () => {
    expectResolveErrors(`
    def main() {
      var x = 5;
      var y = true;
      var mat = [[1, 2], [3, 4]];
      var arrp [int~; 2] = [&x, &x];

      var px int~ = &x;
      var py bool~ = &y;
      var pmat [[int; 2]; 2]~ = &mat;
      var prow [int; 2]~ = &mat[0];
      var pel int~ = &mat[0][0];
      var arrpel int~ = arrp[0];
      var pp int~~ = &px;

      x~ = 6; // error
      px~ = 6; // ok
      y~ = false; // error
      py~ = false; // ok
      mat~ = [[5, 6], [7, 8]]; // error
      pmat~ = [[5, 6], [7, 8]]; // ok
      mat[0]~ = [5, 6]; // error
      prow~ = [5, 6]; // ok
      mat[0][0]~ = 5; // error
      pel~ = 5; // ok
      arrp[0]~ = 6; // ok
      pp~ = &x; // ok
      pp~~ = 1337; // ok
      pp~~ = &px; // error
      pp~~~ = 1; // error
    }
    `,
    [
      "15: Invalid operand for dereferencing operator '~'.",
      "17: Invalid operand for dereferencing operator '~'.",
      "19: Invalid operand for dereferencing operator '~'.",
      "21: Invalid operand for dereferencing operator '~'.",
      "23: Invalid operand for dereferencing operator '~'.",
      "28: Cannot implicitly convert operand to 'int'.",
      "29: Invalid operand for dereferencing operator '~'.",
    ])
  })

  test("pointer arithmetic", () => {
    expectResolveErrors(`
    def printAddr(p int~ ) {
      print p~;
    }
    def main() {
      var x = [1,2,3];
      var p = &x[1];
      printAddr(1 + p); // ok
      printAddr(p + 1); // ok
      printAddr(1 - p); // error
      printAddr(p - 1); // ok
      printAddr(2 * p); // error
      printAddr(p * 2); // error
      printAddr(2 / p); // error
      printAddr(p / 2); // error
      var q = &x[0];
      printAddr(p + q); // error
      printAddr(p - q); // error
    }
    `,
    [
      "9: Invalid operand types for binary operator '-'.",
      "11: Invalid operand types for binary operator '*'.",
      "12: Invalid operand types for binary operator '*'.",
      "13: Invalid operand types for binary operator '/'.",
      "14: Invalid operand types for binary operator '/'.",
      "16: Invalid operand types for binary operator '+'.",
      // TODO: might be useful to allow pointer differencing later
      "17: Invalid operand types for binary operator '-'.",
    ])
  })

  test("dereferencing lval expressions", () => {
    expectResolveErrors(`
    var g = 1;
    def globalLoc() int~ {
      return &g;
    }
    def global() int {
      return g;
    }
    def main() {
      var x = 5;
      var y = true;
      var mat = [[1, 2], [3, 4]];
      var arrp [int~; 2] = [&x, &x];

      1~ = 6; // error
      (&1)~ = 6; // error
      (&x)~ = 6; // ok
      (&x + 1)~ = 6; // ok
      false~ = false; // error
      (&false)~ = false; // error
      (&y)~ = false; // ok
      [[1, 2], [3, 4]]~ = [[5, 6], [7, 8]]; // error
      (&[[1, 2], [3, 4]])~ = [[5, 6], [7, 8]]; // error
      (&mat)~ = [[5, 6], [7, 8]]; // ok
      (&mat[0] + 1)~ = [5, 6]; // ok
      (&mat[0][0] + 1)~ = 5; // ok
      (arrp[0] + 1)~ = 6; // ok

      var px int~ = &x;
      (px + 1)~ = 1; // ok
      (&px + 1)~ = &x; // ok

      globalLoc()~ = 2; // ok
      global()~ = 2; // error
      (&global())~ = 2; // error
    }
    `,
    [
      "14: Invalid operand for dereferencing operator '~'.",
      "15: Invalid operand for unary operator '&'.",
      "18: Invalid operand for dereferencing operator '~'.",
      "19: Invalid operand for unary operator '&'.",
      "21: Invalid operand for dereferencing operator '~'.",
      "22: Invalid operand for unary operator '&'.",
      "33: Invalid operand for dereferencing operator '~'.",
      "34: Invalid operand for unary operator '&'.",
    ])
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
      var arr = [1,2,3];
      var ih = 0xAABBCCDD;
      print bt;
      print bl;
      print i;
      print f;
      print arr;
      print ih;
    }
    `,
    `
42
1
298
3.1415927410125732
[1, 2, 3]
-1430532899
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

      print 10%3;
      print 10%-3;
      print -10%3;
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
1
1
-1
`.trim() + "\n")
  })

  test("byte operators", async () => {
    await expectOutput(`
    def main() {
      print byte(5)+byte(3);
      print byte(5)-byte(3);
      print byte(5)*byte(3);
      print byte(5)/byte(3);

      print byte(5)==byte(3);
      print byte(5)==byte(5);
      print byte(5)!=byte(3);
      print byte(5)>byte(3);
      print byte(5)>=byte(3);
      print byte(5)<byte(3);
      print byte(5)<=byte(3);

      print byte(10)%byte(3);
      print byte(10)%byte(-3);
      print byte(-10)%byte(3);
    }
    `,
    `
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
1
10
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

  test("mixed int-and-float operators", async () => {
    await expectOutput(`
    def main() {
      print 5.5+3;
      print 5+3.5;
      print 5-2.5;
      print 5.5-3;
      print 5*1.5;
      print 1.5*5;
      print 5.0/3;
      print 5/3.0;
    }
    `,
    `
8.5
8.5
2.5
2.5
7.5
7.5
1.6666666269302368
1.6666666269302368
`.trim() + "\n")
  })

  test("mixed int-and-byte operators", async () => {
    await expectOutput(`
    def main() {
      print -byte(5);

      print byte(5)       + int(3);
      print byte(256 + 5) + int(3);

      print byte(3)       - int(5);
      print byte(256 + 3) - int(5);
      print int(3)        - byte(5);
      print int(3)        - byte(256 + 5);
      print byte(5)       * int(3);
      print byte(256 + 5) * int(3);

      print byte(5)       / int(3);
      print byte(256 + 5) / int(3);
      print int(5)        / byte(3);
      print int(5)        / byte(256 + 3);

      print int(5)        ==  byte(3);
      print int(5)        ==  byte(256+3);
      print int(5)        ==  byte(5);
      print int(5)        ==  byte(256+5);
      print int(256+3)    !=  byte(3);
      print int(256+3)    !=  byte(256+3);

      print int(5)        >   byte(3);
      print int(5)        >   byte(256+3);
      print int(5)        >=  byte(3);
      print int(5)        >=  byte(256+3);
      print int(5)        <   byte(3);
      print int(5)        <   byte(256+3);
      print int(5)        <=  byte(3);
      print int(5)        <=  byte(256+3);

      print byte(10)      % int(3);
      print byte(256 + 10)% int(3);
      print int(10)       % byte(3);
      print int(10)       % byte(256 + 3);
    }
    `,
    `
-5
8
8
-2
-2
-2
-2
15
15
1
1
1
1
0
0
1
1
1
1
1
1
1
1
0
0
0
0
1
1
1
1
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

  test("bool short-circuiting", async () => {
    await expectOutput(`
    def yes(r bool) bool {
      print 1337;
      return r;
    }
    def no(r bool) bool {
      print -1;
      return r;
    }
    def main() {
      print yes(true) && yes(true);
      print yes(true) && yes(false);
      print yes(false) && no(true);
      print yes(false) && no(false);
      print yes(true) || no(true);
      print yes(true) || no(false);
      print yes(false) || yes(true);
      print yes(false) || yes(false);
    }
    `,
    `
1337
1337
1
1337
1337
0
1337
0
1337
0
1337
1
1337
1
1337
1337
1
1337
1337
0
`.trim() + "\n")
  })

  test("function calls", async () => {
    await expectOutput(`
    def add(x int, y int) int {
      return x + y;
    }
    def sub(x int, y int) int {
      return x - y;
    }
    def lerp(a float, b float, t float) float {
      return a*(1-t)+b*t;
    }
    def main() {
      print add(42, -1337);
      print sub(42, -1337);
      print lerp(1, 3.14, 0.4);
      print add(add(add(42, -1337), sub(42, -1337)), int(lerp(1, 3.14, 0.4)));
    }
    `,
    `
-1295
1379
1.8560000658035278
85
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

  test("iteration", async () => {
    await expectOutput(`
    def factorial(n int) int {
      var result = 1;
      while (n > 0) {
        result = result * n;
        n = n - 1;
      }
      return result;
    }
    def pow(x float, n int) float {
      var result = 1.0;
      for (var i = 0; i < n; i = i + 1) {
        result = result * x;
      }
      return result;
    }
    def main() {
      print factorial(0);
      print factorial(5);
      print pow(0.5, 3);
    }
    `,
    `
1
120
0.125
`.trim() + "\n")
  })

  test("for loops", async () => {
    await expectOutput(`
    def main() {
      {
        var i = 1337;
        for (var i = 0; i < 3; i = i + 1) {
          print i;
        }
        print i;
      }
      for (var i = 0; i < 8; i = i + 2) {
        print i;
      }
    }
    `,
    `
0
1
2
1337
0
2
4
6
`.trim() + "\n")
  })

  test("assignment eval and chaining", async () => {
    await expectOutput(`
    def factorial(n int) int {
      var result = n;
      while (n = n - 1) {
        result = result * n;
      }
      return result;
    }
    var x = 1;
    def main() {
      var y = 2;
      print x = y = factorial(5);
      print x;
      print y;
    }
    `,
    `
120
120
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

  test("arrays 1", async () => {
    await expectOutput(`
    def main() {
      var a = [6, 7, 8];
      print a[0];
      print len(a);
      print a[len(a) - 1];
      a[0] = 1337;
      print a[0];

      var b = [3.14; 3];
      print b[0];
      print b[1];
      print b[2];
      print len(b);
      b[0] = 2.718;
      print b[0];
    }
    `,
    `
6
3
8
1337
3.140000104904175
3.140000104904175
3.140000104904175
3
2.7179999351501465
`.trim() + "\n")
  })

  test("arrays 2", async () => {
    await expectOutput(`
    def main() {
      var a = [[1, 2, 3],
               [4, 5, 6]];
      print a;
      print a[0];
      print a[0][0];
      a[0][0] = a[0][1] = a[0][2] = a[1][1];
      print a;
      print a[0];
      print a[0][0];
      a[1][1] = 1337;
      print a;
      print a[0];
      print a[0][0];
      a[0] = [7, 8, 9];
      print a;
      var b = a[0];
      print b;
      b = a[1];
      print b;
      print a;
    }
    `,
    `
[[1, 2, 3], [4, 5, 6]]
[1, 2, 3]
1
[[5, 5, 5], [4, 5, 6]]
[5, 5, 5]
5
[[5, 5, 5], [4, 1337, 6]]
[5, 5, 5]
5
[[7, 8, 9], [4, 1337, 6]]
[7, 8, 9]
[4, 1337, 6]
[[7, 8, 9], [4, 1337, 6]]
`.trim() + "\n")
  })

  test("arrays 3", async () => {
    await expectOutput(`
    def mul(mat [[float; 2]; 2], v [float; 2]) [float; 2] {
      return [mat[0][0] * v[0] + mat[0][1] * v[1],
              mat[1][0] * v[0] + mat[1][1] * v[1]];
    }
    def ident() [[float; 2]; 2] {
      return [[1.0, 0.0],
              [0.0, 1.0]];
    }
    def rot90CCW() [[float; 2]; 2] {
      return [[0.0, -1.0],
              [1.0, 0.0]];
    }
    def main() {
      var I = ident();
      var x = [1.0, 0.0];
      print mul(I, x);
      var R = rot90CCW();
      var i = 0;
      while (i < 4) {
        x = mul(R, x);
        print x;
        i = i + 1;
      }
    }
    `,
    `
[1, 0]
[0, 1]
[-1, 0]
[0, -1]
[1, 0]
`.trim() + "\n")
  })

  test("arrays 4", async () => {
    await expectOutput(`
    def slurp(a int, b int, c int) [int; 6] {
      var tmp = [a, b, c];
      var result = [0; 6];
      var i = 0;
      while (i < len(tmp)) {
        result[2*i] = 2*tmp[i];
        result[2*i + 1] = 2*tmp[i] + 1;
        i = i + 1;
      }
      return result;
    }
    def main() {
      var y = slurp(1, 5, 10);
      print y;
    }
    `,
    `
[2, 3, 10, 11, 20, 21]
`.trim() + "\n")
  })

  test("arrays 5", async () => {
    await expectOutput(`
    def inc(arr [int; 2]) [int; 2] {
      arr[0] = arr[0] + 1;
      arr[1] = arr[1] + 1;
      return arr;
    }
    def main() {
      var x = [1, 2];
      print inc(x);
      print x;
    }
    `,
    `
[2, 3]
[1, 2]
`.trim() + "\n")
  })

  test("global arrays 1", async () => {
    await expectOutput(`
    var a = [[1, 2, 3],
             [4, 5, 6]];
    def main() {
      print a;
      a[0][0] = a[0][1] = a[0][2] = a[1][1];
      print a;
      print a[0][0];
      a[1][1] = 1337;
      print a;
      print a[0][0];
      a[0] = [7, 8, 9];
      print a;
      var b = a[0];
      print b;
      b = a[1];
      print b;
      print a;
    }
    `,
    `
[[1, 2, 3], [4, 5, 6]]
[[5, 5, 5], [4, 5, 6]]
5
[[5, 5, 5], [4, 1337, 6]]
5
[[7, 8, 9], [4, 1337, 6]]
[7, 8, 9]
[4, 1337, 6]
[[7, 8, 9], [4, 1337, 6]]
`.trim() + "\n")
  })

  test("pointers 1: loading primitive vars", async () => {
    await expectOutput(`
    var gi = 1337;
    var gf = 3.5;
    var gb = true;
    var gc = byte(1);
    def main() {
      var i = 1338;
      var f = 4.5;
      var b = true;
      var c = byte(2);

      var pi = &i;
      var pf = &f;
      var pb = &b;
      var pc = &c;

      print pi~;
      print pf~;
      print pb~;
      print pc~;

      i = 1339;
      f = 5.5;
      b = false;
      c = byte(3);

      print pi~;
      print pf~;
      print pb~;
      print pc~;

      pi = &gi;
      pf = &gf;
      pb = &gb;
      pc = &gc;

      print pi~;
      print pf~;
      print pb~;
      print pc~;

      gi = 1340;
      gf = 6.5;
      gb = false;
      gc = byte(4);

      print pi~;
      print pf~;
      print pb~;
      print pc~;
    }
    `,
    `
1338
4.5
1
2
1339
5.5
0
3
1337
3.5
1
1
1340
6.5
0
4
`.trim() + "\n")
  })

  test("pointers 2: storing primitive vars", async () => {
    await expectOutput(`
    var gi = 1337;
    var gf = 3.5;
    var gb = true;
    var gc = byte(1);
    def main() {
      var i = 1338;
      var f = 4.5;
      var b = true;
      var c = byte(2);

      var pi = &i;
      var pf = &f;
      var pb = &b;
      var pc = &c;

      print i;
      print f;
      print b;
      print c;

      pi~ = 1339;
      pf~ = 5.5;
      pb~ = false;
      pc~ = byte(3);

      print i;
      print f;
      print b;
      print c;

      pi = &gi;
      pf = &gf;
      pb = &gb;
      pc = &gc;

      print gi;
      print gf;
      print gb;
      print gc;

      pi~ = 1340;
      pf~ = 6.5;
      pb~ = false;
      pc~ = byte(4);

      print gi;
      print gf;
      print gb;
      print gc;
    }
    `,
    `
1338
4.5
1
2
1339
5.5
0
3
1337
3.5
1
1
1340
6.5
0
4
`.trim() + "\n")
  })

  test("pointers 3: out vars", async () => {
    await expectOutput(`
    def inc(x int~) {
      x~ = x~ + 1;
    }
    def main() {
      var x = 1337;
      var y = 42;
      inc(&x);
      inc(&y);
      print x;
      print y;
    }
    `,
    `
1338
43
`.trim() + "\n")
  })

  test("pointers 4: loading and storing array elements", async () => {
    await expectOutput(`
    def main() {
      var mat = [[1, 2], [3, 4]];
      var p [int; 2]~ = &mat[0];
      print p~; // [1, 2]
      p~ = [1337, 1338];
      print mat[0]; // [1337, 1338]
      var row = p~;
      print row; // [1337, 1338]
      mat[0][0] = 1111;
      print mat; // [[1111, 1338], [3, 4]]
      print row; // [1337, 1338]
      var mat2 = [p~, p~];
      print mat2; // [[1111, 1338], [1111, 1338]]
      mat2[0][0] = 0;
      print mat2; // [[0, 1338], [1111, 1338]]
    }
    `,
    `
[1, 2]
[1337, 1338]
[1337, 1338]
[[1111, 1338], [3, 4]]
[1337, 1338]
[[1111, 1338], [1111, 1338]]
[[0, 1338], [1111, 1338]]
`.trim() + "\n")
  })

  test("pointers 5: pointers to pointers", async () => {
    await expectOutput(`
    def main() {
      var a = 1111;
      var b = 2222;
      var r [int~; 2] = [&a, &b];
      var pa int~~ = &r[0];
      pa~~ = 3333;
      print a; // --> 3333
      pa~ = &b;
      print r[1]~; // --> 2222
    }
    `,
    `
3333
2222
`.trim() + "\n")
  })

  test("pointers 6: pointer arithmetic", async () => {
    await expectOutput(`
    var data = [byte(0); 8];
    def main() {
      var pb_start = &data[0];
      var pb_end = &data[0] + 8;
      for (var p = pb_start; p != pb_end - 4; p = p + 1) {
        p~ = 255;
      }
      print data; // [255, 255, 255, 255, 0, 0, 0, 0]
      var pi_start = int~(pb_start);
      var pi_end = int~(pb_end);
      for (var p = pi_start; p != pi_end; p = p + 1) {
        print p~; // -1, 0
      }
    }
    `,
    `
[255, 255, 255, 255, 0, 0, 0, 0]
-1
0
`.trim() + "\n")
  })
})
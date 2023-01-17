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
    });
    const exports = instance.instance.exports as any
    exports.__init_globals__()
    exports.main()
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
    def foo(a, b) {}
    def foo(a int, b int) int;
    def foo(a int, b int) int {}
    def foo2(a int, b int) int {
      print 3.14159265358979626;
    `,
    [
      "1: Expect '(' after function name.",
      "2: Invalid type specifier starting at 'void'.",
      "3: Invalid type specifier starting at ','.",
      "4: Expect '{' before function body.",
      "7: Expect '}' after block."
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

  test("Invalid variable declaration", () => {
    expectParseErrors(`
    def main() {
      var a += 0;
      var 0 = 0;
      var a int;
      var a 1 = 0;
      var a int = 0; // ok
      var b = 0; // ok
    }
    `,
    [
      "2: Invalid type specifier starting at '+='.",
      "3: Expect identifier after 'var'.",
      "4: Expect '=' after variable declaration.",
      "5: Invalid type specifier starting at '1'.",
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

  test("Character literals", () => {
    expectParseErrors(`
    var x = 'h'; // ok
    var y = 'hello'; // error
    var z = 'é'; // error
    `,
    [
      "2: Invalid character literal (use double quotes for strings).",
      "3: Invalid character literal (only ASCII characters allowed)."
    ])
  })

  test("Struct statements", () => {
    expectParseErrors(`
    struct Point { x float, y float }
    struct Point { x int, y int } // error!
    struct Point2 { x int, y int }

    struct Semicolons { x int; } // error!
    struct NoBody; // error!
    struct DuplicateMember { x int, y int, y int } // error!
    struct BadBody {
      def foo() {} // error!
    }

    def FunctionStructCollision() {}
    struct FunctionStructCollision { x int, y int } // error!

    struct Empty {} // ok

    def main() {
      struct Vector { x float, y float } // error!
      print "synchronize";
    }
    `,
    [
      "2: 'Point' is already declared in this scope.",
      "5: Missing comma after member.",
      "5: Only variable declarations and function definitions allowed at the top-level.",
      "6: Expect '{' after struct name.",
      "7: 'y' is already declared in member list.",
      "9: Expect identifier.",
      "13: 'FunctionStructCollision' is already declared in this scope.",
      "18: Expect expression.",
    ])
  })
})

describe("type checking", () => {
  const expectResolveErrors = (source: string, expectedErrors: string[]) => expectErrors(source, expectedErrors, Passes.THROUGH_RESOLVE)

  test("Operators", () => {
    expectResolveErrors(`
    var u = 1.0 == false;
    var v = -true;
    var w = !1.5; // err
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

    var j1 = [1.0] == [2.0]; // err
    var j2 = [1.0] != [2.0]; // err
    struct Point{ x float, y float }
    var k1 = Point{1.0, 2.0} == Point{2.0, 3.0}; // err
    var k2 = Point{1.0, 2.0} != Point{2.0, 3.0}; // err
    `,
    [
      "1: Cannot compare float to bool.",
      "2: Invalid operand type for unary operator '-'.",
      "3: Cannot implicitly convert operand to 'bool'.",
      "4: Invalid operand types for binary operator '+'.",
      "5: Invalid operand types for binary operator '/'.",
      "6: Invalid operand types for binary operator '>'.",
      "17: Invalid operand types for binary operator '%'.",
      "19: Cannot compare [float; 1] to [float; 1].",
      "20: Cannot compare [float; 1] to [float; 1].",
      "22: Cannot compare Point to Point.",
      "23: Cannot compare Point to Point.",
    ])
  })

  test("Operators 2", () => {
    expectResolveErrors(`
    def main() {
      var i = 1;
      var f = 1.5;
      var bt = 'c';
      i += 1; // ok
      i += 1.5; // error
      i += true; // error
      i -= 1; // ok
      i -= 1.5; // error
      i -= true; // error
      i *= 1; // ok
      i *= 1.5; // error
      i *= true; // error
      i /= 1; // ok
      i /= 1.5; // error
      i /= true; // error
      i %= 1; // ok
      i %= 1.5; // error
      i %= true; // error
      f += 1; // ok
      f += 1.5; // ok
      f += true; // error
      f -= 1; // ok
      f -= 1.5; // ok
      f -= true; // error
      f *= 1; // ok
      f *= 1.5; // ok
      f *= true; // error
      f /= 1; // ok
      f /= 1.5; // ok
      f /= true; // error
      f %= 1; // error
      f %= 1.5; // error
      f %= true; // error
      bt += byte(1); // ok
      bt += 1.5; // error
      bt += true; // error
      bt -= byte(1); // ok
      bt -= 1.5; // error
      bt -= true; // error
      bt *= byte(1); // ok
      bt *= 1.5; // error
      bt *= true; // error
      bt /= byte(1); // ok
      bt /= 1.5; // error
      bt /= true; // error
      bt %= byte(1); // ok
      bt %= 1.5; // error
      bt %= true; // error
    }
    `,
    [
      "6: Cannot implicitly convert operand to 'int'.",
      "7: Invalid operand types for binary operator '+'.",
      "9: Cannot implicitly convert operand to 'int'.",
      "10: Invalid operand types for binary operator '-'.",
      "12: Cannot implicitly convert operand to 'int'.",
      "13: Invalid operand types for binary operator '*'.",
      "15: Cannot implicitly convert operand to 'int'.",
      "16: Invalid operand types for binary operator '/'.",
      "18: Invalid operand types for binary operator '%'.",
      "19: Invalid operand types for binary operator '%'.",
      "22: Invalid operand types for binary operator '+'.",
      "25: Invalid operand types for binary operator '-'.",
      "28: Invalid operand types for binary operator '*'.",
      "31: Invalid operand types for binary operator '/'.",
      "32: Invalid operand types for binary operator '%'.",
      "33: Invalid operand types for binary operator '%'.",
      "34: Invalid operand types for binary operator '%'.",
      "36: Cannot implicitly convert operand to 'byte'.",
      "37: Invalid operand types for binary operator '+'.",
      "39: Cannot implicitly convert operand to 'byte'.",
      "40: Invalid operand types for binary operator '-'.",
      "42: Cannot implicitly convert operand to 'byte'.",
      "43: Invalid operand types for binary operator '*'.",
      "45: Cannot implicitly convert operand to 'byte'.",
      "46: Invalid operand types for binary operator '/'.",
      "48: Invalid operand types for binary operator '%'.",
      "49: Invalid operand types for binary operator '%'.",
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

  test("non-printable type", () => {
    expectResolveErrors(`
    def main() {
      print foo(); // error
    }
    def foo() {}
    `,
    [
      "2: Cannot print value of type 'void'."
    ])
  })

  test("break/continue outside loop", () => {
    expectResolveErrors(`
    def main() {
      break; // error
      continue; // error
      foo(1, 2);
    }
    def foo(x int, y int) {
      break; // error
      var i = 0;
      while (i < 5) {
        if (i == y) {
          break; // ok
        }
        if (i == x) {
          continue; // ok
        }
        for (var j = 0; j < i; j += 1) {
          if (j == y) {
            break; // ok
          }
          if (j == x) {
            continue; // ok
          }
          print j;
        }
      }
    }
    `,
    [
      "2: Cannot break outside a loop.",
      "3: Cannot continue outside a loop.",
      "7: Cannot break outside a loop.",
    ])
  })

  test("structs: constructor and member access type inference", () => {
    expectResolveErrors(`
    def main() {
      var p = Point{1, 2}; // ok
      var t = Ticket{1, 'a', true}; // ok
      p.x = true; // error
      p.x = 3.14; // ok
      var f float = p.y; // ok
      var bl bool = p.y; // error
      t.id = false; // error
      t.id = 42; // ok
      t.group = 3.14; // error
      t.group = 'b'; // ok
      t.isDeluxe = 3.14; // error
      t.isDeluxe = false; // ok
    }
    struct Point { x float, y float }
    struct Ticket { id int, group byte, isDeluxe bool }
    `,
    [
      "4: Cannot implicitly convert operand to 'float'.",
      "7: Cannot assign value of type 'float' to variable of type 'bool'.",
      "8: Cannot implicitly convert operand to 'int'.",
      "10: Cannot implicitly convert operand to 'byte'.",
      "12: Cannot implicitly convert operand to 'bool'.",
    ])
  })

  test("structs: accessing invalid members", () => {
    expectResolveErrors(`
    def main() {
      var t = Ticket{1, 'a', true}; // ok
      print t.id; // ok
      print t.group; // ok
      print t.isDeluxe; // ok
      print t.doesNotExist; // error!
    }
    struct Ticket { id int, group byte, isDeluxe bool }
    `,
    [
      "6: Struct Ticket has no member 'doesNotExist'.",
    ])
  })

  test("structs: valid operands for dot operator", () => {
    expectResolveErrors(`
    def getTicket() Ticket {
      return Ticket{1, 'a', true};
    }
    def getNum() int {
      return 1;
    }
    def getArr() [int; 1] {
      return [1];
    }
    def main() {
      print Ticket{1, 'a', true}.id; // ok
      print getTicket().id; // ok
      print getNum().id; // error!
      print getArr().id; // error!
      print p.id; // error!
      print p~.id; // ok
      print g.t.id; // ok
      print g.name; // ok
      print g.name[0].id; // error!
    }
    var t = Ticket{999, 'b', true};
    var p = &t;
    var g = Passenger{ "jonathan", t };
    struct Ticket { id int, group byte, isDeluxe bool }
    struct Passenger { name [byte; 8], t Ticket }
    `,
    [
      "13: Invalid operand for member access operator '.'.",
      "14: Invalid operand for member access operator '.'.",
      "15: Invalid operand for member access operator '.'.",
      "19: Invalid operand for member access operator '.'.",
    ])
  })

  test("structs: constructor arity and arg checking", () => {
    expectResolveErrors(`
    def main() {
      var t1 = Ticket{1, 'a', true}; // ok
      var t2 = Ticket{1, 'a'}; // error!
      var t3 = Ticket{3.14, 5.6, 't'}; // error!
      var t4 = Ticket{1, 'a', true, true}; // error!
    }
    struct Ticket { id int, group byte, isDeluxe bool }
    `,
    [
      "3: Expected 3 arguments but got 2 in call to Ticket.",
      "4: Cannot implicitly convert operand to 'int'.",
      "4: Cannot implicitly convert operand to 'byte'.",
      "4: Cannot implicitly convert operand to 'bool'.",
      "5: Expected 3 arguments but got 4 in call to Ticket.",
    ])
  })

  test("structs: nominal variable type annotations", () => {
    expectResolveErrors(`
    def main() {
      var p Point = Point{1, 2}; // ok
      var x Vector = Point{1, 2}; // error!
      var y Point = 1; // error!
      var v Vector = Vector{1, 2}; // ok
    }
    struct Point { x float, y float }
    struct Vector { x float, y float }
    `,
    [
      "3: Cannot assign value of type 'Point' to variable of type 'Vector'.",
      "4: Cannot assign value of type 'int' to variable of type 'Point'.",
    ])
  })

  test("structs: nominal parameter, member, and return types", () => {
    expectResolveErrors(`
    def bad1(p Point) Point {
      return -1; // error!
    }
    def bad2(p Point) Vector {
      return p; // error!
    }
    def bad3(p Point) Vector {
      return Point{1, 2}; // error!
    }
    def point2Vec(p Point) Vector {
      return Vector{p.x, p.y}; // ok
    }
    def add(a Point, b Point) Point {
      return Point{a.x + b.x, a.y + b.y}; // ok
    }
    def main() {
      var v = point2Vec(Point{1, 2}); // ok
      var x1 = add(1, 2); // error!
      var x2 = add(Vector{1, 2}, Vector{3, 4}); // error!
      var y Point = point2Vec(Point{1, 2}); // error!
      var p = add(Point{1, 2}, Point{3, 4}); // ok
    }
    struct Point { x float, y float }
    struct Vector { x float, y float }
    `,
    [
      "2: Expected a value of type 'Point'.",
      "5: Expected a value of type 'Vector'.",
      "8: Expected a value of type 'Vector'.",
      "18: Cannot implicitly convert operand to 'Point'.",
      "18: Cannot implicitly convert operand to 'Point'.",
      "19: Cannot implicitly convert operand to 'Point'.",
      "19: Cannot implicitly convert operand to 'Point'.",
      "20: Cannot assign value of type 'Vector' to variable of type 'Point'.",
    ])
  })

  test("structs: incomplete/undefined type names", () => {
    expectResolveErrors(`
    struct ContainsUndefined {
      val Undefined // error!
    }
    def foo(x Undefined) { // error!
      print "hello";
    }
    def bar() Undefined {} // error!
    def main() {
      var x Undefined = bar(); // error!
      var y = Undefined{}; // error!
    }
    `,
    [
      "2: Undefined typename 'Undefined'.",
      "4: Undefined typename 'Undefined'.",
      "7: Undefined typename 'Undefined'.",
      "9: Undefined typename 'Undefined'.",
      "10: Undefined symbol 'Undefined'.",
    ])
  })

  test("structs: invalid nominal type annotations", () => {
    expectResolveErrors(`
    var isAGlobalVar = 42;
    struct ContainsInvalid {
      val isAFunction, // error!
      val2 isAGlobalVar // error!
    }
    def isAFunction(x int) int {
      return 1337;
    }
    def badParamType(x isAFunction) { // error!
      print "hi";
    }
    def main() {
      var badVarType isAFunction = isAFunction(1); // error!
      var badVarType2 isAGlobalVar = isAGlobalVar; // error!
      var x = isAGlobalVar; // ok
      var y = isAFunction(1); // ok
    }
    `,
    [
      "3: Undefined typename 'isAFunction'.",
      "4: Undefined typename 'isAGlobalVar'.",
      "9: Undefined typename 'isAFunction'.",
      "13: Undefined typename 'isAFunction'.",
      "14: Undefined typename 'isAGlobalVar'.",
    ])
  })

  test("structs: constructor vs function calls", () => {
    expectResolveErrors(`
    struct Point { x float, y float }
    def isAFunction(x int) int {
      return 1337;
    }
    def main() {
      var bad1 = isAFunction{1}; // error!
      var bad2 = Point(1, 2); // error!
      var x = Point{1, 2}; // ok
    }
    `,
    [
      "6: Cannot construct this type.",
      "7: Cannot call this type.",
    ])
  })

  test("structs: cyclic struct definitions", () => {
    expectResolveErrors(`
    struct BadList {
      next BadList, // error!
      val int
    }
    struct GoodList {
      next GoodList~, // ok
      val int
    }
    struct Bad1 {
      child Bad2, // error!
      val int
    }
    struct Bad2 {
      child Bad1, // error!
      val int
    }
    `,
    [
      "2: Cyclic member declaration for struct 'BadList'.",
      "14: Cyclic member declaration for struct 'Bad1'.",
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
      var bt_ascii = 'a';
      var str = "hello world";
      print bt;
      print bl;
      print i;
      print f;
      print arr;
      print ih;
      print bt_ascii;
      print str;
    }
    `,
    `
42
1
298
3.1415927410125732
[1, 2, 3]
-1430532899
97
hello world
`.trim() + "\n")
  })

  test("builtin functions", async () => {
    await expectOutput(`
    def main() {
      print __sqrt__(2);
    }
    `,
    `
1.4142135381698608
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
        n -= 1;
      }
      return result;
    }
    def pow(x float, n int) float {
      var result = 1.0;
      for (var i = 0; i < n; i += 1) {
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
        for (var i = 0; i < 3; i += 1) {
          print i;
        }
        print i;
      }
      for (var i = 0; i < 8; i += 2) {
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

      var row = [123, 456, 789];
      a = [row, row];
      a[0][0] = 999;
      print a;

      var row2 = [-1, -2, -3];
      a = [row, row2];
      print a;

      a = [row2; 2];
      a[0][0] = 999;
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
[[999, 456, 789], [123, 456, 789]]
[[123, 456, 789], [-1, -2, -3]]
[[999, -2, -3], [-1, -2, -3]]
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
      for (var i = 0; i < 4; i += 1) {
        x = mul(R, x);
        print x;
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
      for (var i = 0; i < 8; i+=1) {
        print data[i];
      }
      var pi_start = int~(pb_start);
      var pi_end = int~(pb_end);
      for (var p = pi_start; p != pi_end; p = p + 1) {
        print p~; // -1, 0
      }
    }
    `,
    `
255
255
255
255
0
0
0
0
-1
0
`.trim() + "\n")
  })

  test("Operator-assignment", async () => {
    await expectOutput(`
    def main() {
      var i = 1;
      var f = 1.5;
      var arr = [1,2,3,4,5];
      i += 1;
      print i; // 2
      i -= 1;
      print i; // 1
      i *= 2;
      print i; // 2
      i /= 2;
      print i; // 1
      i %= 1;
      print i; // 0
      f += 1;
      print f; // 2.5
      f -= 1;
      print f; // 1.5
      f *= 2;
      print f; // 3
      f /= 2;
      print f; // 1.5
      arr[0] += 1;
      arr[1] -= 1;
      arr[2] *= 2;
      arr[3] /= 2;
      arr[4] %= 2;
      print arr; // [2, 1, 6, 2, 1]
      var p = &i;
      p~ += 500;
      print i; // 500
    }
    `,
    `
2
1
2
1
0
2.5
1.5
3
1.5
[2, 1, 6, 2, 1]
500
`.trim() + "\n")
  })

  test("String literals", async () => {
    await expectOutput(`
    var g = "hello.";
    def main() {
      var l = "hello.";
      l[0] = 'H';
      l[len(l)-1] = '!';
      var l2 = "this is a 'quote'";
      var l3 = "this has \\backslashes\\";
      print g;
      print l;
      print l2;
      print l3;
    }
    `,
    `
hello.
Hello!
this is a 'quote'
this has \\backslashes\\
`.trim() + "\n")
  })

  test("break/continue", async () => {
    await expectOutput(`
    var BREAK = 1;
    var CONTINUE = 2;
    def main() {
      loopy(-1, 2, BREAK);
      loopy(-1, 2, CONTINUE);
      loopy(3, -1, BREAK);
      loopy(2, -1, CONTINUE);
      loopy(1, 1, CONTINUE);
    }
    def loopy(outerX int, innerX int, mode int) {
      for (var i = 1; i <= 3; i += 1) {
        if (i == outerX) {
          if (mode == BREAK) {
            break;
          }
          if (mode == CONTINUE) {
            continue;
          }
        }
        for (var j = 1; j <= i; j += 1) {
          if (j == innerX) {
            if (mode == BREAK) {
              break;
            }
            if (mode == CONTINUE) {
              continue;
            }
          }
          print j;
        }
      }
      print "done";
    }
    `,
    `
1
1
1
done
1
1
1
3
done
1
1
2
done
1
1
2
3
done
2
2
3
done
`.trim() + "\n")
  })

  test("structs 1", async () => {
    await expectOutput(`
    struct Point { x float, y float }
    struct Line { a Point, b Point }
    def dist(p Point) float {
      return __sqrt__(p.x * p.x + p.y * p.y);
    }
    def length(l Line) float {
      return dist(Point{l.a.x - l.b.x, l.a.y - l.b.y});
    }
    def main() {
      print length(Line{Point{1, 2}, Point{3, 4}}); // 2.8284270763397217
    }
    `,
    `
2.8284270763397217
`.trim() + "\n")
  })

  test("structs 2", async () => {
    await expectOutput(`
    def avg(arr [Point; 4]) Point {
      var out = Point{0, 0};
      for (var i = 0; i < len(arr); i += 1) {
        out.x += arr[i].x;
        out.y += arr[i].y;
      }
      out.x /= len(arr);
      out.y /= len(arr);
      return out;
    }
    def main() {
      var pointCloud = [Point{0, 0}, Point{1, 0}, Point{1, 1}, Point{0, 1}];
      var center = avg(pointCloud); // 0.5, 0.5
      print center.x;
      print center.y;
    }
    struct Point {x float, y float }
    `,
    `
0.5
0.5
`.trim() + "\n")
  })

  test("structs 3", async () => {
    await expectOutput(`
    def ctr(q Quad) Point {
      var out = Point{0, 0};
      for (var i = 0; i < len(q.corners); i += 1) {
        out.x += q.corners[i].x;
        out.y += q.corners[i].y;
      }
      out.x /= len(q.corners);
      out.y /= len(q.corners);
      return out;
    }
    def main() {
      var q = Quad{[Point{0, 0}, Point{1, 0}, Point{1, 1}, Point{0, 1}]};
      var center = ctr(q); // 0.5, 0.5
      print center.x;
      print center.y;
    }
    struct Quad {
      corners [Point; 4]
    }
    struct Point {x float, y float }
    `,
    `
0.5
0.5
`.trim() + "\n")
  })

  test("structs 4", async () => {
    await expectOutput(`
    def mul(A Matrix, v Vector) Vector {
      return Vector{A.mat[0][0] * v.x + A.mat[0][1] * v.y,
                    A.mat[1][0] * v.x + A.mat[1][1] * v.y};
    }
    def ident() Matrix {
      return Matrix{[[1.0, 0.0],
                    [0.0, 1.0]]};
    }
    def rot90CCW() Matrix {
      return Matrix{[[0.0, -1.0],
                     [1.0, 0.0]]};
    }
    def main() {
      var I = ident();
      var x = Vector{1.0, 0.0};
      var Ix = mul(I, x);
      print [Ix.x, Ix.y];
      var R = rot90CCW();
      for (var i = 0; i < 4; i += 1) {
        x = mul(R, x);
        print [x.x, x.y];
      }
    }
    struct Matrix {
      mat [[float; 2]; 2]
    }
    struct Vector {
      x float,
      y float
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
})

// TODO: string literals with non-ascii UTF-8 chars
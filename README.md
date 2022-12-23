# Puffscript

Puffscript is a toy imperative programming language that compiles to WebAssembly.

**Features:**

- Strong, static typing
- Basic procedures. No classes or first-class functions
- String literals are syntactic sugar for UTF-8 encoded byte arrays


# Language reference

**Primitive types**

- int: 32-bit signed integer
- float: 32-bit float
- byte: 8-bit un-signed integer
- bool: “true” or “false”. Stored as 8-bit values

Primitives can be casted to one another via call syntax, e.g.

    var a = float(5);

Currently, only decimal literals for integers, bytes, and floats are supported. Floats are distinguished from ints/bytes by a decimal point: `.`

TODOs:

- Hexadecimal literals (e.g. `0xF2`) for ints/bytes/floats
- ASCII character literals for bytes
- Exponent literals (e.g. `1e-5`) for floats
- Special value literals (e.g. `NaN`, `inf`) for floats

**Variables**

Variables are declared with keyword `var` and must be initialized. Type annotations are added after the identifier. If type annotations are omitted, the type is inferred by the initialization if possible. The following are all valid:

    var a = 5.0;
    var a float = 5.0;
    var a = returnsFloat();

Variables can be global or local. Like Zig, global variables can be declared in any order, but must have acyclic initializer dependencies so that they can be initialized at runtime in dependency order. Ordering of non-dependent global initializers is undefined so be careful about side effects.

TODOs:

- Allow optional initializers for primitives with default initialization when omitted
- Implicit casting when initializing variables with explicit type annotations

**Functions**

Functions are defined like `def <functionName>(parameters) <returnType>`. If the return type is omitted, the function will be considered to have a return type of `void`, and need not explicitly return.

    def fib(n int) int {
      if (n == 0 || n == 1) {
        return 1;
      }
      return fib(n-1) + fib(n-2);
    }

Functions can only be defined at the top-level. Puffscript does not support first-class functions nor function pointers.

TODOs:

- Function overloading (defining multiple functions with the same name but different parameters)
- Exported and imported functions

**Control flow**

C-style if-else statements and while loops are supported inside functions:

    def foo() {
      while (loopCond) {
        if (cond1) {
          if (x) foo() else if (y) bar() else foobar();
        } else if (cond2) {
          // ...
        } else {
          // ...
        }
      }
    }

TODOs:

- `break` and `continue` in loops
- for loops
- switch statements
- ternary operator

**Operators**

Some familiar operators from C are supported. In precedence order (lower first):

| Operator                    | Description              |
| --------------------------- | ------------------------ |
| `=`                         | Assignment               |
| `\|\|`                        | Logical or               |
| `&&`                        | Logical and              |
| `==`, `!=`                  | Equals, not equals       |
| `>`, `>=`, `<`, `<=`        | Comparisons              |
| `+`, `-` (binary operators) | Addition, subtraction    |
| `*`, `/` (binary operators) | Multiplication, division |
| `!` (unary bang)            | Logical negation         |
| `-` (unary minus)           | Numeric negation         |

TODOs:

- Bitwise operations (`&`, `|`, `^`, `~`, `>>`, `<<`)
- Modulus (`%`)
- Increment, decrement (`++`, `--`)
- Operation-assignment (`+=`, `-=`, `*=`, `/=`, `%=`)


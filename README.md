# Puffscript

Puffscript is a toy imperative programming language that compiles to WebAssembly.

**Features:**

- Strong, static typing
- Basic procedures. No classes or first-class functions
- Fixed-length, contiguous multi-dimensional arrays
- String literals are syntactic sugar for UTF-8 encoded byte arrays


# Language reference

**Primitive types**

- int: 32-bit signed integer
- float: 32-bit float
- byte: 8-bit un-signed integer
- bool: 8-bits, “true” or “false”

Primitives can be casted to one another via call syntax, e.g.

```
var a = float(5);
```

Decimal and hex literals for integers, bytes, and floats are supported. Floats are distinguished from ints/bytes by a decimal point: `.`

**Variables**

Variables are declared with keyword `var` and must be initialized. Type annotations are added after the identifier. If type annotations are omitted, the type is inferred by the initialization if possible. The following are all valid:

```
var a = 5.0;
var a float = 5.0;
var a = returnsFloat();
```

Variables can be global or local. Like Zig, global variables can be declared in any order, but must have acyclic initializer dependencies so that they can be initialized at runtime in dependency order. Ordering of non-dependent global initializers is undefined so be careful about side effects.

**Arrays**

Array types are specified like `[T; N]` where `N`  is a non-negative integer known at compile-time.
Values can be created with “repeat literals” that initialize all items with the same value:

```
var tenZeroes = [0; 10]; // tenZeroes has type [int; 10]
```

Or “list literals” enumerating all initializers:

```
var tenZeroes = [0, 0, 0, 0, 0,
                  0, 0, 0, 0, 0];
```

You can get the length of an array with `len` and index into it with brackets:

```
tenZeroes[len(tenZeroes) - 1] = 999;
```

Multi-dimensional arrays are supported with nonscalar assignment:

```
var mat = [[1, 2], [3, 4]];
mat[0] = [5, 6];
```

**Pointers**

Pointer types are specified like `T~` and support operations:

- Taking a variable’s address is done with prefix `&`
- Dereferencing a pointer is done with postfix `~`
- Pointer arithmetic is done based on the size of the child type

```
def inc(int~ p) {
  p~ = p~ + 1;
}
def main() {
  var x = 5;
  var y = &x;
  inc(y);
  print x; // 6
}
```

Unlike C, arrays do not decay to pointers. If you want to pass an array by reference or take the address of an element, you need to use `&`:

```
def inc([int; 3]~ p) {
  for (var i = 0; i < 3; i++) {
    p~[i] = p~[i] + 1;
  }
}
def main() {
  var arr = [1, 2, 3];
  var first int~ = &arr[0];
  first~ = 42;
  inc(&arr);
  print arr; // [43, 3, 4]
}
```

Numerics cannot be casted directly to pointer types, so pointers can only be initialized with other pointers or by taking the address of variables. This discourages the use of null pointers.

**Functions**

Functions are defined like `def <functionName>(parameters) <returnType>`. If the return type is omitted, the function will be considered to have a return type of `void`, and need not explicitly return.

```
def fib(n int) int {
  if (n == 0 || n == 1) {
    return 1;
  }
  return fib(n-1) + fib(n-2);
}
```

Functions can only be defined at the top-level. Puffscript does not support first-class functions nor function pointers.

TODOs:

- Function overloading (defining multiple functions with the same name but different parameters)
- Exported and imported functions

**Control flow**

C-style if-else statements, while loops, and for loops are supported:

```
if (cond1) {
  if (x) foo();
  else bar();
} else if (cond2) {
  // ...
} else {
  // ...
}
while (loopCond) {
  // ...
}
for (var p = n; p != end; p = next(n)) {
  // ...
}
```

TODOs:

- `break` and `continue` in loops
- switch statements
- ternary operator

**Operators**

In precedence order (lower first):

| Operator                                                 | Description                                   | Associativity |
| -------------------------------------------------------- | --------------------------------------------- | ------------- |
| `=`                                                      | Assignment                                    | right to left |
| `\|\|`                                                     | Logical or                                    | left to right |
| `&&`                                                     | Logical and                                   | left to right |
| `==`, `!=`                                               | Equals, not equals                            | left to right |
| `>`, `>=`, `<`, `<=`                                     | Comparisons                                   | left to right |
| `+`, `-` (binary operators)                              | Addition, subtraction                         | left to right |
| `*`, `/`, `%` (binary operators)                         | Multiplication, division, modulus             | left to right |
| `!` (unary bang)<br>`-` (unary minus)<br>`&` (unary amp) | Logical NOT<br>Numeric negation<br>Address-of | right to left |
| `~` (unary postfix tilde)<br>`()`, `[]`                  | Pointer dereference<br>Call/cast, subscript   | left to right |

TODOs:

- Bitwise operations (`&`, `|`, `^`, `~`, `>>`, `<<`)
- Increment, decrement (`++`, `--`)
- Operation-assignment (`+=`, `-=`, `*=`, `/=`, `%=`)


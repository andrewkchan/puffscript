(() => {
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve2, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve2(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/util.ts
  function assertUnreachable(x) {
    throw new Error("Didn't expect to get here");
  }
  var UTF8Codec = class {
    constructor() {
      this.encoder = new TextEncoder();
      this.decoder = new TextDecoder("utf8");
      this.charBuf = new Uint8Array(1);
    }
    decodeASCIIChar(charCode) {
      if (charCode < 0 || charCode > 65536) {
        throw new Error("Expected ASCII char code");
      }
      this.charBuf[0] = charCode;
      return this.decoder.decode(this.charBuf);
    }
    encodeASCIIChar(char) {
      if (char.length !== 1) {
        throw new Error("Expected character");
      }
      this.encoder.encodeInto(char, this.charBuf);
      return this.charBuf[0];
    }
    encodeString(str) {
      return this.encoder.encode(str);
    }
    isValidASCII(char) {
      if (char.length !== 1) {
        throw new Error("Expected character");
      }
      return this.encoder.encodeInto(char, this.charBuf).written > 0;
    }
  };

  // src/tokens.ts
  var TokenType = /* @__PURE__ */ ((TokenType2) => {
    TokenType2[TokenType2["IDENTIFIER"] = 0] = "IDENTIFIER";
    TokenType2[TokenType2["STRING"] = 1] = "STRING";
    TokenType2[TokenType2["SINGLE_QUOTE_STRING"] = 2] = "SINGLE_QUOTE_STRING";
    TokenType2[TokenType2["NUMBER_DECIMAL"] = 3] = "NUMBER_DECIMAL";
    TokenType2[TokenType2["NUMBER_HEX"] = 4] = "NUMBER_HEX";
    TokenType2[TokenType2["NUMBER"] = 5] = "NUMBER";
    TokenType2[TokenType2["COMMENT"] = 6] = "COMMENT";
    TokenType2[TokenType2["LEFT_PAREN"] = 7] = "LEFT_PAREN";
    TokenType2[TokenType2["RIGHT_PAREN"] = 8] = "RIGHT_PAREN";
    TokenType2[TokenType2["LEFT_BRACE"] = 9] = "LEFT_BRACE";
    TokenType2[TokenType2["RIGHT_BRACE"] = 10] = "RIGHT_BRACE";
    TokenType2[TokenType2["LEFT_BRACKET"] = 11] = "LEFT_BRACKET";
    TokenType2[TokenType2["RIGHT_BRACKET"] = 12] = "RIGHT_BRACKET";
    TokenType2[TokenType2["COMMA"] = 13] = "COMMA";
    TokenType2[TokenType2["DOT"] = 14] = "DOT";
    TokenType2[TokenType2["SEMICOLON"] = 15] = "SEMICOLON";
    TokenType2[TokenType2["TILDE"] = 16] = "TILDE";
    TokenType2[TokenType2["BANG_EQUAL"] = 17] = "BANG_EQUAL";
    TokenType2[TokenType2["BANG"] = 18] = "BANG";
    TokenType2[TokenType2["EQUAL_EQUAL"] = 19] = "EQUAL_EQUAL";
    TokenType2[TokenType2["EQUAL"] = 20] = "EQUAL";
    TokenType2[TokenType2["GREATER_EQUAL"] = 21] = "GREATER_EQUAL";
    TokenType2[TokenType2["GREATER"] = 22] = "GREATER";
    TokenType2[TokenType2["LESS_EQUAL"] = 23] = "LESS_EQUAL";
    TokenType2[TokenType2["LESS"] = 24] = "LESS";
    TokenType2[TokenType2["AMP_AMP"] = 25] = "AMP_AMP";
    TokenType2[TokenType2["AMP"] = 26] = "AMP";
    TokenType2[TokenType2["BAR_BAR"] = 27] = "BAR_BAR";
    TokenType2[TokenType2["MINUS_EQUAL"] = 28] = "MINUS_EQUAL";
    TokenType2[TokenType2["MINUS"] = 29] = "MINUS";
    TokenType2[TokenType2["PLUS_EQUAL"] = 30] = "PLUS_EQUAL";
    TokenType2[TokenType2["PLUS"] = 31] = "PLUS";
    TokenType2[TokenType2["SLASH_EQUAL"] = 32] = "SLASH_EQUAL";
    TokenType2[TokenType2["SLASH"] = 33] = "SLASH";
    TokenType2[TokenType2["STAR_EQUAL"] = 34] = "STAR_EQUAL";
    TokenType2[TokenType2["STAR"] = 35] = "STAR";
    TokenType2[TokenType2["PERCENT_EQUAL"] = 36] = "PERCENT_EQUAL";
    TokenType2[TokenType2["PERCENT"] = 37] = "PERCENT";
    TokenType2[TokenType2["BYTE"] = 38] = "BYTE";
    TokenType2[TokenType2["BOOL"] = 39] = "BOOL";
    TokenType2[TokenType2["BREAK"] = 40] = "BREAK";
    TokenType2[TokenType2["CONTINUE"] = 41] = "CONTINUE";
    TokenType2[TokenType2["DEF"] = 42] = "DEF";
    TokenType2[TokenType2["ELSE"] = 43] = "ELSE";
    TokenType2[TokenType2["FALSE"] = 44] = "FALSE";
    TokenType2[TokenType2["FOR"] = 45] = "FOR";
    TokenType2[TokenType2["FLOAT"] = 46] = "FLOAT";
    TokenType2[TokenType2["IF"] = 47] = "IF";
    TokenType2[TokenType2["INT"] = 48] = "INT";
    TokenType2[TokenType2["LEN"] = 49] = "LEN";
    TokenType2[TokenType2["PRINT"] = 50] = "PRINT";
    TokenType2[TokenType2["RETURN"] = 51] = "RETURN";
    TokenType2[TokenType2["STRUCT"] = 52] = "STRUCT";
    TokenType2[TokenType2["TRUE"] = 53] = "TRUE";
    TokenType2[TokenType2["VAR"] = 54] = "VAR";
    TokenType2[TokenType2["VOID"] = 55] = "VOID";
    TokenType2[TokenType2["WHILE"] = 56] = "WHILE";
    TokenType2[TokenType2["EOF"] = 57] = "EOF";
    return TokenType2;
  })(TokenType || {});
  var TokenPattern = {
    [0 /* IDENTIFIER */]: /[a-zA-Z_][a-zA-Z0-9_]*/y,
    [1 /* STRING */]: /"[^"]*"/y,
    [2 /* SINGLE_QUOTE_STRING */]: /'[^']*'/y,
    [3 /* NUMBER_DECIMAL */]: /\d+\.\d*/y,
    [4 /* NUMBER_HEX */]: /0x[a-fA-F0-9]+/y,
    [5 /* NUMBER */]: /\d+/y,
    [6 /* COMMENT */]: /\/\/.*/y,
    [7 /* LEFT_PAREN */]: /\(/y,
    [8 /* RIGHT_PAREN */]: /\)/y,
    [9 /* LEFT_BRACE */]: /\{/y,
    [10 /* RIGHT_BRACE */]: /\}/y,
    [11 /* LEFT_BRACKET */]: /\[/y,
    [12 /* RIGHT_BRACKET */]: /\]/y,
    [13 /* COMMA */]: /,/y,
    [14 /* DOT */]: /\./y,
    [15 /* SEMICOLON */]: /;/y,
    [16 /* TILDE */]: /~/y,
    [17 /* BANG_EQUAL */]: /!=/y,
    [18 /* BANG */]: /!/y,
    [19 /* EQUAL_EQUAL */]: /==/y,
    [20 /* EQUAL */]: /=/y,
    [21 /* GREATER_EQUAL */]: />=/y,
    [22 /* GREATER */]: />/y,
    [23 /* LESS_EQUAL */]: /<=/y,
    [24 /* LESS */]: /</y,
    [25 /* AMP_AMP */]: /&&/y,
    [26 /* AMP */]: /&/y,
    [27 /* BAR_BAR */]: /\|\|/y,
    [28 /* MINUS_EQUAL */]: /-=/y,
    [29 /* MINUS */]: /-/y,
    [30 /* PLUS_EQUAL */]: /\+=/y,
    [31 /* PLUS */]: /\+/y,
    [32 /* SLASH_EQUAL */]: /\/=/y,
    [33 /* SLASH */]: /\//y,
    [34 /* STAR_EQUAL */]: /\*=/y,
    [35 /* STAR */]: /\*/y,
    [36 /* PERCENT_EQUAL */]: /%=/y,
    [37 /* PERCENT */]: /%/y,
    [38 /* BYTE */]: /byte/y,
    [39 /* BOOL */]: /bool/y,
    [40 /* BREAK */]: /break/y,
    [41 /* CONTINUE */]: /continue/y,
    [42 /* DEF */]: /def/y,
    [43 /* ELSE */]: /else/y,
    [44 /* FALSE */]: /false/y,
    [45 /* FOR */]: /for/y,
    [46 /* FLOAT */]: /float/y,
    [47 /* IF */]: /if/y,
    [48 /* INT */]: /int/y,
    [49 /* LEN */]: /len/y,
    [50 /* PRINT */]: /print/y,
    [51 /* RETURN */]: /return/y,
    [52 /* STRUCT */]: /struct/y,
    [53 /* TRUE */]: /true/y,
    [54 /* VAR */]: /var/y,
    [55 /* VOID */]: /void/y,
    [56 /* WHILE */]: /while/y,
    [57 /* EOF */]: /$/y
  };

  // src/scanner.ts
  function fakeToken(type, lexeme, tokenProvidingLocation = null) {
    return new Token(
      type,
      lexeme,
      null,
      tokenProvidingLocation ? tokenProvidingLocation.offset : 0,
      tokenProvidingLocation ? tokenProvidingLocation.source : ""
    );
  }
  var i32 = new Uint32Array(1);
  function parseInt32(str) {
    i32[0] = parseInt(str);
    return i32[0];
  }
  var Token = class {
    constructor(type, lexeme, literal, offset, source) {
      this.type = type;
      this.lexeme = lexeme;
      this.literal = literal;
      this.offset = offset;
      this.source = source;
    }
    line() {
      let lines = 1;
      for (let i = 0; i < this.offset; i++) {
        if (this.source.charAt(i) == "\n") {
          lines++;
        }
      }
      return lines;
    }
    lineStr(showPointer = true) {
      let start = 0;
      for (let i = 0; i < this.offset; i++) {
        if (this.source.charAt(i) == "\n") {
          start = i + 1;
        }
      }
      let end = this.offset + this.lexeme.length;
      for (let i = end; i < this.source.length; i++) {
        if (this.source.charAt(i) == "\n") {
          end = i;
          break;
        }
      }
      const snippet = this.source.substring(start, end);
      let ptr = "";
      for (let i = 0; i < this.offset - start; i++) {
        ptr += " ";
      }
      ptr += "^";
      return showPointer ? `${snippet}
${ptr}` : snippet;
    }
    toString() {
      return TokenType[this.type] + " " + this.lexeme + " " + this.literal;
    }
  };
  function match(source, current, pattern) {
    pattern.lastIndex = current;
    return source.match(pattern);
  }
  function scanTokens(source, reportError) {
    const WHITESPACE = /\s+/y;
    const tokens = [];
    let current = 0;
    scanner:
      while (current < source.length) {
        const ws = match(source, current, WHITESPACE);
        if (ws !== null) {
          current += ws[0].length;
          continue scanner;
        }
        token:
          for (let t = 0 /* IDENTIFIER */; t < 38 /* BYTE */; t++) {
            const m = match(source, current, TokenPattern[t]);
            if (m !== null) {
              const lexeme = m[0];
              if (t === 0 /* IDENTIFIER */) {
                keyword:
                  for (let k = 38 /* BYTE */; k <= 56 /* WHILE */; k++) {
                    const keywordMatch = match(source, current, TokenPattern[k]);
                    if (keywordMatch !== null && keywordMatch[0] === lexeme) {
                      t = k;
                      break keyword;
                    }
                  }
                tokens.push(new Token(t, lexeme, null, current, source));
              } else if (t === 1 /* STRING */) {
                const val = lexeme.substring(1, lexeme.length - 1);
                tokens.push(new Token(t, lexeme, val, current, source));
              } else if (t === 2 /* SINGLE_QUOTE_STRING */) {
                const val = lexeme.substring(1, lexeme.length - 1);
                tokens.push(new Token(t, lexeme, val, current, source));
              } else if (t === 3 /* NUMBER_DECIMAL */) {
                const val = parseFloat(lexeme);
                tokens.push(new Token(t, lexeme, val, current, source));
              } else if (t === 5 /* NUMBER */) {
                const val = parseInt(lexeme);
                tokens.push(new Token(t, lexeme, val, current, source));
              } else if (t === 4 /* NUMBER_HEX */) {
                const val = parseInt32(lexeme);
                const token = new Token(t, lexeme, val, current, source);
                tokens.push(token);
                if (lexeme.length > 2 + 8) {
                  reportError(token.line(), `Hex literal does not fit in any numeric type.`);
                }
              } else if (t !== 6 /* COMMENT */) {
                tokens.push(new Token(t, lexeme, null, current, source));
              }
              current += lexeme.length;
              continue scanner;
            }
          }
        let line = 1;
        for (let i = 0; i < current; i++) {
          if (source.charAt(i) == "\n") {
            line++;
          }
        }
        reportError(line, `Unexpected character '${source.charAt(current)}'.`);
        current++;
      }
    tokens.push(new Token(57 /* EOF */, "", null, current, source));
    return tokens;
  }

  // src/nodes.ts
  var NodeKind = /* @__PURE__ */ ((NodeKind2) => {
    NodeKind2[NodeKind2["ASSIGN_EXPR"] = 0] = "ASSIGN_EXPR";
    NodeKind2[NodeKind2["BINARY_EXPR"] = 1] = "BINARY_EXPR";
    NodeKind2[NodeKind2["CALL_EXPR"] = 2] = "CALL_EXPR";
    NodeKind2[NodeKind2["CAST_EXPR"] = 3] = "CAST_EXPR";
    NodeKind2[NodeKind2["DEREF_EXPR"] = 4] = "DEREF_EXPR";
    NodeKind2[NodeKind2["DOT_EXPR"] = 5] = "DOT_EXPR";
    NodeKind2[NodeKind2["GROUP_EXPR"] = 6] = "GROUP_EXPR";
    NodeKind2[NodeKind2["INDEX_EXPR"] = 7] = "INDEX_EXPR";
    NodeKind2[NodeKind2["LEN_EXPR"] = 8] = "LEN_EXPR";
    NodeKind2[NodeKind2["LIST_EXPR"] = 9] = "LIST_EXPR";
    NodeKind2[NodeKind2["LITERAL_EXPR"] = 10] = "LITERAL_EXPR";
    NodeKind2[NodeKind2["LOGICAL_EXPR"] = 11] = "LOGICAL_EXPR";
    NodeKind2[NodeKind2["UNARY_EXPR"] = 12] = "UNARY_EXPR";
    NodeKind2[NodeKind2["VARIABLE_EXPR"] = 13] = "VARIABLE_EXPR";
    NodeKind2[NodeKind2["BLOCK_STMT"] = 14] = "BLOCK_STMT";
    NodeKind2[NodeKind2["EXPRESSION_STMT"] = 15] = "EXPRESSION_STMT";
    NodeKind2[NodeKind2["FUNCTION_STMT"] = 16] = "FUNCTION_STMT";
    NodeKind2[NodeKind2["IF_STMT"] = 17] = "IF_STMT";
    NodeKind2[NodeKind2["LOOP_CONTROL_STMT"] = 18] = "LOOP_CONTROL_STMT";
    NodeKind2[NodeKind2["PRINT_STMT"] = 19] = "PRINT_STMT";
    NodeKind2[NodeKind2["RETURN_STMT"] = 20] = "RETURN_STMT";
    NodeKind2[NodeKind2["STRUCT_STMT"] = 21] = "STRUCT_STMT";
    NodeKind2[NodeKind2["VAR_STMT"] = 22] = "VAR_STMT";
    NodeKind2[NodeKind2["WHILE_STMT"] = 23] = "WHILE_STMT";
    return NodeKind2;
  })(NodeKind || {});
  function assignExpr({ left, operator, right }) {
    return {
      kind: 0 /* ASSIGN_EXPR */,
      operator,
      left,
      right,
      resolvedType: null
    };
  }
  function binaryExpr({ left, operator, right }) {
    return {
      kind: 1 /* BINARY_EXPR */,
      left,
      operator,
      right,
      resolvedType: null
    };
  }
  function callExpr({ callee, paren, args }) {
    return {
      kind: 2 /* CALL_EXPR */,
      callee,
      paren,
      args,
      resolvedType: null
    };
  }
  function castExpr({ token, type, value }) {
    return {
      kind: 3 /* CAST_EXPR */,
      token,
      type,
      value,
      resolvedType: null
    };
  }
  function derefExpr({ operator, value }) {
    return {
      kind: 4 /* DEREF_EXPR */,
      operator,
      value,
      resolvedType: null
    };
  }
  function dotExpr({ callee, dot, identifier }) {
    return {
      kind: 5 /* DOT_EXPR */,
      callee,
      dot,
      identifier,
      resolvedType: null
    };
  }
  function groupExpr({ expression }) {
    return {
      kind: 6 /* GROUP_EXPR */,
      expression,
      resolvedType: null
    };
  }
  function indexExpr({ callee, bracket, index }) {
    return {
      kind: 7 /* INDEX_EXPR */,
      callee,
      bracket,
      index,
      resolvedType: null
    };
  }
  function lenExpr({ value }) {
    return {
      kind: 8 /* LEN_EXPR */,
      value,
      resolvedLength: null,
      resolvedType: IntType
    };
  }
  function listExpr({ values, bracket }) {
    return {
      kind: 9 /* LIST_EXPR */,
      bracket,
      initializer: {
        kind: 0 /* LIST */,
        values
      },
      resolvedType: null
    };
  }
  function repeatExpr({ bracket, value, length }) {
    return {
      kind: 9 /* LIST_EXPR */,
      bracket,
      initializer: {
        kind: 1 /* REPEAT */,
        value,
        length
      },
      resolvedType: null
    };
  }
  function literalExpr({ value, type }) {
    return {
      kind: 10 /* LITERAL_EXPR */,
      value,
      type,
      resolvedType: null
    };
  }
  function logicalExpr({ left, operator, right }) {
    return {
      kind: 11 /* LOGICAL_EXPR */,
      left,
      operator,
      right,
      resolvedType: null
    };
  }
  function unaryExpr({ operator, value }) {
    return {
      kind: 12 /* UNARY_EXPR */,
      operator,
      value,
      resolvedType: null
    };
  }
  function variableExpr({ name }) {
    return {
      kind: 13 /* VARIABLE_EXPR */,
      name,
      resolvedType: null,
      resolvedSymbol: null
    };
  }
  var TypeCategory = /* @__PURE__ */ ((TypeCategory2) => {
    TypeCategory2[TypeCategory2["ARRAY"] = 0] = "ARRAY";
    TypeCategory2[TypeCategory2["BOOL"] = 1] = "BOOL";
    TypeCategory2[TypeCategory2["BYTE"] = 2] = "BYTE";
    TypeCategory2[TypeCategory2["ERROR"] = 3] = "ERROR";
    TypeCategory2[TypeCategory2["FLOAT"] = 4] = "FLOAT";
    TypeCategory2[TypeCategory2["INT"] = 5] = "INT";
    TypeCategory2[TypeCategory2["POINTER"] = 6] = "POINTER";
    TypeCategory2[TypeCategory2["STRUCT"] = 7] = "STRUCT";
    TypeCategory2[TypeCategory2["VOID"] = 8] = "VOID";
    return TypeCategory2;
  })(TypeCategory || {});
  var ErrorType = {
    category: 3 /* ERROR */
  };
  var VoidType = {
    category: 8 /* VOID */
  };
  var IntType = {
    category: 5 /* INT */
  };
  var FloatType = {
    category: 4 /* FLOAT */
  };
  var ByteType = {
    category: 2 /* BYTE */
  };
  var BoolType = {
    category: 1 /* BOOL */
  };
  function arrayType(elementType, length) {
    return {
      category: 0 /* ARRAY */,
      elementType,
      length
    };
  }
  function unresolvedStructType(name) {
    return {
      category: 7 /* STRUCT */,
      name,
      resolvedStruct: null
    };
  }
  function resolvedStructType(struct) {
    return {
      category: 7 /* STRUCT */,
      name: struct.name,
      resolvedStruct: struct
    };
  }
  function ptrType(elementType) {
    return {
      category: 6 /* POINTER */,
      elementType
    };
  }
  function isEqual(a, b) {
    if (a.category === 0 /* ARRAY */ && b.category === 0 /* ARRAY */) {
      return isEqual(a.elementType, b.elementType) && a.length === b.length;
    }
    if (a.category === 7 /* STRUCT */ && b.category === 7 /* STRUCT */) {
      if (a.resolvedStruct === null) {
        throw new Error(`Attempting to compare an unresolved type ${a.name.lexeme}`);
      }
      if (b.resolvedStruct === null) {
        throw new Error(`Attempting to compare an unresolved type ${b.name.lexeme}`);
      }
      return a.resolvedStruct === b.resolvedStruct;
    }
    if (a.category === 6 /* POINTER */ && b.category === 6 /* POINTER */) {
      return isEqual(a.elementType, b.elementType);
    }
    return a.category === b.category;
  }
  function isValidElementType(t) {
    if (isEqual(t, ErrorType)) {
      return true;
    }
    return !isEqual(t, VoidType);
  }
  function sizeof(t) {
    switch (t.category) {
      case 0 /* ARRAY */: {
        return sizeof(t.elementType) * t.length;
      }
      case 7 /* STRUCT */: {
        let size = 0;
        if (t.resolvedStruct) {
          t.resolvedStruct.members.forEach((member) => {
            size += sizeof(member.type);
          });
        } else {
          throw new Error("Cannot compute sizeof unresolved struct type");
        }
        return size;
      }
      case 6 /* POINTER */:
      case 5 /* INT */:
      case 4 /* FLOAT */: {
        return 4;
      }
      case 2 /* BYTE */:
      case 1 /* BOOL */: {
        return 1;
      }
      case 8 /* VOID */: {
        return 0;
      }
      case 3 /* ERROR */: {
        throw new Error(`Unhandled type ${typeToString(t)} for sizeof`);
      }
    }
  }
  function isScalar(t) {
    switch (t.category) {
      case 0 /* ARRAY */:
      case 3 /* ERROR */:
      case 7 /* STRUCT */:
      case 8 /* VOID */: {
        return false;
      }
      case 1 /* BOOL */:
      case 2 /* BYTE */:
      case 4 /* FLOAT */:
      case 5 /* INT */:
      case 6 /* POINTER */: {
        return true;
      }
    }
  }
  function isNumeric(t) {
    switch (t.category) {
      case 0 /* ARRAY */:
      case 1 /* BOOL */:
      case 3 /* ERROR */:
      case 6 /* POINTER */:
      case 7 /* STRUCT */:
      case 8 /* VOID */: {
        return false;
      }
      case 5 /* INT */:
      case 4 /* FLOAT */:
      case 2 /* BYTE */: {
        return true;
      }
    }
  }
  function canCast(from, to) {
    if (isEqual(from, ErrorType) || isEqual(to, ErrorType)) {
      return true;
    }
    if ((isNumeric(from) || isEqual(from, BoolType)) && (isNumeric(to) || isEqual(to, BoolType))) {
      return true;
    }
    if (from.category === 6 /* POINTER */ && to.category === 6 /* POINTER */) {
      return true;
    }
    return isEqual(from, to);
  }
  function canCoerce(from, to) {
    if (from.category === 3 /* ERROR */ || to.category === 3 /* ERROR */) {
      return true;
    }
    if (isEqual(from, to)) {
      return true;
    }
    switch (from.category) {
      case 0 /* ARRAY */:
      case 8 /* VOID */:
      case 6 /* POINTER */:
      case 7 /* STRUCT */: {
        return false;
      }
    }
    switch (to.category) {
      case 0 /* ARRAY */:
      case 8 /* VOID */:
      case 6 /* POINTER */:
      case 7 /* STRUCT */: {
        return false;
      }
    }
    switch (from.category) {
      case 5 /* INT */: {
        switch (to.category) {
          case 5 /* INT */: {
            return true;
          }
          case 4 /* FLOAT */: {
            return true;
          }
          case 2 /* BYTE */: {
            return false;
          }
          case 1 /* BOOL */: {
            return true;
          }
        }
      }
      case 4 /* FLOAT */: {
        switch (to.category) {
          case 5 /* INT */: {
            return false;
          }
          case 4 /* FLOAT */: {
            return true;
          }
          case 2 /* BYTE */: {
            return false;
          }
          case 1 /* BOOL */: {
            return false;
          }
        }
      }
      case 2 /* BYTE */: {
        switch (to.category) {
          case 5 /* INT */: {
            return true;
          }
          case 4 /* FLOAT */: {
            return true;
          }
          case 2 /* BYTE */: {
            return true;
          }
          case 1 /* BOOL */: {
            return false;
          }
        }
      }
      case 1 /* BOOL */: {
        switch (to.category) {
          case 5 /* INT */: {
            return false;
          }
          case 4 /* FLOAT */: {
            return false;
          }
          case 2 /* BYTE */: {
            return false;
          }
          case 1 /* BOOL */: {
            return true;
          }
        }
      }
      default: {
        assertUnreachable(from);
      }
    }
  }
  function isNumberLiteral(node) {
    if (node.kind !== 10 /* LITERAL_EXPR */) {
      return false;
    }
    return isNumeric(node.type);
  }
  function canCoerceNumberLiteral(value, to) {
    if (!isNumeric(to)) {
      return false;
    }
    switch (to.category) {
      case 2 /* BYTE */: {
        return Number.isInteger(value) && value >= BYTE_MIN && value <= BYTE_MAX;
      }
      case 5 /* INT */: {
        return Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX;
      }
      case 4 /* FLOAT */: {
        return true;
      }
      default: {
        return false;
      }
    }
  }
  var NUMERIC_TYPE_PRECEDENCE = [ByteType, IntType, FloatType];
  function getLowestCommonNumeric(a, b) {
    if (!isNumeric(a) || !isNumeric(b)) {
      return null;
    }
    if (isEqual(a, b)) {
      return a;
    }
    for (let i = 0; i < NUMERIC_TYPE_PRECEDENCE.length; i++) {
      const t = NUMERIC_TYPE_PRECEDENCE[i];
      if (canCoerce(a, t) && canCoerce(b, t)) {
        return t;
      }
    }
    return null;
  }
  var INT_MIN = -2147483647;
  var INT_MAX = 2147483647;
  var BYTE_MIN = 0;
  var BYTE_MAX = 255;
  function blockStmt({ statements, scope }) {
    return {
      kind: 14 /* BLOCK_STMT */,
      statements,
      scope,
      isLiveAtEnd: null
    };
  }
  function expressionStmt({ expression }) {
    return {
      kind: 15 /* EXPRESSION_STMT */,
      expression,
      isLiveAtEnd: null
    };
  }
  function functionStmt({ name, params, returnType, block, scope, symbol }) {
    return {
      kind: 16 /* FUNCTION_STMT */,
      name,
      params,
      returnType,
      body: {
        block,
        scope
      },
      symbol,
      hoistedLocals: null
    };
  }
  function importedFunctionStmt({ name, params, returnType, symbol }) {
    return {
      kind: 16 /* FUNCTION_STMT */,
      name,
      params,
      returnType,
      body: null,
      symbol,
      hoistedLocals: null
    };
  }
  function ifStmt({ expression, thenBranch, elseBranch }) {
    return {
      kind: 17 /* IF_STMT */,
      expression,
      thenBranch,
      elseBranch,
      isLiveAtEnd: null
    };
  }
  function loopControlStmt({ keyword }) {
    return {
      kind: 18 /* LOOP_CONTROL_STMT */,
      keyword,
      isLiveAtEnd: null
    };
  }
  function printStmt({ expression, keyword }) {
    return {
      kind: 19 /* PRINT_STMT */,
      keyword,
      expression,
      isLiveAtEnd: null
    };
  }
  function returnStmt({ keyword, value }) {
    return {
      kind: 20 /* RETURN_STMT */,
      keyword,
      value,
      isLiveAtEnd: null
    };
  }
  function structStmt({ name, members }) {
    return {
      kind: 21 /* STRUCT_STMT */,
      name,
      members,
      symbol: null,
      isLiveAtEnd: null
    };
  }
  function varStmt({ name, initializer, type, symbol }) {
    return {
      kind: 22 /* VAR_STMT */,
      name,
      initializer,
      type,
      isLiveAtEnd: null,
      symbol
    };
  }
  function whileStmt({ expression, body, increment }) {
    return {
      kind: 23 /* WHILE_STMT */,
      expression,
      body,
      increment: increment != null ? increment : null,
      isLiveAtEnd: null
    };
  }
  var Scope = class {
    constructor(parent) {
      this.parent = parent;
      this.map = /* @__PURE__ */ new Map();
    }
    define(name, symbol) {
      this.map.set(name, symbol);
    }
    hasDirect(name) {
      return this.map.has(name);
    }
    forEach(cb) {
      this.map.forEach((symbol, key) => {
        cb(key, symbol);
      });
    }
    lookup(name, filter) {
      if (this.map.has(name)) {
        const symbol = this.map.get(name);
        if (filter(symbol)) {
          return symbol;
        }
      }
      if (this.parent) {
        return this.parent.lookup(name, filter);
      }
      return null;
    }
  };
  var Context = class {
    constructor() {
      this.nextID = 0;
      this.global = new Scope(null);
      this.stringLiterals = /* @__PURE__ */ new Map();
      this.topLevelStatements = [];
      this.globalInitOrder = null;
      const memcpy = importedFunctionStmt({
        name: fakeToken(0 /* IDENTIFIER */, "__memcpy__"),
        params: [
          {
            name: fakeToken(0 /* IDENTIFIER */, "src"),
            type: ptrType(ByteType)
          },
          {
            name: fakeToken(0 /* IDENTIFIER */, "dst"),
            type: ptrType(ByteType)
          }
        ],
        returnType: VoidType,
        symbol: null
      });
      memcpy.symbol = this.functionSymbol(memcpy);
      const sqrt = importedFunctionStmt({
        name: fakeToken(0 /* IDENTIFIER */, "__sqrt__"),
        params: [
          {
            name: fakeToken(0 /* IDENTIFIER */, "x"),
            type: FloatType
          }
        ],
        returnType: FloatType,
        symbol: null
      });
      sqrt.symbol = this.functionSymbol(sqrt);
      this.global.define(memcpy.name.lexeme, memcpy.symbol);
      this.global.define(sqrt.name.lexeme, sqrt.symbol);
    }
    variableSymbol(node, isGlobal) {
      return {
        kind: 0 /* VARIABLE */,
        node,
        isGlobal,
        id: this.nextID++,
        isAddressTaken: false
      };
    }
    functionSymbol(node) {
      return {
        kind: 1 /* FUNCTION */,
        node,
        id: this.nextID++
      };
    }
    paramSymbol(param) {
      return {
        kind: 2 /* PARAM */,
        param,
        id: this.nextID++,
        isAddressTaken: false
      };
    }
    structSymbol(node) {
      return {
        kind: 3 /* STRUCT */,
        node,
        id: this.nextID++
      };
    }
  };
  function typeToSExpr(type) {
    switch (type.category) {
      case 0 /* ARRAY */: {
        return `(arraytype ${type.length} ${typeToSExpr(type.elementType)})`;
      }
      case 6 /* POINTER */: {
        return `(ptr ${typeToSExpr(type.elementType)})`;
      }
      case 7 /* STRUCT */: {
        let out = "(";
        out += "struct ";
        out += "(";
        if (type.resolvedStruct) {
          type.resolvedStruct.members.forEach((member) => {
            out += `(${member.name.lexeme} ${typeToSExpr(member.type)})`;
          });
        } else {
          out += `unresolved '${type.name.lexeme}'`;
        }
        out += ")";
        out += ")";
        return out;
      }
      case 3 /* ERROR */: {
        return "<error-type>";
      }
      case 5 /* INT */:
      case 4 /* FLOAT */:
      case 2 /* BYTE */:
      case 1 /* BOOL */:
      case 8 /* VOID */: {
        return TypeCategory[type.category].toLowerCase();
      }
    }
  }
  function typeToString(type) {
    switch (type.category) {
      case 0 /* ARRAY */: {
        return `[${typeToString(type.elementType)}; ${type.length}]`;
      }
      case 6 /* POINTER */: {
        return `${typeToString(type.elementType)}~`;
      }
      case 7 /* STRUCT */: {
        return `${type.name.lexeme}`;
      }
      case 3 /* ERROR */: {
        return "<error-type>";
      }
      case 5 /* INT */:
      case 4 /* FLOAT */:
      case 2 /* BYTE */:
      case 1 /* BOOL */:
      case 8 /* VOID */: {
        return TypeCategory[type.category].toLowerCase();
      }
    }
  }
  function astToSExpr(node) {
    var _a;
    let out = "";
    switch (node.kind) {
      case 0 /* ASSIGN_EXPR */: {
        const op = node;
        out += "(";
        out += `assign ${astToSExpr(op.left)} ${astToSExpr(op.right)}`;
        out += ")";
        break;
      }
      case 1 /* BINARY_EXPR */: {
        const op = node;
        const operator = op.operator.lexeme;
        out += "(";
        out += `${operator} ${astToSExpr(op.left)} ${astToSExpr(op.right)}`;
        out += ")";
        break;
      }
      case 2 /* CALL_EXPR */: {
        const op = node;
        out += "(";
        out += `call ${astToSExpr(op.callee)} `;
        out += "(";
        op.args.forEach((arg, i) => {
          if (i > 0)
            out += " ";
          out += astToSExpr(arg);
        });
        out += ")";
        out += ")";
        break;
      }
      case 3 /* CAST_EXPR */: {
        const op = node;
        out += "(";
        out += `${typeToSExpr(op.type)} ${astToSExpr(op.value)}`;
        out += ")";
        break;
      }
      case 4 /* DEREF_EXPR */: {
        const op = node;
        out += `(deref ${astToSExpr(op.value)})`;
        break;
      }
      case 5 /* DOT_EXPR */: {
        const op = node;
        out += `(. ${astToSExpr(op.callee)} ${op.identifier.lexeme})`;
        break;
      }
      case 6 /* GROUP_EXPR */: {
        const op = node;
        out += "(";
        out += astToSExpr(op.expression);
        out += ")";
        break;
      }
      case 7 /* INDEX_EXPR */: {
        const op = node;
        out += "(";
        out += `index ${astToSExpr(op.callee)} ${astToSExpr(op.index)}`;
        out += ")";
        break;
      }
      case 8 /* LEN_EXPR */: {
        const op = node;
        out += `(len ${astToSExpr(op.value)})`;
        break;
      }
      case 9 /* LIST_EXPR */: {
        const op = node;
        out += "(";
        if (op.initializer.kind === 0 /* LIST */) {
          out += "list-initializer";
          op.initializer.values.forEach((val) => {
            out += ` ${astToSExpr(val)}`;
          });
        } else {
          out += `repeat-initializer ${op.initializer.length} ${astToSExpr(op.initializer.value)}`;
        }
        out += ")";
        break;
      }
      case 10 /* LITERAL_EXPR */: {
        const op = node;
        if (op.type.category === 4 /* FLOAT */ && Number.isInteger(op.value)) {
          out += op.value.toFixed(1);
        } else {
          out += JSON.stringify(op.value);
        }
        break;
      }
      case 11 /* LOGICAL_EXPR */: {
        const op = node;
        const operator = op.operator.lexeme;
        out += "(";
        out += `${operator} ${astToSExpr(op.left)} ${astToSExpr(op.right)}`;
        out += ")";
        break;
      }
      case 12 /* UNARY_EXPR */: {
        const op = node;
        const operator = op.operator.lexeme;
        out += "(";
        out += `${operator} ${astToSExpr(op.value)}`;
        out += ")";
        break;
      }
      case 13 /* VARIABLE_EXPR */: {
        const op = node;
        out += op.name.lexeme;
        break;
      }
      case 14 /* BLOCK_STMT */: {
        const op = node;
        out += "(";
        out += "block ";
        op.statements.forEach((stmt, i) => {
          if (i > 0)
            out += " ";
          out += astToSExpr(stmt);
        });
        out += ")";
        break;
      }
      case 15 /* EXPRESSION_STMT */: {
        const op = node;
        out += astToSExpr(op.expression);
        break;
      }
      case 16 /* FUNCTION_STMT */: {
        const op = node;
        out += "(";
        out += `def ${op.name.lexeme} `;
        out += "(";
        op.params.forEach((param, i) => {
          if (i > 0)
            out += " ";
          out += `(param ${param.name.lexeme} ${typeToSExpr(param.type)})`;
        });
        out += ") ";
        out += "(";
        (_a = op.body) == null ? void 0 : _a.block.forEach((stmt, i) => {
          if (i > 0)
            out += " ";
          out += astToSExpr(stmt);
        });
        out += ")";
        out += ")";
        break;
      }
      case 17 /* IF_STMT */: {
        const op = node;
        out += "(";
        out += `if ${astToSExpr(op.expression)} ${astToSExpr(op.thenBranch)} `;
        if (op.elseBranch !== null) {
          out += `${astToSExpr(op.elseBranch)} `;
        }
        out += ")";
        break;
      }
      case 18 /* LOOP_CONTROL_STMT */: {
        const op = node;
        out += `(${op.keyword.lexeme})`;
        break;
      }
      case 19 /* PRINT_STMT */: {
        const op = node;
        out += "(";
        out += `print ${astToSExpr(op.expression)}`;
        out += ")";
        break;
      }
      case 20 /* RETURN_STMT */: {
        const op = node;
        out += "(";
        out += `return ${op.value !== null ? astToSExpr(op.value) : "void"}`;
        out += ")";
        break;
      }
      case 21 /* STRUCT_STMT */: {
        const op = node;
        out += "(";
        out += `struct ${op.name.lexeme} `;
        out += "(";
        op.members.forEach((member) => {
          out += `(${member.name.lexeme} ${typeToSExpr(member.type)})`;
        });
        out += ")";
        out += ")";
        break;
      }
      case 22 /* VAR_STMT */: {
        const op = node;
        out += "(";
        out += `var ${op.name.lexeme} `;
        if (op.type !== null) {
          out += `${typeToSExpr(op.type)} `;
        }
        out += `${astToSExpr(op.initializer)}`;
        out += ")";
        break;
      }
      case 23 /* WHILE_STMT */: {
        const op = node;
        out += "(";
        out += `while ${astToSExpr(op.expression)} ${astToSExpr(op.body)}`;
        if (op.increment) {
          out += ` ${astToSExpr(op.increment)}`;
        }
        out += ")";
        break;
      }
      default: {
        assertUnreachable(node.kind);
      }
    }
    return out;
  }

  // src/parser.ts
  var ParseError = class extends Error {
  };
  var codec = new UTF8Codec();
  function parse(tokens, reportError) {
    const context = new Context();
    const scopes = [context.global];
    function peekScope() {
      return scopes[scopes.length - 1];
    }
    function pushScope() {
      scopes.push(new Scope(peekScope()));
    }
    function popScope() {
      return scopes.pop();
    }
    let current = 0;
    function match2(t) {
      if (check(t)) {
        advance();
        return true;
      }
      return false;
    }
    function check(t) {
      if (isAtEnd()) {
        return false;
      }
      return peek().type === t;
    }
    function peek() {
      return tokens[current];
    }
    function previous() {
      return tokens[current - 1];
    }
    function consume(t, msg) {
      if (check(t)) {
        const token = peek();
        advance();
        return token;
      }
      throw parseError(msg);
    }
    function parseError(msg) {
      return parseErrorForToken(peek(), msg);
    }
    function parseErrorForToken(token, msg) {
      reportError(token.line(), msg);
      return new ParseError(msg);
    }
    function advance() {
      if (!isAtEnd()) {
        current++;
      }
    }
    function synchronize() {
      advance();
      while (!isAtEnd()) {
        if (previous().type === 15 /* SEMICOLON */) {
          return;
        }
        switch (peek().type) {
          case 42 /* DEF */:
          case 52 /* STRUCT */:
          case 54 /* VAR */:
          case 47 /* IF */:
          case 50 /* PRINT */:
          case 51 /* RETURN */:
          case 56 /* WHILE */: {
            return;
          }
          default: {
            break;
          }
        }
        advance();
      }
    }
    function isAtEnd() {
      return peek().type === 57 /* EOF */;
    }
    function topDecl() {
      if (match2(42 /* DEF */))
        return funDecl();
      if (match2(52 /* STRUCT */))
        return structDecl();
      if (match2(54 /* VAR */))
        return varDecl();
      throw parseError("Only variable declarations and function definitions allowed at the top-level.");
    }
    function funDecl() {
      const name = consume(0 /* IDENTIFIER */, "Expect identifier after 'def'.");
      consume(7 /* LEFT_PAREN */, "Expect '(' after function name.");
      const params = [];
      while (!check(8 /* RIGHT_PAREN */) && !isAtEnd()) {
        if (params.length > 0) {
          consume(13 /* COMMA */, "Missing comma after parameter.");
        }
        const paramName = consume(0 /* IDENTIFIER */, "Expect identifier.");
        const paramType = type();
        params.push({
          name: paramName,
          type: paramType
        });
      }
      consume(8 /* RIGHT_PAREN */, "Expect ')' after parameters.");
      let returnType = VoidType;
      if (!check(9 /* LEFT_BRACE */)) {
        returnType = type();
      }
      consume(9 /* LEFT_BRACE */, "Expect '{' before function body.");
      pushScope();
      params.forEach((param) => {
        const scope2 = peekScope();
        if (scope2.hasDirect(param.name.lexeme)) {
          parseErrorForToken(param.name, `'${param.name.lexeme}' is already declared in this scope.`);
        } else {
          scope2.define(param.name.lexeme, context.paramSymbol(param));
        }
      });
      const statements = block();
      const scope = popScope();
      const node = functionStmt({
        name,
        params,
        returnType,
        block: statements,
        scope,
        symbol: null
      });
      const outerScope = peekScope();
      if (outerScope.hasDirect(name.lexeme)) {
        throw parseErrorForToken(name, `'${name.lexeme}' is already declared in this scope.`);
      } else {
        const symbol = context.functionSymbol(node);
        outerScope.define(name.lexeme, symbol);
        node.symbol = symbol;
      }
      return node;
    }
    function structDecl() {
      const name = consume(0 /* IDENTIFIER */, "Expect identifier after 'struct'.");
      consume(9 /* LEFT_BRACE */, "Expect '{' after struct name.");
      const members = [];
      const memberNames = /* @__PURE__ */ new Set();
      while (!check(10 /* RIGHT_BRACE */) && !isAtEnd()) {
        if (members.length > 0) {
          consume(13 /* COMMA */, "Missing comma after member.");
        }
        const paramName = consume(0 /* IDENTIFIER */, "Expect identifier.");
        const paramType = type();
        if (memberNames.has(paramName.lexeme)) {
          parseErrorForToken(paramName, `'${paramName.lexeme}' is already declared in member list.`);
        } else {
          memberNames.add(paramName.lexeme);
          members.push({
            name: paramName,
            type: paramType
          });
        }
      }
      consume(10 /* RIGHT_BRACE */, "Expect '}' after member list.");
      const node = structStmt({
        name,
        members
      });
      const scope = peekScope();
      if (scope.hasDirect(name.lexeme)) {
        throw parseErrorForToken(name, `'${name.lexeme}' is already declared in this scope.`);
      } else {
        const symbol = context.structSymbol(node);
        scope.define(name.lexeme, symbol);
        node.symbol = symbol;
      }
      return node;
    }
    function varDecl() {
      const name = consume(0 /* IDENTIFIER */, "Expect identifier after 'var'.");
      let varType = null;
      if (!check(20 /* EQUAL */)) {
        varType = type();
      }
      consume(20 /* EQUAL */, "Expect '=' after variable declaration.");
      const expr = expression();
      consume(15 /* SEMICOLON */, "Expect ';' after statement.");
      const node = varStmt({
        name,
        initializer: expr,
        type: varType,
        symbol: null
      });
      const scope = peekScope();
      if (scope.hasDirect(name.lexeme)) {
        parseErrorForToken(name, `'${name.lexeme}' is already declared in this scope.`);
      } else {
        const symbol = context.variableSymbol(node, scope === context.global);
        scope.define(name.lexeme, symbol);
        node.symbol = symbol;
      }
      return node;
    }
    function statement() {
      if (match2(47 /* IF */)) {
        return ifStmt2();
      }
      if (match2(50 /* PRINT */)) {
        return printStmt2();
      }
      if (match2(56 /* WHILE */)) {
        return whileStmt2();
      }
      if (match2(45 /* FOR */)) {
        return forStmt();
      }
      if (match2(51 /* RETURN */)) {
        return returnStmt2();
      }
      if (match2(9 /* LEFT_BRACE */)) {
        pushScope();
        const statements = block();
        const scope = popScope();
        return blockStmt({
          statements,
          scope
        });
      }
      if (match2(40 /* BREAK */) || match2(41 /* CONTINUE */)) {
        const keyword = previous();
        consume(15 /* SEMICOLON */, "expect ';' after statement.");
        return loopControlStmt({ keyword });
      }
      return expressionStmt2();
    }
    function expressionStmt2() {
      const expr = expression();
      consume(15 /* SEMICOLON */, "Expect ';' after expression statement.");
      return expressionStmt({
        expression: expr
      });
    }
    function ifStmt2() {
      consume(7 /* LEFT_PAREN */, "Expect '(' after 'if'.");
      const expr = expression();
      consume(8 /* RIGHT_PAREN */, "Expect ')' after if condition.");
      const thenBranch = statement();
      let elseBranch = null;
      if (match2(43 /* ELSE */)) {
        elseBranch = statement();
      }
      return ifStmt({
        expression: expr,
        thenBranch,
        elseBranch
      });
    }
    function printStmt2() {
      const keyword = previous();
      const expr = expression();
      consume(15 /* SEMICOLON */, "expect ';' after print statement.");
      return printStmt({
        keyword,
        expression: expr
      });
    }
    function returnStmt2() {
      const keyword = previous();
      if (match2(15 /* SEMICOLON */)) {
        return returnStmt({
          keyword,
          value: null
        });
      }
      const value = expression();
      consume(15 /* SEMICOLON */, "Expect ';' after return statement.");
      return returnStmt({
        keyword,
        value
      });
    }
    function whileStmt2() {
      consume(7 /* LEFT_PAREN */, "Expect '(' after 'while'.");
      const condition = expression();
      consume(8 /* RIGHT_PAREN */, "Expect ')' after loop condition.");
      const body = statement();
      return whileStmt({
        expression: condition,
        body
      });
    }
    function forStmt() {
      consume(7 /* LEFT_PAREN */, "Expect '(' after 'for'.");
      pushScope();
      let initializer = null;
      if (match2(15 /* SEMICOLON */)) {
        initializer = null;
      } else if (match2(54 /* VAR */)) {
        initializer = varDecl();
      } else {
        initializer = expressionStmt2();
      }
      let condition = null;
      if (!check(15 /* SEMICOLON */)) {
        condition = expression();
      } else {
        condition = literalExpr({
          value: true,
          type: BoolType
        });
      }
      consume(15 /* SEMICOLON */, "Expect ';' after loop condition.");
      let increment = null;
      if (!check(8 /* RIGHT_PAREN */)) {
        increment = expression();
      }
      consume(8 /* RIGHT_PAREN */, "Expect ')' after for clauses.");
      pushScope();
      let body = statement();
      const innerScope = popScope();
      const outerScope = popScope();
      const loop = whileStmt({
        expression: condition,
        increment: increment !== null ? expressionStmt({ expression: increment }) : null,
        body: blockStmt({
          statements: [body],
          scope: innerScope
        })
      });
      return blockStmt({
        statements: initializer ? [initializer, loop] : [loop],
        scope: outerScope
      });
    }
    function block() {
      const statements = [];
      while (!check(10 /* RIGHT_BRACE */) && !isAtEnd()) {
        try {
          if (match2(54 /* VAR */)) {
            const varStmt2 = varDecl();
            statements.push(varStmt2);
          } else {
            const stmt = statement();
            statements.push(stmt);
          }
        } catch (e) {
          if (e instanceof ParseError) {
            synchronize();
          } else {
            throw e;
          }
        }
      }
      consume(10 /* RIGHT_BRACE */, "Expect '}' after block.");
      return statements;
    }
    function type() {
      let baseType = null;
      if (match2(11 /* LEFT_BRACKET */)) {
        const elementType = type();
        consume(15 /* SEMICOLON */, "Expect ';' in array type.");
        const length = consume(5 /* NUMBER */, "Expect array length specifier.").literal;
        consume(12 /* RIGHT_BRACKET */, "Expect ']' after array type.");
        baseType = {
          category: 0 /* ARRAY */,
          elementType,
          length
        };
      } else if (match2(48 /* INT */)) {
        baseType = IntType;
      } else if (match2(46 /* FLOAT */)) {
        baseType = FloatType;
      } else if (match2(38 /* BYTE */)) {
        baseType = ByteType;
      } else if (match2(39 /* BOOL */)) {
        baseType = BoolType;
      } else if (match2(0 /* IDENTIFIER */)) {
        const name = previous();
        baseType = unresolvedStructType(name);
      }
      if (baseType !== null) {
        let outType = baseType;
        while (match2(16 /* TILDE */)) {
          if (isValidElementType(outType)) {
            outType = {
              category: 6 /* POINTER */,
              elementType: outType
            };
          } else {
            throw parseError(`Invalid type specifier starting at '${peek().lexeme}'.`);
          }
        }
        return outType;
      } else {
        throw parseError(`Invalid type specifier starting at '${peek().lexeme}'.`);
      }
    }
    function expression() {
      return exprAssignment();
    }
    function exprAssignment() {
      const expr = exprOr();
      const isValidAssignmentTarget = expr.kind === 13 /* VARIABLE_EXPR */ || expr.kind === 7 /* INDEX_EXPR */ || expr.kind === 4 /* DEREF_EXPR */ || expr.kind === 5 /* DOT_EXPR */;
      if (match2(20 /* EQUAL */)) {
        const operator = previous();
        const right = exprAssignment();
        if (isValidAssignmentTarget) {
          return assignExpr({
            operator,
            left: expr,
            right
          });
        }
        parseError("Invalid assignment target.");
      } else if (match2(30 /* PLUS_EQUAL */)) {
        const combinedOperator = previous();
        const right = exprAssignment();
        if (isValidAssignmentTarget) {
          return assignExpr({
            operator: combinedOperator,
            left: expr,
            right: binaryExpr({
              left: expr,
              operator: fakeToken(31 /* PLUS */, "+", combinedOperator),
              right
            })
          });
        }
        parseError("Invalid assignment target.");
      } else if (match2(28 /* MINUS_EQUAL */)) {
        const combinedOperator = previous();
        const right = exprAssignment();
        if (isValidAssignmentTarget) {
          return assignExpr({
            operator: combinedOperator,
            left: expr,
            right: binaryExpr({
              left: expr,
              operator: fakeToken(29 /* MINUS */, "-", combinedOperator),
              right
            })
          });
        }
        parseError("Invalid assignment target.");
      } else if (match2(34 /* STAR_EQUAL */)) {
        const combinedOperator = previous();
        const right = exprAssignment();
        if (isValidAssignmentTarget) {
          return assignExpr({
            operator: combinedOperator,
            left: expr,
            right: binaryExpr({
              left: expr,
              operator: fakeToken(35 /* STAR */, "*", combinedOperator),
              right
            })
          });
        }
        parseError("Invalid assignment target.");
      } else if (match2(32 /* SLASH_EQUAL */)) {
        const combinedOperator = previous();
        const right = exprAssignment();
        if (isValidAssignmentTarget) {
          return assignExpr({
            operator: combinedOperator,
            left: expr,
            right: binaryExpr({
              left: expr,
              operator: fakeToken(33 /* SLASH */, "/", combinedOperator),
              right
            })
          });
        }
        parseError("Invalid assignment target.");
      } else if (match2(36 /* PERCENT_EQUAL */)) {
        const combinedOperator = previous();
        const right = exprAssignment();
        if (isValidAssignmentTarget) {
          return assignExpr({
            operator: combinedOperator,
            left: expr,
            right: binaryExpr({
              left: expr,
              operator: fakeToken(37 /* PERCENT */, "%", combinedOperator),
              right
            })
          });
        }
        parseError("Invalid assignment target.");
      }
      return expr;
    }
    function exprOr() {
      let expr = exprAnd();
      while (match2(27 /* BAR_BAR */)) {
        const operator = previous();
        const right = exprAnd();
        expr = logicalExpr({
          left: expr,
          operator,
          right
        });
      }
      return expr;
    }
    function exprAnd() {
      let expr = exprEquality();
      while (match2(25 /* AMP_AMP */)) {
        const operator = previous();
        const right = exprEquality();
        expr = logicalExpr({
          left: expr,
          operator,
          right
        });
      }
      return expr;
    }
    function exprEquality() {
      let expr = exprComparison();
      while (match2(19 /* EQUAL_EQUAL */) || match2(17 /* BANG_EQUAL */)) {
        const operator = previous();
        const right = exprComparison();
        expr = binaryExpr({
          left: expr,
          operator,
          right
        });
      }
      return expr;
    }
    function exprComparison() {
      let expr = exprTerm();
      while (match2(22 /* GREATER */) || match2(21 /* GREATER_EQUAL */) || match2(24 /* LESS */) || match2(23 /* LESS_EQUAL */)) {
        const operator = previous();
        const right = exprTerm();
        expr = binaryExpr({
          left: expr,
          operator,
          right
        });
      }
      return expr;
    }
    function exprTerm() {
      let expr = exprFactor();
      while (match2(29 /* MINUS */) || match2(31 /* PLUS */)) {
        const operator = previous();
        const right = exprFactor();
        expr = binaryExpr({
          left: expr,
          operator,
          right
        });
      }
      return expr;
    }
    function exprFactor() {
      let expr = exprUnary();
      while (match2(33 /* SLASH */) || match2(35 /* STAR */) || match2(37 /* PERCENT */)) {
        const operator = previous();
        const right = exprUnary();
        expr = binaryExpr({
          left: expr,
          operator,
          right
        });
      }
      return expr;
    }
    function exprUnary() {
      if (match2(18 /* BANG */) || match2(29 /* MINUS */) || match2(26 /* AMP */)) {
        const operator = previous();
        const value = exprUnary();
        return unaryExpr({
          operator,
          value
        });
      }
      return exprCall();
    }
    function exprCall() {
      let expr = exprPrimary();
      if (match2(7 /* LEFT_PAREN */)) {
        const paren = previous();
        const args = [];
        while (!check(8 /* RIGHT_PAREN */) && !isAtEnd()) {
          if (args.length > 0) {
            consume(13 /* COMMA */, "Expect ',' between arguments.");
          }
          const arg = expression();
          args.push(arg);
        }
        consume(8 /* RIGHT_PAREN */, "Expect ')' after arguments.");
        expr = callExpr({
          callee: expr,
          paren,
          args
        });
      } else if (match2(9 /* LEFT_BRACE */)) {
        const brace = previous();
        const args = [];
        while (!check(10 /* RIGHT_BRACE */) && !isAtEnd()) {
          if (args.length > 0) {
            consume(13 /* COMMA */, "Expect ',' between member initializers.");
          }
          const arg = expression();
          args.push(arg);
        }
        consume(10 /* RIGHT_BRACE */, "Expect '}' after member initializers.");
        expr = callExpr({
          callee: expr,
          paren: brace,
          args
        });
      }
      while (match2(11 /* LEFT_BRACKET */) || match2(16 /* TILDE */) || match2(14 /* DOT */)) {
        const operator = previous();
        switch (operator.lexeme) {
          case "[": {
            const index = expression();
            consume(12 /* RIGHT_BRACKET */, "Expect ']' after index.");
            expr = indexExpr({
              callee: expr,
              bracket: operator,
              index
            });
            break;
          }
          case "~": {
            expr = derefExpr({
              operator,
              value: expr
            });
            break;
          }
          case ".": {
            const identifier = consume(0 /* IDENTIFIER */, "Expect identifier after '.'.");
            expr = dotExpr({
              callee: expr,
              dot: operator,
              identifier
            });
            break;
          }
          default: {
            throw new Error("Unhandled operator in call group");
          }
        }
      }
      return expr;
    }
    function exprPrimary() {
      if (match2(53 /* TRUE */) || match2(44 /* FALSE */)) {
        return literalExpr({
          value: previous().type === 53 /* TRUE */ ? true : false,
          type: BoolType
        });
      }
      if (match2(5 /* NUMBER */)) {
        return literalExpr({
          value: previous().literal,
          type: IntType
        });
      }
      if (match2(3 /* NUMBER_DECIMAL */)) {
        return literalExpr({
          value: previous().literal,
          type: FloatType
        });
      }
      if (match2(4 /* NUMBER_HEX */)) {
        return literalExpr({
          value: previous().literal,
          type: IntType
        });
      }
      if (match2(1 /* STRING */)) {
        const s = previous().literal;
        if (!context.stringLiterals.has(s)) {
          const bytes = codec.encodeString(s);
          const literal = literalExpr({
            value: s,
            type: arrayType(ByteType, bytes.byteLength)
          });
          context.stringLiterals.set(s, literal);
        }
        return context.stringLiterals.get(s);
      }
      if (match2(2 /* SINGLE_QUOTE_STRING */)) {
        const c = previous().literal;
        if (c.length !== 1) {
          throw parseError("Invalid character literal (use double quotes for strings).");
        } else if (!codec.isValidASCII(c)) {
          throw parseError("Invalid character literal (only ASCII characters allowed).");
        }
        return literalExpr({
          value: codec.encodeASCIIChar(c),
          type: ByteType
        });
      }
      if (match2(0 /* IDENTIFIER */)) {
        return variableExpr({
          name: previous()
        });
      }
      if (match2(7 /* LEFT_PAREN */)) {
        const expr = expression();
        consume(8 /* RIGHT_PAREN */, "Expect ')' matching '('.");
        return groupExpr({
          expression: expr
        });
      }
      if (match2(11 /* LEFT_BRACKET */)) {
        const bracket = previous();
        const values = [];
        if (!check(12 /* RIGHT_BRACKET */)) {
          const value = expression();
          if (match2(15 /* SEMICOLON */)) {
            const length = consume(5 /* NUMBER */, "Expect length specifier in array repeat literal.").literal;
            if (length < 0) {
              throw parseError("Array length specifier must be >=0.");
            }
            consume(12 /* RIGHT_BRACKET */, "Expect ']' after list literal.");
            return repeatExpr({
              bracket,
              value,
              length
            });
          }
          values.push(value);
          while (!check(12 /* RIGHT_BRACKET */) && !isAtEnd()) {
            if (values.length > 0) {
              consume(13 /* COMMA */, "Expect ',' between items in list literal.");
            }
            const val = expression();
            values.push(val);
          }
        }
        consume(12 /* RIGHT_BRACKET */, "Expect ']' after list literal.");
        return listExpr({ bracket, values });
      }
      if (check(48 /* INT */) || check(46 /* FLOAT */) || check(38 /* BYTE */) || check(39 /* BOOL */)) {
        const castType = type();
        switch (castType.category) {
          case 5 /* INT */:
          case 4 /* FLOAT */:
          case 2 /* BYTE */:
          case 1 /* BOOL */:
          case 6 /* POINTER */: {
            break;
          }
          default: {
            throw parseError("Cannot cast to this type.");
          }
        }
        consume(7 /* LEFT_PAREN */, "Expect '(' after type in cast expression.");
        const paren = previous();
        const value = expression();
        consume(8 /* RIGHT_PAREN */, "Expect ')' after cast expression.");
        return castExpr({
          token: paren,
          type: castType,
          value
        });
      }
      if (match2(49 /* LEN */)) {
        consume(7 /* LEFT_PAREN */, "Expect '(' before len expression.");
        const value = expression();
        consume(8 /* RIGHT_PAREN */, "Expect ')' after len expression.");
        return lenExpr({ value });
      }
      throw parseError("Expect expression.");
    }
    while (!isAtEnd()) {
      try {
        const stmt = topDecl();
        context.topLevelStatements.push(stmt);
      } catch (e) {
        if (e instanceof ParseError) {
          synchronize();
        } else {
          throw e;
        }
      }
    }
    return context;
  }

  // src/resolver.ts
  var ResolveError = class extends Error {
  };
  function fakeToken2(type, lexeme) {
    return new Token(type, lexeme, null, 0, "");
  }
  function resolve(context, reportError) {
    const global = context.global;
    let scopes = [global];
    function peekScope() {
      return scopes[scopes.length - 1];
    }
    function pushScope(scope) {
      scopes.push(scope);
    }
    function popScope() {
      return scopes.pop();
    }
    let functionStack = [];
    function peekFunction() {
      return functionStack.length > 0 ? functionStack[functionStack.length - 1] : null;
    }
    function pushFunction(fn) {
      functionStack.push(fn);
    }
    function popFunction() {
      return functionStack.pop();
    }
    let loopStack = [];
    function peekLoop() {
      return loopStack.length > 0 ? loopStack[loopStack.length - 1] : null;
    }
    function pushLoop(loop) {
      loopStack.push(loop);
    }
    function popLoop() {
      return loopStack.pop();
    }
    const walkedSet = /* @__PURE__ */ new Set();
    const walked = [];
    function preVisit(node) {
      walkedSet.add(node);
      walked.push(node);
    }
    function postVisit(node) {
      if (node.kind === 22 /* VAR_STMT */) {
        const isGlobal = scopes.length === 1;
        if (isGlobal) {
          globalInitOrder.push(node);
        }
      }
      walkedSet.delete(node);
      walked.pop();
    }
    const visited = /* @__PURE__ */ new Set();
    const globalInitOrder = [];
    function resolveError(token, msg) {
      reportError(token.line(), msg);
      return new ResolveError(msg);
    }
    function resolveNodeWithCoercion(node, isLiveAtEnd, type, token) {
      let out = node;
      resolveNode(node, isLiveAtEnd);
      if (!isEqual(node.resolvedType, type)) {
        const canCoerce2 = canCoerce(node.resolvedType, type) || isNumberLiteral(node) && canCoerceNumberLiteral(node.value, type);
        if (canCoerce2) {
          out = castExpr({
            token: fakeToken2(57 /* EOF */, ""),
            type,
            value: node
          });
          resolveNode(out, isLiveAtEnd);
        } else {
          resolveError(token, `Cannot implicitly convert operand to '${typeToString(type)}'.`);
        }
      }
      return out;
    }
    function resolveNode(node, isLiveAtEnd) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      preVisit(node);
      switch (node.kind) {
        case 0 /* ASSIGN_EXPR */: {
          const op = node;
          resolveNode(op.left, isLiveAtEnd);
          op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, op.left.resolvedType, op.operator);
          op.resolvedType = op.left.resolvedType;
          break;
        }
        case 1 /* BINARY_EXPR */: {
          const op = node;
          resolveNode(op.left, isLiveAtEnd);
          resolveNode(op.right, isLiveAtEnd);
          switch (op.operator.lexeme) {
            case "<":
            case "<=":
            case ">":
            case ">=": {
              const lct = getLowestCommonNumeric(op.left.resolvedType, op.right.resolvedType);
              if (lct) {
                op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator);
                op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator);
              } else {
                resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`);
              }
              op.resolvedType = BoolType;
              break;
            }
            case "!=":
            case "==": {
              const lct = getLowestCommonNumeric(op.left.resolvedType, op.right.resolvedType);
              if (lct) {
                op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator);
                op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator);
              } else if (!isEqual(op.left.resolvedType, op.right.resolvedType)) {
                const leftTypeStr = typeToString(op.left.resolvedType);
                const rightTypeStr = typeToString(op.right.resolvedType);
                resolveError(op.operator, `Cannot compare ${leftTypeStr} to ${rightTypeStr}.`);
              }
              op.resolvedType = BoolType;
              break;
            }
            case "%": {
              const lct = getLowestCommonNumeric(op.left.resolvedType, op.right.resolvedType);
              if (lct && (isEqual(lct, IntType) || isEqual(lct, ByteType))) {
                op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator);
                op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator);
              } else {
                resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`);
              }
              op.resolvedType = op.left.resolvedType;
              break;
            }
            case "+":
            case "-":
            case "*":
            case "/": {
              const leftType = op.left.resolvedType;
              const rightType = op.right.resolvedType;
              const lct = getLowestCommonNumeric(leftType, rightType);
              if (lct) {
                op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, lct, op.operator);
                op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, lct, op.operator);
                op.resolvedType = lct;
              } else if (op.operator.lexeme === "+" || op.operator.lexeme === "-") {
                if (leftType.category === 6 /* POINTER */ && isNumeric(rightType)) {
                  op.right = binaryExpr({
                    left: literalExpr({
                      value: sizeof(leftType.elementType),
                      type: IntType
                    }),
                    right: resolveNodeWithCoercion(op.right, isLiveAtEnd, IntType, op.operator),
                    operator: fakeToken2(35 /* STAR */, "*")
                  });
                  resolveNode(op.right, isLiveAtEnd);
                  op.resolvedType = leftType;
                } else if (rightType.category === 6 /* POINTER */ && isNumeric(leftType) && op.operator.lexeme === "+") {
                  op.left = binaryExpr({
                    left: literalExpr({
                      value: sizeof(rightType.elementType),
                      type: IntType
                    }),
                    right: resolveNodeWithCoercion(op.left, isLiveAtEnd, IntType, op.operator),
                    operator: fakeToken2(35 /* STAR */, "*")
                  });
                  resolveNode(op.left, isLiveAtEnd);
                  op.resolvedType = rightType;
                } else {
                  resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`);
                  op.resolvedType = ErrorType;
                }
              } else {
                if (!isEqual(leftType, ErrorType) && !isEqual(rightType, ErrorType)) {
                  resolveError(op.operator, `Invalid operand types for binary operator '${op.operator.lexeme}'.`);
                }
                op.resolvedType = ErrorType;
              }
              break;
            }
            default: {
              throw new Error(`unreachable`);
            }
          }
          break;
        }
        case 2 /* CALL_EXPR */: {
          const op = node;
          resolveNode(op.callee, isLiveAtEnd);
          if (op.callee.kind !== 13 /* VARIABLE_EXPR */) {
            resolveError(op.paren, `Cannot call this type.`);
          } else {
            const callee = op.callee;
            const symbol = callee.resolvedSymbol;
            if (!symbol) {
            } else if (symbol.kind === 1 /* FUNCTION */ && op.paren.lexeme === "(" || symbol.kind === 3 /* STRUCT */ && op.paren.lexeme === "{") {
              const fn = symbol;
              const params = fn.kind === 1 /* FUNCTION */ ? fn.node.params : fn.node.members;
              if (op.args.length !== params.length) {
                resolveError(op.paren, `Expected ${params.length} arguments but got ${op.args.length} in call to ${fn.node.name.lexeme}.`);
              } else {
                for (let i = 0; i < op.args.length; i++) {
                  const param = params[i];
                  op.args[i] = resolveNodeWithCoercion(op.args[i], isLiveAtEnd, param.type, op.paren);
                }
              }
              if (fn.kind === 1 /* FUNCTION */) {
                op.resolvedType = fn.node.returnType;
              } else {
                op.resolvedType = resolvedStructType(fn.node);
              }
            } else {
              const callMode = op.paren.lexeme === "{" ? "construct" : "call";
              resolveError(callee.name, `Cannot ${callMode} this type.`);
            }
          }
          op.resolvedType = (_a = op.resolvedType) != null ? _a : ErrorType;
          break;
        }
        case 3 /* CAST_EXPR */: {
          const op = node;
          resolveNode(op.value, isLiveAtEnd);
          if (!canCast(op.value.resolvedType, op.type)) {
            resolveError(op.token, `Cannot cast from ${typeToString(op.value.resolvedType)} to ${typeToString(op.type)}.`);
          }
          op.resolvedType = op.type;
          break;
        }
        case 4 /* DEREF_EXPR */: {
          const op = node;
          resolveNode(op.value, isLiveAtEnd);
          if (((_b = op.value.resolvedType) == null ? void 0 : _b.category) === 6 /* POINTER */) {
            op.resolvedType = op.value.resolvedType.elementType;
          } else {
            if (((_c = op.value.resolvedType) == null ? void 0 : _c.category) !== 3 /* ERROR */) {
              resolveError(op.operator, `Invalid operand for dereferencing operator '~'.`);
            }
            op.resolvedType = ErrorType;
          }
          break;
        }
        case 5 /* DOT_EXPR */: {
          const op = node;
          resolveNode(op.callee, isLiveAtEnd);
          if (((_d = op.callee.resolvedType) == null ? void 0 : _d.category) !== 7 /* STRUCT */) {
            if (!isEqual(op.callee.resolvedType, ErrorType)) {
              resolveError(op.dot, `Invalid operand for member access operator '.'.`);
            }
            op.resolvedType = ErrorType;
          } else {
            const struct = op.callee.resolvedType.resolvedStruct;
            for (const member of (_e = struct == null ? void 0 : struct.members) != null ? _e : []) {
              if (member.name.lexeme === op.identifier.lexeme) {
                op.resolvedType = member.type;
                break;
              }
            }
            if (op.resolvedType === null) {
              resolveError(op.identifier, `Struct ${struct == null ? void 0 : struct.name.lexeme} has no member '${op.identifier.lexeme}'.`);
              op.resolvedType = ErrorType;
            }
          }
          break;
        }
        case 6 /* GROUP_EXPR */: {
          const op = node;
          resolveNode(op.expression, isLiveAtEnd);
          op.resolvedType = op.expression.resolvedType;
          break;
        }
        case 7 /* INDEX_EXPR */: {
          const op = node;
          resolveNode(op.callee, isLiveAtEnd);
          resolveNode(op.index, isLiveAtEnd);
          if (op.callee.resolvedType.category !== 0 /* ARRAY */) {
            resolveError(op.bracket, `Index operator requires array type.`);
            op.resolvedType = ErrorType;
          } else {
            const arrayType2 = op.callee.resolvedType;
            switch (op.index.resolvedType) {
              case IntType:
              case ByteType: {
                op.resolvedType = arrayType2.elementType;
                break;
              }
              default: {
                resolveError(op.bracket, `Index operator requires int or byte type.`);
                op.resolvedType = arrayType2.elementType;
                break;
              }
            }
          }
          break;
        }
        case 8 /* LEN_EXPR */: {
          const op = node;
          resolveNode(op.value, isLiveAtEnd);
          if (((_f = op.value.resolvedType) == null ? void 0 : _f.category) === 0 /* ARRAY */) {
            op.resolvedLength = op.value.resolvedType.length;
          } else {
            op.resolvedLength = 0;
          }
          break;
        }
        case 9 /* LIST_EXPR */: {
          const op = node;
          const initializer = op.initializer;
          let elementType = null;
          if (initializer.kind === 0 /* LIST */) {
            if (initializer.values.length > 0) {
              resolveNode(initializer.values[0], isLiveAtEnd);
              elementType = initializer.values[0].resolvedType;
              for (let i = 1; i < initializer.values.length; i++) {
                resolveNode(initializer.values[i], isLiveAtEnd);
                if (!isEqual(initializer.values[i].resolvedType, elementType)) {
                  elementType = null;
                  break;
                }
              }
            }
            if (elementType && isValidElementType(elementType)) {
              op.resolvedType = arrayType(elementType, initializer.values.length);
            } else {
              if (initializer.values.length === 0) {
                resolveError(op.bracket, "Zero-length arrays are not allowed.");
              } else {
                resolveError(op.bracket, "Cannot infer type for literal.");
              }
              op.resolvedType = ErrorType;
            }
          } else {
            resolveNode(initializer.value, isLiveAtEnd);
            if (initializer.length === 0) {
              resolveError(op.bracket, "Zero-length arrays are not allowed.");
              op.resolvedType = ErrorType;
            } else if (!isValidElementType(initializer.value.resolvedType)) {
              resolveError(op.bracket, "Cannot infer type for literal.");
              op.resolvedType = ErrorType;
            } else {
              op.resolvedType = arrayType(initializer.value.resolvedType, initializer.length);
            }
          }
          break;
        }
        case 10 /* LITERAL_EXPR */: {
          const op = node;
          op.resolvedType = op.type;
          break;
        }
        case 11 /* LOGICAL_EXPR */: {
          const op = node;
          switch (op.operator.lexeme) {
            case "&&":
            case "||": {
              op.left = resolveNodeWithCoercion(op.left, isLiveAtEnd, BoolType, op.operator);
              op.right = resolveNodeWithCoercion(op.right, isLiveAtEnd, BoolType, op.operator);
              op.resolvedType = BoolType;
              break;
            }
            default: {
              throw new Error(`unreachable`);
            }
          }
          break;
        }
        case 12 /* UNARY_EXPR */: {
          const op = node;
          switch (op.operator.lexeme) {
            case "!": {
              op.value = resolveNodeWithCoercion(op.value, isLiveAtEnd, BoolType, op.operator);
              op.resolvedType = BoolType;
              break;
            }
            case "-": {
              resolveNode(op.value, isLiveAtEnd);
              if (!isNumeric(op.value.resolvedType)) {
                resolveError(op.operator, `Invalid operand type for unary operator '-'.`);
                op.resolvedType = IntType;
              } else {
                if (isEqual(op.value.resolvedType, ByteType)) {
                  op.value = resolveNodeWithCoercion(op.value, isLiveAtEnd, IntType, op.operator);
                }
                op.resolvedType = op.value.resolvedType;
              }
              break;
            }
            case "&": {
              resolveNode(op.value, isLiveAtEnd);
              if (isValidElementType(op.value.resolvedType)) {
                if (op.value.kind === 13 /* VARIABLE_EXPR */) {
                  const symbol = op.value.resolvedSymbol;
                  if ((symbol == null ? void 0 : symbol.kind) === 2 /* PARAM */ || (symbol == null ? void 0 : symbol.kind) === 0 /* VARIABLE */) {
                    symbol.isAddressTaken = true;
                  }
                  op.resolvedType = {
                    category: 6 /* POINTER */,
                    elementType: op.value.resolvedType
                  };
                } else if (op.value.kind === 7 /* INDEX_EXPR */) {
                  op.resolvedType = {
                    category: 6 /* POINTER */,
                    elementType: op.value.resolvedType
                  };
                }
              }
              if (op.resolvedType === null) {
                resolveError(op.operator, `Invalid operand for unary operator '&'.`);
                op.resolvedType = ErrorType;
              }
              break;
            }
            default: {
              throw new Error(`unreachable`);
            }
          }
          break;
        }
        case 13 /* VARIABLE_EXPR */: {
          const op = node;
          const symbol = peekScope().lookup(op.name.lexeme, (sym) => {
            switch (sym.kind) {
              case 2 /* PARAM */:
              case 1 /* FUNCTION */:
              case 3 /* STRUCT */: {
                return true;
              }
              case 0 /* VARIABLE */: {
                const varSym = sym;
                return visited.has(varSym.node) || varSym.isGlobal;
              }
            }
          });
          if (symbol === null) {
            resolveError(op.name, `Undefined symbol '${op.name.lexeme}'.`);
            op.resolvedType = ErrorType;
          } else {
            op.resolvedSymbol = symbol;
            let resolveTypeFromSymbol = true;
            const fnSymbol = (symbol == null ? void 0 : symbol.kind) === 1 /* FUNCTION */ ? symbol : null;
            const structSymbol = (symbol == null ? void 0 : symbol.kind) === 3 /* STRUCT */ ? symbol : null;
            const varSymbol = (symbol == null ? void 0 : symbol.kind) === 0 /* VARIABLE */ ? symbol : null;
            const symbolDecl = (_h = (_g = fnSymbol == null ? void 0 : fnSymbol.node) != null ? _g : structSymbol == null ? void 0 : structSymbol.node) != null ? _h : varSymbol == null ? void 0 : varSymbol.node;
            if (symbolDecl && !visited.has(symbolDecl)) {
              const isGlobal = fnSymbol || structSymbol || varSymbol !== null && varSymbol.isGlobal;
              console.assert(isGlobal);
              const oldScopes = scopes;
              const oldFunctionStack = functionStack;
              scopes = [global];
              functionStack = [];
              resolveNode(symbolDecl, true);
              scopes = oldScopes;
              functionStack = oldFunctionStack;
            } else if (symbolDecl && walkedSet.has(symbolDecl)) {
              console.assert(symbolDecl.kind !== 21 /* STRUCT_STMT */);
              let cyclicVar = null;
              if (symbolDecl.kind === 22 /* VAR_STMT */) {
                cyclicVar = symbolDecl;
              } else {
                for (let i = walked.length - 1; walked[i] !== symbolDecl; i--) {
                  if (walked[i].kind === 22 /* VAR_STMT */) {
                    cyclicVar = walked[i];
                    break;
                  }
                }
              }
              if (cyclicVar !== null) {
                resolveError(cyclicVar.name, `Declaration of '${cyclicVar.name.lexeme}' is cyclic. Defined here:
${cyclicVar.name.lineStr()}`);
                op.resolvedType = ErrorType;
                resolveTypeFromSymbol = false;
              }
            }
            if (resolveTypeFromSymbol) {
              switch (symbol.kind) {
                case 1 /* FUNCTION */:
                case 3 /* STRUCT */: {
                  op.resolvedType = VoidType;
                  break;
                }
                case 2 /* PARAM */: {
                  op.resolvedType = symbol.param.type;
                  break;
                }
                case 0 /* VARIABLE */: {
                  const varSymbol2 = symbol;
                  console.assert(varSymbol2.node.type !== null);
                  op.resolvedType = varSymbol2.node.type;
                  break;
                }
              }
            }
          }
          break;
        }
        case 14 /* BLOCK_STMT */: {
          const op = node;
          pushScope(op.scope);
          if (op.statements.length > 0) {
            let prevIsLiveAtEnd = isLiveAtEnd;
            for (let i = 0; i < op.statements.length; i++) {
              resolveNode(op.statements[i], prevIsLiveAtEnd);
              prevIsLiveAtEnd = !!op.statements[i].isLiveAtEnd;
            }
            op.isLiveAtEnd = op.statements[op.statements.length - 1].isLiveAtEnd;
          } else {
            op.isLiveAtEnd = isLiveAtEnd;
          }
          popScope();
          break;
        }
        case 15 /* EXPRESSION_STMT */: {
          const op = node;
          resolveNode(op.expression, isLiveAtEnd);
          op.isLiveAtEnd = isLiveAtEnd;
          break;
        }
        case 16 /* FUNCTION_STMT */: {
          const op = node;
          op.params.forEach((param) => {
            param.type = resolveType(param.type);
          });
          op.returnType = resolveType(op.returnType);
          if (op.body) {
            pushScope(op.body.scope);
            pushFunction(op);
            let missingReturn = false;
            if (op.body.block.length > 0) {
              let prevIsLiveAtEnd = true;
              for (let i = 0; i < op.body.block.length; i++) {
                resolveNode(op.body.block[i], prevIsLiveAtEnd);
                prevIsLiveAtEnd = !!op.body.block[i].isLiveAtEnd;
              }
              if (op.body.block[op.body.block.length - 1].isLiveAtEnd) {
                missingReturn = true;
              }
            } else {
              missingReturn = true;
            }
            if (missingReturn && !isEqual(op.returnType, VoidType) && !isEqual(op.returnType, ErrorType)) {
              resolveError(
                op.name,
                `All control paths for ${op.name.lexeme} must return a value of type '${typeToString(op.returnType)}'.`
              );
            }
            popFunction();
            popScope();
          }
          break;
        }
        case 17 /* IF_STMT */: {
          const op = node;
          resolveNode(op.expression, isLiveAtEnd);
          resolveNode(op.thenBranch, isLiveAtEnd);
          const isLiveAfterThen = !!op.thenBranch.isLiveAtEnd;
          let isLiveAfterElse = isLiveAtEnd;
          if (op.elseBranch !== null) {
            resolveNode(op.elseBranch, isLiveAtEnd);
            isLiveAfterElse = !!op.elseBranch.isLiveAtEnd;
          }
          op.isLiveAtEnd = isLiveAfterThen || isLiveAfterElse;
          break;
        }
        case 18 /* LOOP_CONTROL_STMT */: {
          const op = node;
          if (peekLoop() === null) {
            resolveError(op.keyword, `Cannot ${op.keyword.lexeme} outside a loop.`);
          }
          op.isLiveAtEnd = isLiveAtEnd;
          break;
        }
        case 19 /* PRINT_STMT */: {
          const op = node;
          resolveNode(op.expression, isLiveAtEnd);
          const valueType = op.expression.resolvedType;
          if (isEqual(valueType, VoidType) || (valueType == null ? void 0 : valueType.category) === 6 /* POINTER */ || (valueType == null ? void 0 : valueType.category) === 7 /* STRUCT */) {
            resolveError(op.keyword, `Cannot print value of type '${typeToString(valueType)}'.`);
          }
          op.isLiveAtEnd = isLiveAtEnd;
          break;
        }
        case 20 /* RETURN_STMT */: {
          const op = node;
          const inFunction = peekFunction();
          if (inFunction === null) {
            resolveError(op.keyword, `Cannot return from top-level code.`);
          } else if (op.value !== null) {
            const value = op.value;
            resolveNode(value, isLiveAtEnd);
            console.assert(value.resolvedType !== null);
            if (!isEqual(inFunction.returnType, value.resolvedType)) {
              resolveError(op.keyword, `Expected a value of type '${typeToString(inFunction.returnType)}'.`);
            }
          } else {
            if (!isEqual(inFunction.returnType, VoidType)) {
              resolveError(op.keyword, `Expected a value of type '${typeToString(inFunction.returnType)}'.`);
            }
          }
          op.isLiveAtEnd = false;
          break;
        }
        case 21 /* STRUCT_STMT */: {
          const op = node;
          op.members.forEach((member) => {
            member.type = resolveType(member.type);
          });
          op.isLiveAtEnd = isLiveAtEnd;
          break;
        }
        case 22 /* VAR_STMT */: {
          const op = node;
          resolveNode(op.initializer, isLiveAtEnd);
          if (op.initializer.resolvedType === null) {
            console.log(`${astToSExpr(op)}`);
            throw new Error(`${astToSExpr(op)}`);
          }
          if (op.type === null) {
            op.type = op.initializer.resolvedType;
          } else {
            op.type = resolveType(op.type);
            if (!isEqual(op.type, op.initializer.resolvedType)) {
              if (!isEqual(op.initializer.resolvedType, ErrorType) && !isEqual(op.type, ErrorType)) {
                resolveError(
                  op.name,
                  `Cannot assign value of type '${typeToString(op.initializer.resolvedType)}' to variable of type '${typeToString(op.type)}'.`
                );
              }
            }
          }
          const inFunction = peekFunction();
          if ((inFunction == null ? void 0 : inFunction.body) && inFunction.body.scope !== peekScope() && op.symbol) {
            if (inFunction.hoistedLocals === null) {
              inFunction.hoistedLocals = /* @__PURE__ */ new Set();
            }
            inFunction.hoistedLocals.add(op.symbol);
          }
          op.isLiveAtEnd = isLiveAtEnd;
          break;
        }
        case 23 /* WHILE_STMT */: {
          const op = node;
          resolveNode(op.expression, isLiveAtEnd);
          pushLoop(op);
          resolveNode(op.body, isLiveAtEnd);
          popLoop();
          if (op.increment) {
            resolveNode(op.increment, isLiveAtEnd);
          }
          op.isLiveAtEnd = op.body.isLiveAtEnd;
          break;
        }
        default: {
          assertUnreachable(node.kind);
        }
      }
      postVisit(node);
    }
    function resolveType(type, isForPointerElement = false) {
      switch (type.category) {
        case 0 /* ARRAY */: {
          type.elementType = resolveType(type.elementType);
          return type;
        }
        case 7 /* STRUCT */: {
          const symbol = peekScope().lookup(type.name.lexeme, (_) => true);
          if (symbol === null || symbol.kind !== 3 /* STRUCT */) {
            resolveError(type.name, `Undefined typename '${type.name.lexeme}'.`);
            return ErrorType;
          } else {
            if (!visited.has(symbol.node)) {
              resolveNode(symbol.node, true);
            } else if (walkedSet.has(symbol.node) && !isForPointerElement) {
              resolveError(type.name, `Cyclic member declaration for struct '${symbol.node.name.lexeme}'.`);
            }
            type.resolvedStruct = symbol.node;
            return type;
          }
        }
        case 6 /* POINTER */: {
          type.elementType = resolveType(type.elementType, true);
          return type;
        }
        case 1 /* BOOL */:
        case 2 /* BYTE */:
        case 3 /* ERROR */:
        case 4 /* FLOAT */:
        case 5 /* INT */:
        case 8 /* VOID */: {
          return type;
        }
      }
    }
    context.topLevelStatements.forEach((stmt) => {
      resolveNode(stmt, true);
    });
    context.globalInitOrder = globalInitOrder;
  }

  // src/backend.ts
  var codec2 = new UTF8Codec();
  var STACK_TOP_BYTE_OFFSET = 512 * 1024;
  var DATA_TOP_BYTE_OFFSET = 1024 * 1024;
  var INITIAL_PAGES = 8 * 1024 * 1024 / (64 * 1024);
  function escapeString(str) {
    return str.replace(/'/g, "'").replace(/\\/g, "\\\\").replace(/"/g, '"');
  }
  function registerType(type) {
    switch (type.category) {
      case 0 /* ARRAY */:
      case 1 /* BOOL */:
      case 2 /* BYTE */:
      case 5 /* INT */:
      case 6 /* POINTER */:
      case 7 /* STRUCT */: {
        return "i32";
      }
      case 4 /* FLOAT */: {
        return "f32";
      }
      case 3 /* ERROR */:
      case 8 /* VOID */: {
        throw new Error(`Unhandled type ${TypeCategory[type.category]} for WASM backend`);
      }
    }
  }
  function defaultForRegisterType(type) {
    return `${type}.const 0`;
  }
  function wasmId(name, mangler) {
    let identifier = "$" + name;
    if (mangler !== void 0) {
      identifier += "_" + mangler;
    }
    return identifier;
  }
  function isVariableInRegister(symbol) {
    if (symbol.isAddressTaken) {
      return false;
    }
    const type = symbol.kind === 2 /* PARAM */ ? symbol.param.type : symbol.node.type;
    return type !== null && isScalar(type);
  }
  var DEBUG_COMMENTS = true;
  function emit(context) {
    var _a, _b;
    const globalLocs = /* @__PURE__ */ new Map();
    const stringLocs = /* @__PURE__ */ new Map();
    let localLocs = null;
    const INDENT_UNIT = "  ";
    let _indent = "";
    function indent() {
      _indent += INDENT_UNIT;
    }
    function dedent() {
      _indent = _indent.substring(0, _indent.length - INDENT_UNIT.length);
    }
    let output = "";
    function emit2(text) {
      output += text;
    }
    function line(text) {
      emit2(_indent + text + "\n");
    }
    function debugLine(text) {
      if (DEBUG_COMMENTS) {
        line(text);
      }
    }
    const skip = /* @__PURE__ */ new Set();
    let nextLabelID = 0;
    const loopStack = [];
    function peekLoop() {
      return loopStack.length > 0 ? loopStack[loopStack.length - 1] : null;
    }
    function pushLoop(loop) {
      loopStack.push(loop);
    }
    function popLoop() {
      return loopStack.pop();
    }
    function emitPushMem(type) {
      debugLine(`;; emitPushMem(${typeToString(type)})`);
      emitAllocStackVal(type);
      line(`global.get ${wasmId("__stack_ptr__")}`);
      line(`i32.const ${sizeof(type)}`);
      line(`call ${wasmId("__memcpy__")}`);
      line(`global.get ${wasmId("__stack_ptr__")}`);
    }
    function emitPushScalar(type, local) {
      debugLine(`;; emitPushScalar(${typeToString(type)})`);
      emitAllocStackVal(type);
      line(`global.get ${wasmId("__stack_ptr__")}`);
      line(`local.get ${wasmId(local)}`);
      emitStoreScalar(type);
      line(`global.get ${wasmId("__stack_ptr__")}`);
    }
    function emitDupTop(register) {
      const teeRegister = "__tee_" + register + "__";
      line(`local.tee ${wasmId(teeRegister)}`);
      line(`local.get ${wasmId(teeRegister)}`);
    }
    function emitSwapTop(topRegister, secondRegister) {
      line(`local.set ${wasmId("__swapa_" + topRegister + "__")}`);
      line(`local.set ${wasmId("__swapb_" + secondRegister + "__")}`);
      line(`local.get ${wasmId("__swapa_" + topRegister + "__")}`);
      line(`local.get ${wasmId("__swapb_" + secondRegister + "__")}`);
    }
    function emitStoreScalar(type) {
      switch (type.category) {
        case 1 /* BOOL */:
        case 2 /* BYTE */: {
          line(`i32.store8`);
          break;
        }
        case 4 /* FLOAT */: {
          line(`f32.store`);
          break;
        }
        case 5 /* INT */:
        case 6 /* POINTER */: {
          line(`i32.store`);
          break;
        }
        default: {
          throw new Error(`Unhandled element type ${typeToString(type)} for emitStoreScalar`);
        }
      }
    }
    function emitLoadScalar(type) {
      switch (type.category) {
        case 1 /* BOOL */:
        case 2 /* BYTE */: {
          line(`i32.load8_u`);
          break;
        }
        case 4 /* FLOAT */: {
          line(`f32.load`);
          break;
        }
        case 5 /* INT */:
        case 6 /* POINTER */: {
          line(`i32.load`);
          break;
        }
        default: {
          throw new Error(`Unhandled type ${typeToString(type)} for emitLoadScalar`);
        }
      }
    }
    function emitAllocStackVal(type) {
      line(`global.get ${wasmId("__stack_ptr__")}`);
      line(`i32.const ${sizeof(type)}`);
      line(`i32.sub`);
      line(`global.set ${wasmId("__stack_ptr__")}`);
    }
    function emitFreeStackVal(type) {
      line(`global.get ${wasmId("__stack_ptr__")}`);
      line(`i32.const ${sizeof(type)}`);
      line(`i32.add`);
      line(`global.set ${wasmId("__stack_ptr__")}`);
    }
    function emitLoc(symbol) {
      if (symbol.kind === 0 /* VARIABLE */ && symbol.isGlobal) {
        const loc = globalLocs.get(symbol);
        if (loc) {
          line(`i32.const ${loc}`);
        } else {
          throw new Error(`Cannot find global '${symbol.node.name.lexeme}' in emitLoc`);
        }
      } else {
        const offset = localLocs == null ? void 0 : localLocs.get(symbol);
        if (offset) {
          line(`local.get ${wasmId("__base_ptr__")}`);
          line(`i32.const ${offset}`);
          line(`i32.sub`);
        } else {
          throw new Error(`Cannot find local in emitLoc`);
        }
      }
    }
    function emitSetSymbol(symbol) {
      var _a2, _b2;
      const varSymbol = symbol.kind === 0 /* VARIABLE */ ? symbol : null;
      const paramSymbol = symbol.kind === 2 /* PARAM */ ? symbol : null;
      if (isVariableInRegister(symbol)) {
        if (varSymbol && varSymbol.isGlobal) {
          emitDupTop(registerType(varSymbol.node.type));
          line(`global.set ${wasmId(varSymbol.node.name.lexeme)}`);
        } else {
          const name = (_a2 = varSymbol == null ? void 0 : varSymbol.node.name.lexeme) != null ? _a2 : paramSymbol == null ? void 0 : paramSymbol.param.name.lexeme;
          line(`local.tee ${wasmId(name, symbol.id)}`);
        }
      } else {
        const type = (_b2 = varSymbol == null ? void 0 : varSymbol.node.type) != null ? _b2 : paramSymbol == null ? void 0 : paramSymbol.param.type;
        if (isScalar(type)) {
          emitDupTop(registerType(type));
          emitLoc(symbol);
          emitSwapTop("i32", registerType(type));
          emitStoreScalar(type);
        } else {
          emitLoc(symbol);
          line(`i32.const ${sizeof(type)}`);
          line(`call ${wasmId("__memcpy__")}`);
          emitLoc(symbol);
        }
      }
    }
    function emitGetSymbol(symbol) {
      var _a2, _b2;
      const varSymbol = symbol.kind === 0 /* VARIABLE */ ? symbol : null;
      const paramSymbol = symbol.kind === 2 /* PARAM */ ? symbol : null;
      if (isVariableInRegister(symbol)) {
        if (varSymbol && varSymbol.isGlobal) {
          line(`global.get ${wasmId(varSymbol.node.name.lexeme)}`);
        } else {
          const name = (_a2 = varSymbol == null ? void 0 : varSymbol.node.name.lexeme) != null ? _a2 : paramSymbol == null ? void 0 : paramSymbol.param.name.lexeme;
          line(`local.get ${wasmId(name, symbol.id)}`);
        }
      } else {
        emitLoc(symbol);
        const type = (_b2 = varSymbol == null ? void 0 : varSymbol.node.type) != null ? _b2 : paramSymbol == null ? void 0 : paramSymbol.param.type;
        if (isScalar(type)) {
          emitLoadScalar(type);
        } else {
        }
      }
    }
    function emitPrintASCIIChars(chars) {
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        line(`i32.const ${codec2.encodeASCIIChar(c)}`);
        line(`call ${wasmId("__putc__")}`);
      }
    }
    function emitPrintVal(type) {
      switch (type.category) {
        case 0 /* ARRAY */: {
          const elementType = type.elementType;
          if (isEqual(elementType, ByteType)) {
            for (let i = 0; i < type.length; i++) {
              const isLast = i === type.length - 1;
              if (!isLast) {
                emitDupTop("i32");
              }
              line(`i32.const ${i * sizeof(elementType)}`);
              line(`i32.add`);
              emitLoadScalar(elementType);
              line(`call ${wasmId("__putc__")}`);
            }
          } else {
            emitPrintASCIIChars(`[`);
            for (let i = 0; i < type.length; i++) {
              const isLast = i === type.length - 1;
              if (!isLast) {
                emitDupTop("i32");
              }
              line(`i32.const ${i * sizeof(elementType)}`);
              line(`i32.add`);
              if (isScalar(elementType)) {
                emitLoadScalar(elementType);
                emitPrintVal(elementType);
              } else {
                emitPrintVal(elementType);
              }
              if (!isLast) {
                emitPrintASCIIChars(`, `);
              }
            }
            emitPrintASCIIChars(`]`);
          }
          break;
        }
        case 2 /* BYTE */: {
          line(`i32.const 0x000000FF`);
          line(`i32.and`);
          line(`call ${wasmId("__puti__")}`);
          break;
        }
        case 1 /* BOOL */:
        case 5 /* INT */: {
          line(`call ${wasmId("__puti__")}`);
          break;
        }
        case 4 /* FLOAT */: {
          line(`call ${wasmId("__putf__")}`);
          break;
        }
        default: {
          throw new Error("Unexpected type for print");
        }
      }
    }
    function emitDebugComments(node) {
      switch (node.kind) {
        case 1 /* BINARY_EXPR */:
        case 3 /* CAST_EXPR */:
        case 6 /* GROUP_EXPR */:
        case 8 /* LEN_EXPR */:
        case 10 /* LITERAL_EXPR */:
        case 11 /* LOGICAL_EXPR */:
        case 12 /* UNARY_EXPR */:
        case 13 /* VARIABLE_EXPR */: {
          return;
        }
      }
      debugLine(``);
      debugLine(`;; visit ${NodeKind[node.kind]}`);
      debugLine(`;; ${astToSExpr(node)}`);
      debugLine(``);
    }
    function visit(node, exprMode = 1 /* RVALUE */) {
      var _a2, _b2, _c, _d, _e, _f;
      if (skip.has(node)) {
        return;
      }
      emitDebugComments(node);
      switch (node.kind) {
        case 0 /* ASSIGN_EXPR */: {
          const op = node;
          op.operator.lineStr(true).split("\n").forEach((l) => {
            debugLine(`;; ${l}`);
          });
          debugLine(``);
          if (op.left.kind === 13 /* VARIABLE_EXPR */) {
            const symbol = op.left.resolvedSymbol;
            visit(op.right);
            if (symbol.kind === 0 /* VARIABLE */ || symbol.kind === 2 /* PARAM */) {
              emitSetSymbol(symbol);
            } else {
              throw new Error("Cannot assign to function symbol");
            }
          } else {
            const elementType = op.resolvedType;
            if (isScalar(elementType)) {
              visit(op.left, 0 /* LVALUE */);
              visit(op.right);
              const teeRegister = "__tee_" + registerType(op.resolvedType) + "__";
              {
                line(`local.tee ${wasmId(teeRegister)}`);
                emitStoreScalar(elementType);
                line(`local.get ${wasmId(teeRegister)}`);
              }
            } else {
              visit(op.right);
              visit(op.left, 0 /* LVALUE */);
              const teeRegister = "__tee_" + registerType(op.resolvedType) + "__";
              {
                line(`local.tee ${wasmId(teeRegister)}`);
                line(`i32.const ${sizeof(elementType)}`);
                line(`call ${wasmId("__memcpy__")}`);
                line(`local.get ${wasmId(teeRegister)}`);
              }
            }
          }
          break;
        }
        case 1 /* BINARY_EXPR */: {
          const op = node;
          visit(op.left);
          visit(op.right);
          switch (op.operator.lexeme) {
            case "<": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.lt`);
              } else if (isEqual(op.left.resolvedType, ByteType)) {
                line(`i32.lt_u`);
              } else {
                line(`i32.lt_s`);
              }
              break;
            }
            case "<=": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.le`);
              } else if (isEqual(op.left.resolvedType, ByteType)) {
                line(`i32.le_u`);
              } else {
                line(`i32.le_s`);
              }
              break;
            }
            case ">": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.gt`);
              } else if (isEqual(op.left.resolvedType, ByteType)) {
                line(`i32.gt_u`);
              } else {
                line(`i32.gt_s`);
              }
              break;
            }
            case ">=": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.ge`);
              } else if (isEqual(op.left.resolvedType, ByteType)) {
                line(`i32.ge_u`);
              } else {
                line(`i32.ge_s`);
              }
              break;
            }
            case "!=": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.ne`);
              } else {
                line(`i32.ne`);
              }
              break;
            }
            case "==": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.eq`);
              } else {
                line(`i32.eq`);
              }
              break;
            }
            case "+": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.add`);
              } else {
                line(`i32.add`);
              }
              break;
            }
            case "-": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.sub`);
              } else {
                line(`i32.sub`);
              }
              break;
            }
            case "*": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.mul`);
              } else {
                line(`i32.mul`);
              }
              break;
            }
            case "/": {
              if (isEqual(op.left.resolvedType, FloatType)) {
                line(`f32.div`);
              } else {
                line(`i32.div_s`);
              }
              break;
            }
            case "%": {
              if (isEqual(op.left.resolvedType, ByteType)) {
                line(`i32.rem_u`);
              } else {
                line(`i32.rem_s`);
              }
              break;
            }
            default: {
              throw new Error(`unreachable`);
            }
          }
          break;
        }
        case 2 /* CALL_EXPR */: {
          const op = node;
          if (op.callee.kind === 13 /* VARIABLE_EXPR */) {
            const symbol = op.callee.resolvedSymbol;
            if ((symbol == null ? void 0 : symbol.kind) === 1 /* FUNCTION */) {
              op.args.forEach((arg) => {
                visit(arg);
              });
              const returnType = op.resolvedType;
              const pushReturnValToStack = !isScalar(returnType) && !isEqual(returnType, VoidType);
              if (pushReturnValToStack) {
                emitAllocStackVal(returnType);
              }
              line(`call ${wasmId(symbol.node.name.lexeme)}`);
              if (pushReturnValToStack) {
                line(`global.get ${wasmId("__stack_ptr__")}`);
                line(`i32.const ${sizeof(returnType)}`);
                line(`call ${wasmId("__memcpy__")}`);
                line(`global.get ${wasmId("__stack_ptr__")}`);
              }
            } else if ((symbol == null ? void 0 : symbol.kind) === 3 /* STRUCT */) {
              emitAllocStackVal(op.resolvedType);
              line(`global.get ${wasmId("__stack_ptr__")}`);
              const struct = op.resolvedType.resolvedStruct;
              let offset = 0;
              for (let i = 0; i < struct.members.length; i++) {
                emitDupTop("i32");
                line(`i32.const ${offset}`);
                line(`i32.add`);
                visit(op.args[i]);
                const member = struct.members[i];
                if (isScalar(member.type)) {
                  emitStoreScalar(member.type);
                } else {
                  emitSwapTop("i32", "i32");
                  line(`i32.const ${sizeof(member.type)}`);
                  line(`call ${wasmId("__memcpy__")}`);
                }
                offset += sizeof(member.type);
              }
            } else {
              throw new Error("Unexpected callee");
            }
          } else {
            throw new Error("Unexpected callee");
          }
          break;
        }
        case 3 /* CAST_EXPR */: {
          const op = node;
          visit(op.value);
          switch (op.type.category) {
            case 1 /* BOOL */: {
              switch ((_a2 = op.value.resolvedType) == null ? void 0 : _a2.category) {
                case 1 /* BOOL */:
                case 2 /* BYTE */:
                case 5 /* INT */: {
                  line(`i32.eqz`);
                  line(`i32.eqz`);
                  break;
                }
                case 4 /* FLOAT */: {
                  line(`f32.const 0`);
                  line(`f32.ne`);
                  break;
                }
                default: {
                  throw new Error(`Unexpected type ${typeToString(op.type)} for cast source`);
                }
              }
              break;
            }
            case 2 /* BYTE */: {
              switch ((_b2 = op.value.resolvedType) == null ? void 0 : _b2.category) {
                case 1 /* BOOL */:
                case 2 /* BYTE */:
                case 5 /* INT */: {
                  break;
                }
                case 4 /* FLOAT */: {
                  line(`i32.trunc_f32_s`);
                  break;
                }
                default: {
                  throw new Error(`Unexpected type ${typeToString(op.type)} for cast source`);
                }
              }
              break;
            }
            case 5 /* INT */: {
              switch ((_c = op.value.resolvedType) == null ? void 0 : _c.category) {
                case 2 /* BYTE */: {
                  line(`i32.const 0x000000FF`);
                  line(`i32.and`);
                  break;
                }
                case 1 /* BOOL */:
                case 5 /* INT */: {
                  break;
                }
                case 4 /* FLOAT */: {
                  line(`i32.trunc_f32_s`);
                  break;
                }
                default: {
                  throw new Error(`Unexpected type ${typeToString(op.type)} for cast source`);
                }
              }
              break;
            }
            case 4 /* FLOAT */: {
              switch ((_d = op.value.resolvedType) == null ? void 0 : _d.category) {
                case 1 /* BOOL */:
                case 2 /* BYTE */:
                case 5 /* INT */: {
                  line(`f32.convert_i32_s`);
                  break;
                }
                case 4 /* FLOAT */: {
                  break;
                }
                default: {
                  throw new Error(`Unexpected type ${typeToString(op.type)} for cast source`);
                }
              }
              break;
            }
            case 6 /* POINTER */: {
              if (((_e = op.value.resolvedType) == null ? void 0 : _e.category) === 6 /* POINTER */) {
              } else {
                throw new Error(`Unexpected type ${typeToString(op.type)} for cast source`);
              }
              break;
            }
            default: {
              throw new Error(`Unexpected type ${typeToString(op.type)} for cast target`);
            }
          }
          break;
        }
        case 4 /* DEREF_EXPR */: {
          const op = node;
          const elementType = op.resolvedType;
          visit(op.value, 1 /* RVALUE */);
          if (exprMode === 0 /* LVALUE */) {
          } else {
            if (isScalar(elementType)) {
              emitLoadScalar(elementType);
            } else {
              emitPushMem(elementType);
            }
          }
          break;
        }
        case 5 /* DOT_EXPR */: {
          const op = node;
          op.dot.lineStr(true).split("\n").forEach((l) => {
            debugLine(`;; ${l}`);
          });
          debugLine(``);
          const memberType = op.resolvedType;
          const structType = op.callee.resolvedType;
          if ((structType == null ? void 0 : structType.category) !== 7 /* STRUCT */) {
            throw new Error("Unexpected callee type for dot expr");
          } else {
            visit(op.callee, 0 /* LVALUE */);
            let offset = 0;
            const struct = structType.resolvedStruct;
            for (let i = 0; i < struct.members.length; i++) {
              if (struct.members[i].name.lexeme === op.identifier.lexeme) {
                break;
              }
              offset += sizeof(struct.members[i].type);
            }
            line(`i32.const ${offset}`);
            line(`i32.add`);
            if (exprMode === 0 /* LVALUE */) {
            } else {
              if (isScalar(memberType)) {
                emitLoadScalar(memberType);
              } else {
                emitPushMem(memberType);
              }
            }
          }
          break;
        }
        case 6 /* GROUP_EXPR */: {
          const op = node;
          visit(op.expression);
          break;
        }
        case 7 /* INDEX_EXPR */: {
          const op = node;
          op.bracket.lineStr(true).split("\n").forEach((l) => {
            debugLine(`;; ${l}`);
          });
          debugLine(``);
          const elementType = op.resolvedType;
          visit(op.callee, 0 /* LVALUE */);
          visit(op.index);
          line(`i32.const ${sizeof(elementType)}`);
          line(`i32.mul`);
          line(`i32.add`);
          if (exprMode === 0 /* LVALUE */) {
          } else {
            if (isScalar(elementType)) {
              emitLoadScalar(elementType);
            } else {
              emitPushMem(elementType);
            }
          }
          break;
        }
        case 8 /* LEN_EXPR */: {
          const op = node;
          line(`i32.const ${op.resolvedLength}`);
          break;
        }
        case 9 /* LIST_EXPR */: {
          const op = node;
          const initializer = op.initializer;
          const elementType = op.resolvedType.elementType;
          if (initializer.kind === 0 /* LIST */) {
            emitAllocStackVal(op.resolvedType);
            line(`global.get ${wasmId("__stack_ptr__")}`);
            if (isScalar(elementType)) {
              for (let i = 0; i < initializer.values.length; i++) {
                emitDupTop("i32");
                line(`i32.const ${i * sizeof(elementType)}`);
                line(`i32.add`);
                visit(initializer.values[i]);
                emitStoreScalar(elementType);
              }
            } else {
              for (let i = 0; i < initializer.values.length; i++) {
                emitDupTop("i32");
                line(`i32.const ${i * sizeof(elementType)}`);
                line(`i32.add`);
                visit(initializer.values[i]);
                emitSwapTop("i32", "i32");
                line(`i32.const ${sizeof(elementType)}`);
                line(`call ${wasmId("__memcpy__")}`);
              }
            }
          } else {
            if (isScalar(elementType)) {
              visit(initializer.value);
              const teeRegister = `__tee_${registerType(elementType)}__`;
              line(`local.set ${wasmId(teeRegister)}`);
              for (let i = 0; i < initializer.length; i++) {
                emitPushScalar(elementType, teeRegister);
                line(`drop`);
              }
            } else if (initializer.length > 0) {
              visit(initializer.value);
              for (let i = 1; i < initializer.length; i++) {
                emitPushMem(elementType);
              }
              line(`drop`);
            }
            line(`global.get ${wasmId("__stack_ptr__")}`);
          }
          break;
        }
        case 10 /* LITERAL_EXPR */: {
          const op = node;
          switch (op.type.category) {
            case 0 /* ARRAY */: {
              const elementType = op.type.elementType;
              if (!isEqual(elementType, ByteType)) {
                throw new Error("Literal node contains non-string array");
              }
              const loc = stringLocs.get(op.value);
              line(`i32.const ${loc}`);
              emitPushMem(op.type);
              break;
            }
            case 1 /* BOOL */: {
              line(`i32.const ${op.value === true ? "1" : "0"}`);
              break;
            }
            case 2 /* BYTE */:
            case 5 /* INT */: {
              line(`i32.const ${op.value}`);
              break;
            }
            case 4 /* FLOAT */: {
              line(`f32.const ${op.value}`);
              break;
            }
            default: {
              throw new Error(`Unhandled literal type ${typeToString(op.type)}`);
            }
          }
          break;
        }
        case 11 /* LOGICAL_EXPR */: {
          const op = node;
          const label = wasmId(nextLabelID++ + "");
          line(`(block ${label} (result i32)`);
          indent();
          switch (op.operator.lexeme) {
            case "&&": {
              visit(op.left);
              emitDupTop(`i32`);
              line(`i32.eqz`);
              line(`br_if ${label}`);
              visit(op.right);
              line(`i32.eq`);
              break;
            }
            case "||": {
              visit(op.left);
              emitDupTop(`i32`);
              line(`br_if ${label}`);
              line(`drop`);
              visit(op.right);
              break;
            }
            default: {
              break;
            }
          }
          dedent();
          line(`)`);
          break;
        }
        case 12 /* UNARY_EXPR */: {
          const op = node;
          switch (op.operator.lexeme) {
            case "!": {
              visit(op.value);
              line(`i32.eqz`);
              break;
            }
            case "-": {
              const t = registerType(op.value.resolvedType);
              line(`${t}.const 0`);
              visit(op.value);
              line(`${t}.sub`);
              break;
            }
            case "&": {
              switch (op.value.kind) {
                case 13 /* VARIABLE_EXPR */: {
                  const symbol = op.value.resolvedSymbol;
                  if ((symbol == null ? void 0 : symbol.kind) === 2 /* PARAM */ || (symbol == null ? void 0 : symbol.kind) === 0 /* VARIABLE */) {
                    emitLoc(symbol);
                  } else {
                    throw new Error("Unhandled operand for operator '&'.");
                  }
                  break;
                }
                case 7 /* INDEX_EXPR */: {
                  visit(op.value, 0 /* LVALUE */);
                  break;
                }
                default: {
                  throw new Error("Unhandled operand for operator '&'.");
                }
              }
              break;
            }
            default: {
              throw new Error("Unhandled unary operator");
            }
          }
          break;
        }
        case 13 /* VARIABLE_EXPR */: {
          const op = node;
          const symbol = op.resolvedSymbol;
          if (symbol) {
            if (symbol.kind === 0 /* VARIABLE */ || symbol.kind === 2 /* PARAM */) {
              emitGetSymbol(symbol);
              if (!isScalar(op.resolvedType) && exprMode === 1 /* RVALUE */) {
                emitPushMem(op.resolvedType);
              }
            } else {
              console.assert(false);
            }
          } else {
            throw new Error("Unresolved symbol in variable expression");
          }
          break;
        }
        case 14 /* BLOCK_STMT */: {
          const op = node;
          op.statements.forEach((statement) => {
            visit(statement);
          });
          break;
        }
        case 15 /* EXPRESSION_STMT */: {
          const op = node;
          visit(op.expression);
          const t = op.expression.resolvedType;
          if (!isEqual(t, VoidType)) {
            line(`drop`);
          }
          break;
        }
        case 16 /* FUNCTION_STMT */: {
          const op = node;
          if (op.body === null) {
            break;
          }
          localLocs = /* @__PURE__ */ new Map();
          if (op.name.lexeme === "main") {
            line(`(func ${wasmId("main")} (export "main")`);
          } else {
            line(`(func ${wasmId(op.name.lexeme)}`);
          }
          if (op.body) {
            indent();
            op.body.scope.forEach((name, local) => {
              if (local.kind === 2 /* PARAM */) {
                line(`(param ${wasmId(name, local.id)} ${registerType(local.param.type)})`);
              }
            });
            if (!isEqual(op.returnType, VoidType)) {
              line(`(result ${registerType(op.returnType)})`);
            }
            {
              line(`(local ${wasmId("__base_ptr__")} i32)`);
              line(`(local ${wasmId("__tee_i32__")} i32)`);
              line(`(local ${wasmId("__tee_f32__")} f32)`);
              line(`(local ${wasmId("__swapa_i32__")} i32)`);
              line(`(local ${wasmId("__swapb_i32__")} i32)`);
              line(`(local ${wasmId("__swapb_f32__")} f32)`);
              line(`(local ${wasmId("__swapa_f32__")} f32)`);
              let localOffset = 0;
              const allocateRegisterOrStackLoc = (local) => {
                if (local.kind !== 1 /* FUNCTION */ && local.kind !== 3 /* STRUCT */) {
                  if (isVariableInRegister(local) && local.kind === 0 /* VARIABLE */) {
                    line(`(local ${wasmId(local.node.name.lexeme, local.id)} ${registerType(local.node.type)})`);
                  } else {
                    const type = local.kind === 0 /* VARIABLE */ ? local.node.type : local.param.type;
                    localOffset += sizeof(type);
                    localLocs == null ? void 0 : localLocs.set(local, localOffset);
                  }
                }
              };
              op.body.scope.forEach((_, local) => allocateRegisterOrStackLoc(local));
              (_f = op.hoistedLocals) == null ? void 0 : _f.forEach((local) => allocateRegisterOrStackLoc(local));
              line(`global.get ${wasmId("__stack_ptr__")}`);
              line(`local.set ${wasmId("__base_ptr__")}`);
              line(`global.get ${wasmId("__stack_ptr__")}`);
              line(`i32.const ${localOffset}`);
              line(`i32.sub`);
              line(`global.set ${wasmId("__stack_ptr__")}`);
            }
            op.params.forEach((param) => {
              var _a3;
              const symbol = (_a3 = op.body) == null ? void 0 : _a3.scope.lookup(param.name.lexeme, (_) => true);
              if (symbol && !isVariableInRegister(symbol)) {
                line(`local.get ${wasmId(param.name.lexeme, symbol.id)}`);
                emitSetSymbol(symbol);
              }
            });
            op.body.block.forEach((statement) => {
              visit(statement);
            });
            line(`local.get ${wasmId("__base_ptr__")}`);
            line(`global.set ${wasmId("__stack_ptr__")}`);
            dedent();
          }
          line(`)`);
          localLocs = null;
          break;
        }
        case 17 /* IF_STMT */: {
          const op = node;
          visit(op.expression);
          line(`(if`);
          {
            indent();
            line(`(then`);
            {
              indent();
              visit(op.thenBranch);
              dedent();
            }
            line(`)`);
            if (op.elseBranch) {
              line(`(else`);
              {
                indent();
                visit(op.elseBranch);
                dedent();
              }
              line(`)`);
            }
            dedent();
          }
          line(`)`);
          break;
        }
        case 18 /* LOOP_CONTROL_STMT */: {
          const op = node;
          const loop = peekLoop();
          if (loop) {
            switch (op.keyword.lexeme) {
              case "break": {
                line(`br ${loop.outerLabel}`);
                break;
              }
              case "continue": {
                if (loop.incrementLabel) {
                  line(`br ${loop.incrementLabel}`);
                } else {
                  line(`br ${loop.innerLabel}`);
                }
                break;
              }
              default: {
                throw new Error("Unhandled loop control statement");
              }
            }
          } else {
            throw new Error("Unexpected loop control statement outside of loop");
          }
          break;
        }
        case 19 /* PRINT_STMT */: {
          const op = node;
          visit(op.expression);
          emitPrintVal(op.expression.resolvedType);
          line(`call ${wasmId("__flush__")}`);
          break;
        }
        case 20 /* RETURN_STMT */: {
          const op = node;
          if (op.value) {
            visit(op.value);
          }
          line(`local.get ${wasmId("__base_ptr__")}`);
          line(`global.set ${wasmId("__stack_ptr__")}`);
          line(`return`);
          break;
        }
        case 21 /* STRUCT_STMT */: {
          break;
        }
        case 22 /* VAR_STMT */: {
          const op = node;
          visit(op.initializer);
          emitSetSymbol(op.symbol);
          line(`drop`);
          break;
        }
        case 23 /* WHILE_STMT */: {
          const op = node;
          const outerLabel = wasmId(nextLabelID++ + "");
          const innerLabel = wasmId(nextLabelID++ + "");
          const incrementLabel = op.increment ? wasmId(nextLabelID++ + "") : null;
          line(`(block ${outerLabel}`);
          {
            indent();
            line(`(loop ${innerLabel}`);
            {
              indent();
              visit(op.expression);
              line(`i32.eqz`);
              line(`br_if ${outerLabel}`);
              if (op.increment) {
                line(`(block ${incrementLabel}`);
                indent();
              }
              pushLoop({ outerLabel, innerLabel, incrementLabel });
              visit(op.body);
              popLoop();
              if (op.increment) {
                dedent();
                line(`)`);
                visit(op.increment);
              }
              line(`br ${innerLabel}`);
              dedent();
            }
            line(`)`);
            dedent();
          }
          line(`)`);
          break;
        }
        default: {
          assertUnreachable(node.kind);
        }
      }
    }
    line(`(module`);
    {
      indent();
      line(`(import "io" "log" (func ${wasmId("__log_i32__")} (param i32)))`);
      line(`(import "io" "log" (func ${wasmId("__log_f32__")} (param f32)))`);
      line(`(import "io" "putchar" (func ${wasmId("__putc__")} (param i32)))`);
      line(`(import "io" "putf" (func ${wasmId("__putf__")} (param f32)))`);
      line(`(import "io" "puti" (func ${wasmId("__puti__")} (param i32)))`);
      line(`(import "io" "flush" (func ${wasmId("__flush__")}))`);
      line(`(memory $memory ${INITIAL_PAGES})`);
      line(`(global ${wasmId("__stack_ptr__")} (mut i32) i32.const ${STACK_TOP_BYTE_OFFSET})`);
      let globalByteOffset = DATA_TOP_BYTE_OFFSET;
      context.stringLiterals.forEach((literal) => {
        globalByteOffset -= sizeof(literal.type);
        stringLocs.set(literal.value, globalByteOffset);
        line(`(data (i32.const ${globalByteOffset}) "${escapeString(literal.value)}")`);
      });
      (_a = context.globalInitOrder) == null ? void 0 : _a.forEach((varDecl) => {
        const symbol = varDecl.symbol;
        if (symbol !== null && varDecl.type !== null) {
          if (isVariableInRegister(symbol)) {
            const type = registerType(varDecl.type);
            line(`(global ${wasmId(varDecl.name.lexeme)} (mut ${type}) ${defaultForRegisterType(type)})`);
          } else {
            globalByteOffset -= sizeof(varDecl.type);
            globalLocs.set(symbol, globalByteOffset);
          }
        }
      });
      line(`(func (export "__init_globals__")`);
      {
        indent();
        line(`(local ${wasmId("__base_ptr__")} i32)`);
        line(`(local ${wasmId("__tee_i32__")} i32)`);
        line(`(local ${wasmId("__tee_f32__")} f32)`);
        line(`(local ${wasmId("__swapa_i32__")} i32)`);
        line(`(local ${wasmId("__swapb_i32__")} i32)`);
        line(`(local ${wasmId("__swapb_f32__")} f32)`);
        line(`(local ${wasmId("__swapa_f32__")} f32)`);
        line(`global.get ${wasmId("__stack_ptr__")}`);
        line(`local.set ${wasmId("__base_ptr__")}`);
        (_b = context.globalInitOrder) == null ? void 0 : _b.forEach((varDecl) => {
          if (varDecl.type !== null) {
            visit(varDecl);
            skip.add(varDecl);
          }
        });
        line(`local.get ${wasmId("__base_ptr__")}`);
        line(`global.set ${wasmId("__stack_ptr__")}`);
        dedent();
      }
      line(`)`);
      line(`(func ${wasmId("__memcpy__")} (param $src i32) (param $dst i32) (param $numBytes i32)`);
      {
        indent();
        const outerLabel = wasmId(nextLabelID++ + "");
        const innerLabel = wasmId(nextLabelID++ + "");
        line(`(block ${outerLabel}`);
        {
          indent();
          line(`(loop ${innerLabel}`);
          {
            indent();
            line(`local.get $numBytes`);
            line(`i32.const 0`);
            line(`i32.gt_s`);
            line(`i32.eqz`);
            line(`br_if ${outerLabel}`);
            line(`local.get $dst`);
            line(`local.get $src`);
            line(`i32.load8_u`);
            line(`i32.store8`);
            line(`local.get $src`);
            line(`i32.const 1`);
            line(`i32.add`);
            line(`local.set $src`);
            line(`local.get $dst`);
            line(`i32.const 1`);
            line(`i32.add`);
            line(`local.set $dst`);
            line(`local.get $numBytes`);
            line(`i32.const 1`);
            line(`i32.sub`);
            line(`local.set $numBytes`);
            line(``);
            line(`br ${innerLabel}`);
            dedent();
          }
          line(`)`);
          dedent();
        }
        line(`)`);
        dedent();
      }
      line(`)`);
      line(`(func ${wasmId("__sqrt__")} (param $x f32) (result f32)`);
      {
        line(`local.get $x`);
        line(`f32.sqrt`);
      }
      line(`)`);
      context.topLevelStatements.forEach((statement) => {
        visit(statement);
      });
      dedent();
    }
    line(`)`);
    return output;
  }

  // index.ts
  function compile(source) {
    const result = {
      program: null,
      errors: []
    };
    const reportError = (line, msg) => {
      result.errors.push(`${line}: ${msg}`);
    };
    const tokens = scanTokens(source, reportError);
    if (result.errors.length > 0) {
      return result;
    }
    const context = parse(tokens, reportError);
    if (result.errors.length > 0) {
      return result;
    }
    resolve(context, reportError);
    if (result.errors.length > 0) {
      return result;
    }
    result.program = emit(context);
    return result;
  }

  // demo.ts
  var wasmFeatures = {
    "exceptions": false,
    "mutable_globals": true,
    "sat_float_to_int": false,
    "sign_extension": false,
    "simd": false,
    "threads": false,
    "multi_value": false,
    "tail_call": false,
    "bulk_memory": false,
    "reference_types": false
  };
  CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
  CodeMirror.keyMap.default["Tab"] = "indentMore";
  var puffEditor = CodeMirror((el) => {
    var _a;
    (_a = document.getElementById("puff-box")) == null ? void 0 : _a.appendChild(el);
  }, {
    mode: "null",
    lineNumbers: true,
    tabSize: 2
  });
  var watOutput = document.getElementById("wat-output");
  var programOutput = document.getElementById("output");
  function debounce(cb, wait) {
    let lastTime = 0;
    let timeoutID = -1;
    const wrapped = () => {
      const time = +new Date();
      const elapsed = time - lastTime;
      lastTime = time;
      if (elapsed < wait || timeoutID === -1) {
        if (timeoutID !== -1) {
          clearTimeout(timeoutID);
        }
        timeoutID = setTimeout(wrapped, wait);
        console.log("debounce");
        return;
      }
      console.log("exec");
      clearTimeout(timeoutID);
      timeoutID = -1;
      cb(arguments);
    };
    return wrapped;
  }
  var DEBOUNCE_MS = 500;
  var EXAMPLES = [
    {
      name: "Hello world",
      contents: `
def main() {
  print "Hello world!";
}
    `.trim()
    },
    {
      name: "Fibonacci",
      contents: `
def fib(n int) int {
  if (n <= 1) {
    return 1;
  }
  return fib(n-1) + fib(n-2);
}
def main() {
  for (var i=0; i<6; i+=1) {
    print fib(i);
  }
}
    `.trim()
    },
    {
      name: "Factorial",
      contents: `
def factorial(n int) int {
  var result = 1;
  for (; n>=1; n-=1) {
    result *= n;
  }
  return result;
}
def main() {
  for (var i=0; i<6; i+=1) {
    print factorial(i);
  }
}
    `.trim()
    }
  ];
  WabtModule().then((wabt) => {
    let pendingBuildAndRun = Promise.resolve();
    let ioBuffer = "";
    const codec3 = new UTF8Codec();
    function buildAndRun() {
      return __async(this, null, function* () {
        watOutput.textContent = "";
        const compileResult = compile(puffEditor.getValue());
        watOutput.textContent = compileResult.program;
        if (compileResult.errors.length > 0) {
          const err = compileResult.errors.join("\n");
          programOutput.textContent = err;
          return Promise.resolve();
        } else {
          let module = null;
          try {
            module = wabt.parseWat("input.wast", watOutput.textContent, wasmFeatures);
            module.resolveNames();
            module.validate(wasmFeatures);
            const binaryOutput = module.toBinary({ log: true, writeDebugNames: true });
            const binaryBuffer = binaryOutput.buffer;
            const wasm = new WebAssembly.Module(binaryBuffer);
            return WebAssembly.instantiate(wasm, {
              io: {
                log: (x) => {
                  programOutput.textContent += x + "\n";
                },
                putchar: (x) => {
                  ioBuffer += codec3.decodeASCIIChar(x);
                },
                putf: (x) => {
                  ioBuffer += x;
                },
                puti: (x) => {
                  ioBuffer += x;
                },
                flush: () => {
                  programOutput.textContent += ioBuffer + "\n";
                  ioBuffer = "";
                }
              }
            }).then((instance) => {
              programOutput.textContent = "";
              const exports = instance.exports;
              if (exports.__init_globals__ !== void 0 && exports.main !== void 0) {
                exports.__init_globals__();
                exports.main();
              }
            });
          } catch (e) {
            programOutput.textContent = e.toString();
            return Promise.resolve();
          }
        }
      });
    }
    function selectExample(i) {
      const example = EXAMPLES[i];
      puffEditor.setValue(example.contents);
      pendingBuildAndRun = pendingBuildAndRun.then(() => buildAndRun());
    }
    const exampleDropdown = document.getElementById("select");
    for (let example of EXAMPLES) {
      const option = document.createElement("option");
      option.textContent = example.name;
      exampleDropdown.appendChild(option);
    }
    exampleDropdown.selectedIndex = 0;
    exampleDropdown.addEventListener("change", () => {
      selectExample(exampleDropdown.selectedIndex);
    });
    selectExample(exampleDropdown.selectedIndex);
    const onEdit = debounce(() => {
      pendingBuildAndRun = pendingBuildAndRun.then(() => buildAndRun());
    }, DEBOUNCE_MS);
    puffEditor.on("change", onEdit);
  });
})();

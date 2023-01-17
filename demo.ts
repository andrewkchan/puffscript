import { UTF8Codec } from './src/util'
import { compile } from './index'


declare const WabtModule: () => Promise<WABT>
declare const CodeMirror: (cb: (el: HTMLElement) => void, options: any) => CodeMirrorEl

interface CodeMirrorEl {
  setValue: (s: string) => void
  getValue: () => string
  on: (eventName: string, cb: () => void) => void
}

interface WABT {
  parseWat: (filename: string, content: string | null, features: any) => WATModule
}

interface WATModule {
  resolveNames: () => void
  validate: (features: any) => void
  toBinary: (options: any) => any
}

const wasmFeatures = {
  'exceptions': false,
  'mutable_globals': true,
  'sat_float_to_int': false,
  'sign_extension': false,
  'simd': false,
  'threads': false,
  'multi_value': false,
  'tail_call': false,
  'bulk_memory': false,
  'reference_types': false,
};

(CodeMirror as any).keyMap.default["Shift-Tab"] = "indentLess";
(CodeMirror as any).keyMap.default["Tab"] = "indentMore";
const puffEditor = CodeMirror((el) => {
  document.getElementById("puff-box")?.appendChild(el)
}, {
  mode: "null",
  lineNumbers: true,
  tabSize: 2
})

const watOutput = document.getElementById("wat-output")!
const programOutput = document.getElementById("output")!

function debounce(cb: (args: IArguments) => void, wait: number) {
  let lastTime = 0
  let timeoutID = -1
  const wrapped = () => {
    const time = +new Date()
    const elapsed = time - lastTime
    lastTime = time
    if (elapsed < wait || timeoutID === -1) {
      if (timeoutID !== -1) {
        clearTimeout(timeoutID)
      }
      timeoutID = setTimeout(wrapped, wait) as any
      return
    }
    clearTimeout(timeoutID)
    timeoutID = -1
    cb(arguments)
  }
  return wrapped
}

const DEBOUNCE_MS = 500

const EXAMPLES = [
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
]


WabtModule().then((wabt) => {
  let pendingBuildAndRun: Promise<void> = Promise.resolve()
  let ioBuffer = ""
  const codec = new UTF8Codec()

  async function buildAndRun() {
    watOutput.textContent = ""

    const compileResult = compile(puffEditor.getValue())
    watOutput.textContent = compileResult.program
    if (compileResult.errors.length > 0) {
      const err = compileResult.errors.join("\n")
      programOutput.textContent = err
      return Promise.resolve()
    } else {
      let module: WATModule | null = null
      try {
        module = wabt.parseWat("input.wast", watOutput.textContent, wasmFeatures)
        module.resolveNames()
        module.validate(wasmFeatures)
        const binaryOutput = module.toBinary({log: true, writeDebugNames: true})
        const binaryBuffer = binaryOutput.buffer
        const wasm = new WebAssembly.Module(binaryBuffer)
        return WebAssembly.instantiate(wasm, {
          io: {
            log: (x: any) => {
              programOutput.textContent += x + "\n"
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
              programOutput.textContent += ioBuffer + "\n"
              ioBuffer = ""
            }
          }
        }).then((instance) => {
          programOutput.textContent = ""
          const exports = instance.exports as any
          if (exports.__init_globals__ !== undefined && exports.main !== undefined) {
            exports.__init_globals__()
            exports.main()
          }
        })
      } catch (e) {
        programOutput.textContent = e.toString()
        return Promise.resolve()
      }
    }
  }

  function selectExample(i: number) {
    const example = EXAMPLES[i]
    puffEditor.setValue(example.contents)
    pendingBuildAndRun = pendingBuildAndRun.then(() => buildAndRun())
  }

  const exampleDropdown = document.getElementById("select")! as HTMLSelectElement
  for (let example of EXAMPLES) {
    const option = document.createElement("option")
    option.textContent = example.name
    exampleDropdown.appendChild(option)
  }
  exampleDropdown.selectedIndex = 0
  exampleDropdown.addEventListener("change", () => {
    selectExample(exampleDropdown.selectedIndex)
  })
  selectExample(exampleDropdown.selectedIndex)

  const onEdit = debounce(() => {
    pendingBuildAndRun = pendingBuildAndRun.then(() => buildAndRun())
  }, DEBOUNCE_MS)

  puffEditor.on("change", onEdit)
})
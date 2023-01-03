import { UTF8Codec } from './src/util'
import { compile } from './index'


declare const WabtModule: () => Promise<WABT>
declare const CodeMirror: (cb: (el: HTMLElement) => void, options: any) => CodeMirrorEl

interface CodeMirrorEl {
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
      console.log("debounce")
      return
    }
    console.log("exec")
    clearTimeout(timeoutID)
    timeoutID = -1
    cb(arguments)
  }
  return wrapped
}

const DEBOUNCE_MS = 500

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

  const onEdit = debounce(() => {
    pendingBuildAndRun = pendingBuildAndRun.then(() => buildAndRun())
  }, DEBOUNCE_MS)

  puffEditor.on("change", onEdit)
})
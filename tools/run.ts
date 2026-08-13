// Runs a compiled puffscript WASM module with the standard host environment:
// - io.*: the `print` statement machinery (writes lines to stdout)
// - env.getchar: reads bytes from stdin (or the file given by --stdin)
// - env.putchar: writes bytes to stdout
// - env.puterr: writes bytes to stderr
// - env.exit: terminates with the given exit code
//
// Usage: node dist/tools/run.js module.wasm [--stdin file] [--stdout file]
import fs from 'fs'
import { UTF8Codec } from '../src/util'

class ExitError extends Error {
  code: number
  constructor(code: number) {
    super(`exit ${code}`)
    this.code = code
  }
}

async function main() {
  const args = process.argv.slice(2)
  let wasmFile: string | null = null
  let stdinFile: string | null = null
  let stdoutFile: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--stdin") {
      stdinFile = args[++i]
    } else if (args[i] === "--stdout") {
      stdoutFile = args[++i]
    } else {
      wasmFile = args[i]
    }
  }
  if (wasmFile === null) {
    console.error("usage: run module.wasm [--stdin file] [--stdout file]")
    process.exit(2)
  }

  const input: Buffer = stdinFile !== null ? fs.readFileSync(stdinFile) : (() => {
    try {
      return fs.readFileSync(0) // stdin
    } catch {
      return Buffer.alloc(0)
    }
  })()
  let inputPos = 0

  const codec = new UTF8Codec()
  let ioBuffer = ""
  const stdoutChunks: number[] = []
  const stderrChunks: number[] = []

  function flushAll() {
    if (stdoutChunks.length > 0) {
      const buf = Buffer.from(stdoutChunks)
      if (stdoutFile !== null) {
        fs.writeFileSync(stdoutFile, buf)
      } else {
        process.stdout.write(buf)
      }
      stdoutChunks.length = 0
    }
    if (stderrChunks.length > 0) {
      process.stderr.write(Buffer.from(stderrChunks))
      stderrChunks.length = 0
    }
  }

  function pushString(target: number[], s: string) {
    const bytes = codec.encodeString(s)
    for (let i = 0; i < bytes.length; i++) {
      target.push(bytes[i])
    }
  }

  const imports = {
    io: {
      log: (x: any) => {
        pushString(stdoutChunks, x + "\n")
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
        pushString(stdoutChunks, ioBuffer + "\n")
        ioBuffer = ""
      }
    },
    env: {
      getchar: (): number => {
        if (inputPos >= input.length) {
          return -1
        }
        return input[inputPos++]
      },
      putchar: (c: number) => {
        stdoutChunks.push(c & 0xFF)
      },
      puterr: (c: number) => {
        stderrChunks.push(c & 0xFF)
      },
      exit: (code: number) => {
        throw new ExitError(code)
      }
    }
  }

  const instance = await WebAssembly.instantiate(fs.readFileSync(wasmFile), imports)
  const exports = instance.instance.exports as any
  let exitCode = 0
  try {
    exports.__init_globals__()
    exports.main()
  } catch (e) {
    if (e instanceof ExitError) {
      exitCode = e.code
    } else {
      flushAll()
      throw e
    }
  }
  flushAll()
  process.exit(exitCode)
}

main().catch((e) => {
  console.error(e.stack ?? e)
  process.exit(1)
})

import { TextDecoder, TextEncoder } from "util";

export type ReportError = (line: number, msg: string) => void

export function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

export class UTF8Codec {
  encoder: TextEncoder
  decoder: TextDecoder
  charBuf: Uint8Array // only works for 1-byte characters
  constructor() {
    this.encoder = new TextEncoder()
    this.decoder = new TextDecoder("utf8")
    this.charBuf = new Uint8Array(1)
  }

  decodeASCIIChar(charCode: number): string {
    if (charCode < 0 || charCode > 65536) {
      throw new Error("Expected ASCII char code")
    }
    this.charBuf[0] = charCode
    return this.decoder.decode(this.charBuf)
  }

  encodeASCIIChar(char: string): number {
    if (char.length !== 1) {
      throw new Error("Expected character")
    }
    this.encoder.encodeInto(char, this.charBuf)
    return this.charBuf[0]
  }
}
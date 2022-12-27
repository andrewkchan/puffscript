export type ReportError = (line: number, msg: string) => void

export function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}
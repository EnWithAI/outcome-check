/** Placeholder until implementation (verification-first: acceptance tests are committed failing). */
export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  cwd: string;
  now?: () => Date;
}
/** Not implemented yet. */
export async function run(_argv: string[], io: CliIO): Promise<number> {
  io.stderr("not implemented\n");
  return 1;
}

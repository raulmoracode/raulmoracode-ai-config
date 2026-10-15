/**
 * Error carrying the process exit code:
 * 0 success, 1 runtime error, 2 usage error.
 */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

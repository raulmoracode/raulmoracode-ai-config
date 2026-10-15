/**
 * Output context injected into the CLI, so command logic is testable without
 * spawning processes or touching the real stdout/stderr.
 */
export interface CliContext {
  write(text: string): void;
  writeError(text: string): void;
}

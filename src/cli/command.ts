import type { CliContext } from "./context.js";

/**
 * A single CLI command. `argv` contains the arguments that follow the command
 * name; each command parses its own flags.
 */
export interface Command {
  readonly name: string;
  readonly summary: string;
  run(argv: readonly string[], ctx: CliContext): number | Promise<number>;
}

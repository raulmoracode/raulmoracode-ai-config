import type { Ui } from "../ui/ui.js";

/** Everything a command needs from the surrounding CLI invocation. */
export interface CommandContext {
  ui: Ui;
}

/**
 * A single CLI command. `argv` contains the arguments that follow the command
 * name; each command parses its own flags.
 */
export interface Command {
  readonly name: string;
  readonly summary: string;
  run(argv: readonly string[], context: CommandContext): number | Promise<number>;
}

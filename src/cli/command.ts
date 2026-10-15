import type { Ui } from "../ui/ui.js";
import type { CliContext } from "./context.js";

/**
 * Everything a command needs from the surrounding CLI invocation: the styled
 * UI for human-facing chrome, and raw writers for data output that must stay
 * parseable when piped.
 */
export interface CommandContext {
  ui: Ui;
  writers: CliContext;
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

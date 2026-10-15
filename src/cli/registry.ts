import type { Command } from "./command.js";

/**
 * All commands exposed by the CLI. Command modules are appended here as they
 * are implemented; the help text and the dispatcher derive from this list.
 */
export const commands: readonly Command[] = [];

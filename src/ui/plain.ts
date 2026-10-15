import type { CliContext } from "../cli/context.js";
import { CliError } from "../cli/errors.js";
import type { Ui } from "./ui.js";

const CONFIRM_ERROR =
  "Cannot ask for confirmation in a non-interactive environment; pass an explicit " +
  "non-interactive flag (for example --yes) to proceed";

const SELECT_ERROR = "This action requires an interactive terminal";

/**
 * Plain-text fallback used when there is no interactive terminal: deterministic
 * output only, no prompts, so CI, scripts and pipes keep working.
 */
export function createPlainUi(writers: CliContext): Ui {
  return {
    intro: (title) => {
      writers.write(`${title}\n`);
    },
    outro: (message) => {
      writers.write(`${message}\n`);
    },
    note: (title, body) => {
      writers.write(`${title}\n${indent(body)}\n`);
    },
    info: (message) => {
      writers.write(`${message}\n`);
    },
    success: (message) => {
      writers.write(`${message}\n`);
    },
    warn: (message) => {
      writers.writeError(`warning: ${message}\n`);
    },
    error: (message) => {
      writers.writeError(`error: ${message}\n`);
    },
    confirm: async () => {
      throw new CliError(CONFIRM_ERROR, 2);
    },
    select: async () => {
      throw new CliError(SELECT_ERROR, 2);
    },
    spinner: async (_message, task) => {
      return await task();
    },
  };
}

function indent(body: string): string {
  return body
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

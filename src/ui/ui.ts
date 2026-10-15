import type { CliContext } from "../cli/context.js";
import { createClackUi } from "./clack.js";
import { createPlainUi } from "./plain.js";

/**
 * Human-facing terminal interaction layer. Commands receive it through their
 * command context, so they never touch the terminal directly.
 */
export interface Ui {
  intro(title: string): void;
  outro(message: string): void;
  note(title: string, body: string): void;
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  confirm(message: string, options?: { initial?: boolean }): Promise<boolean>;
  select<T extends string>(
    message: string,
    options: readonly { value: T; label: string; hint?: string }[],
  ): Promise<T>;
  spinner<T>(message: string, task: () => Promise<T>): Promise<T>;
}

/**
 * Interactive only when both stdout and stdin report a TTY. The optional
 * streams exist purely so tests can provide deterministic fakes.
 */
export function detectInteractive(streams?: {
  stdout?: { isTTY?: boolean | undefined };
  stdin?: { isTTY?: boolean | undefined };
}): boolean {
  const stdout = streams?.stdout ?? process.stdout;
  const stdin = streams?.stdin ?? process.stdin;
  return stdout.isTTY === true && stdin.isTTY === true;
}

export function createUi(options: { writers: CliContext; interactive?: boolean }): Ui {
  const interactive = options.interactive ?? detectInteractive();
  return interactive ? createClackUi() : createPlainUi(options.writers);
}

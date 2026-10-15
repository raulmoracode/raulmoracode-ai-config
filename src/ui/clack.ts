import {
  confirm as clackConfirm,
  intro as clackIntro,
  note as clackNote,
  outro as clackOutro,
  select as clackSelect,
  spinner as clackSpinner,
  isCancel,
  log,
} from "@clack/prompts";
import { CliError } from "../cli/errors.js";
import type { Ui } from "./ui.js";

type PromptOption<T extends string> = { value: T; label: string; hint?: string };

/** Interactive implementation backed by `@clack/prompts`. */
export function createClackUi(): Ui {
  return {
    intro: (title) => {
      clackIntro(title);
    },
    outro: (message) => {
      clackOutro(message);
    },
    note: (title, body) => {
      clackNote(body, title);
    },
    info: (message) => {
      log.info(message);
    },
    success: (message) => {
      log.success(message);
    },
    warn: (message) => {
      log.warn(message);
    },
    error: (message) => {
      log.error(message);
    },
    confirm: promptConfirm,
    select: promptSelect,
    spinner: promptSpinner,
  };
}

async function promptConfirm(message: string, options?: { initial?: boolean }): Promise<boolean> {
  const confirmOptions: { message: string; initialValue?: boolean } = { message };
  if (options?.initial !== undefined) {
    confirmOptions.initialValue = options.initial;
  }

  const result = await clackConfirm(confirmOptions);
  if (isCancel(result)) {
    throw new CliError("Operation cancelled", 130);
  }

  return result;
}

async function promptSelect<T extends string>(
  message: string,
  options: readonly PromptOption<T>[],
): Promise<T> {
  const result = await clackSelect<string>({ message, options: toPromptOptions(options) });
  if (isCancel(result)) {
    throw new CliError("Operation cancelled", 130);
  }

  const selected = options.find((option) => option.value === result);
  if (selected === undefined) {
    throw new CliError(`Unexpected selection: ${result}`, 1);
  }

  return selected.value;
}

async function promptSpinner<T>(message: string, task: () => Promise<T>): Promise<T> {
  const spin = clackSpinner();
  spin.start(message);

  try {
    const result = await task();
    spin.stop(message);
    return result;
  } catch (error) {
    spin.error(message);
    throw error;
  }
}

/**
 * Clack requires mutable, string-valued options, so copy the caller's readonly
 * options and drop undefined hints (`exactOptionalPropertyTypes`).
 */
function toPromptOptions<T extends string>(
  options: readonly PromptOption<T>[],
): { value: string; label: string; hint?: string }[] {
  return options.map((option) =>
    option.hint === undefined
      ? { value: option.value, label: option.label }
      : { value: option.value, label: option.label, hint: option.hint },
  );
}

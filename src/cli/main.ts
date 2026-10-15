import { parseArgs } from "node:util";
import { readPackageVersion } from "../version.js";
import { CliError } from "./errors.js";
import { helpText } from "./help.js";

export interface CliContext {
  write(text: string): void;
  writeError(text: string): void;
}

interface ParsedInvocation {
  values: {
    help?: boolean | undefined;
    version?: boolean | undefined;
  };
  positionals: string[];
}

type ParseOutcome = { ok: true; invocation: ParsedInvocation } | { ok: false; message: string };

export function main(argv: readonly string[], ctx: CliContext): number {
  try {
    return run(argv, ctx);
  } catch (error) {
    if (error instanceof CliError) {
      ctx.writeError(`error: ${error.message}\n`);
      return error.exitCode;
    }

    ctx.writeError(`error: ${describeError(error)}\n`);
    return 1;
  }
}

function run(argv: readonly string[], ctx: CliContext): number {
  const outcome = parseArguments(argv);
  if (!outcome.ok) {
    return failWithUsage(ctx, outcome.message);
  }

  const { values, positionals } = outcome.invocation;

  if (values.help === true) {
    ctx.write(helpText());
    return 0;
  }

  if (values.version === true) {
    ctx.write(`${readPackageVersion()}\n`);
    return 0;
  }

  const [command] = positionals;
  if (command === undefined) {
    ctx.write(helpText());
    return 0;
  }

  return dispatch(command, ctx);
}

function dispatch(command: string, ctx: CliContext): number {
  switch (command) {
    default:
      return failWithUsage(ctx, `Unknown command: ${command}`);
  }
}

function parseArguments(argv: readonly string[]): ParseOutcome {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      strict: true,
      allowPositionals: true,
    });

    return { ok: true, invocation: { values, positionals } };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

function failWithUsage(ctx: CliContext, message: string): number {
  ctx.writeError(`error: ${message}\n\n${helpText()}`);
  return 2;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

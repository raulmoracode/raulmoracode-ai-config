import { readPackageVersion } from "../version.js";
import type { CliContext } from "./context.js";
import { CliError } from "./errors.js";
import { helpText } from "./help.js";
import { commands } from "./registry.js";

export type { CliContext } from "./context.js";

export async function main(argv: readonly string[], ctx: CliContext): Promise<number> {
  try {
    return await run(argv, ctx);
  } catch (error) {
    if (error instanceof CliError) {
      ctx.writeError(`error: ${error.message}\n`);
      if (error.exitCode === 2) {
        ctx.writeError(`\n${helpText(commands)}`);
      }
      return error.exitCode;
    }

    ctx.writeError(`error: ${describeError(error)}\n`);
    return 1;
  }
}

async function run(argv: readonly string[], ctx: CliContext): Promise<number> {
  const [first, ...rest] = argv;

  if (first === undefined || first === "--help" || first === "-h") {
    ctx.write(helpText(commands));
    return 0;
  }

  if (first === "--version" || first === "-v") {
    ctx.write(`${readPackageVersion()}\n`);
    return 0;
  }

  if (first.startsWith("-")) {
    throw new CliError(`Unknown option '${first}'`, 2);
  }

  const command = commands.find((candidate) => candidate.name === first);
  if (command === undefined) {
    throw new CliError(`Unknown command: ${first}`, 2);
  }

  return await command.run(rest, ctx);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

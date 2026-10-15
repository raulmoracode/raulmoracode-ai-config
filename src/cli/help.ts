import type { Command } from "./command.js";

export function helpText(commands: readonly Command[]): string {
  const lines = [
    "Configure OpenCode to use a centralized catalog of remotely hosted skills",
    "",
    "Usage: raulmoracode-ai-config [command] [options]",
  ];

  if (commands.length > 0) {
    lines.push("", "Commands:");
    const width = Math.max(...commands.map((command) => command.name.length));
    for (const command of commands) {
      lines.push(`  ${command.name.padEnd(width)}  ${command.summary}`);
    }
  }

  lines.push(
    "",
    "Options:",
    "  -h, --help     Show this help message and exit",
    "  -v, --version  Print the CLI version and exit",
    "",
  );

  return lines.join("\n");
}

import { describe, expect, it } from "vitest";
import type { Command } from "../../src/cli/command.js";
import { helpText } from "../../src/cli/help.js";

function command(name: string, summary: string): Command {
  return {
    name,
    summary,
    run: () => 0,
  };
}

describe("helpText", () => {
  it("prints usage and options without a commands section when the registry is empty", () => {
    const text = helpText([]);

    expect(text).toContain("Usage: raulmoracode-ai-config [command] [options]");
    expect(text).toContain("-h, --help");
    expect(text).toContain("-v, --version");
    expect(text).not.toContain("Commands:");
  });

  it("lists registered commands with their summaries", () => {
    const text = helpText([
      command("doctor", "Diagnose the remote skills integration"),
      command("init", "Configure OpenCode to use the remote skills catalog"),
    ]);

    expect(text).toContain("Commands:");
    expect(text).toContain("doctor");
    expect(text).toContain("Diagnose the remote skills integration");
    expect(text).toContain("init");
    expect(text).toContain("Configure OpenCode to use the remote skills catalog");
  });
});

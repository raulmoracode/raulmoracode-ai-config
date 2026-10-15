import { describe, expect, it } from "vitest";
import { type CliContext, main } from "../../src/cli/main.js";
import { readPackageVersion } from "../../src/version.js";

interface CapturedContext {
  ctx: CliContext;
  stdout(): string;
  stderr(): string;
}

function createContext(): CapturedContext {
  let stdout = "";
  let stderr = "";

  return {
    ctx: {
      write: (text) => {
        stdout += text;
      },
      writeError: (text) => {
        stderr += text;
      },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

describe("main", () => {
  it("prints help for --help", async () => {
    const { ctx, stdout } = createContext();

    const exitCode = await main(["--help"], ctx);

    expect(exitCode).toBe(0);
    expect(stdout()).toContain("Usage:");
    expect(stdout()).toContain("--version");
  });

  it("prints help for -h", async () => {
    const { ctx, stdout } = createContext();

    const exitCode = await main(["-h"], ctx);

    expect(exitCode).toBe(0);
    expect(stdout()).toContain("Usage:");
    expect(stdout()).toContain("--version");
  });

  it("prints the package version for --version", async () => {
    const { ctx, stdout } = createContext();

    const exitCode = await main(["--version"], ctx);

    expect(exitCode).toBe(0);
    expect(stdout().trim()).toBe(readPackageVersion());
  });

  it("prints the package version for -v", async () => {
    const { ctx, stdout } = createContext();

    const exitCode = await main(["-v"], ctx);

    expect(exitCode).toBe(0);
    expect(stdout().trim()).toBe(readPackageVersion());
  });

  it("prints help when no arguments are given", async () => {
    const { ctx, stdout } = createContext();

    const exitCode = await main([], ctx);

    expect(exitCode).toBe(0);
    expect(stdout()).toContain("Usage:");
  });

  it("fails with a usage error for an unknown command", async () => {
    const { ctx, stdout, stderr } = createContext();

    const exitCode = await main(["frobnicate"], ctx);

    expect(exitCode).toBe(2);
    expect(stderr()).toContain("Unknown command: frobnicate");
    expect(stdout()).toBe("");
  });

  it("fails with a usage error for an unknown flag", async () => {
    const { ctx, stderr } = createContext();

    const exitCode = await main(["--nope"], ctx);

    expect(exitCode).toBe(2);
    expect(stderr().startsWith("error:")).toBe(true);
  });
});

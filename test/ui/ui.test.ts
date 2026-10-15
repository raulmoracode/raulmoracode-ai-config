import { describe, expect, it } from "vitest";
import type { CliContext } from "../../src/cli/context.js";
import { CliError } from "../../src/cli/errors.js";
import { createUi, detectInteractive, type Ui } from "../../src/ui/ui.js";

interface CapturedWriters {
  writers: CliContext;
  stdout(): string;
  stderr(): string;
}

function createWriters(): CapturedWriters {
  let stdout = "";
  let stderr = "";

  return {
    writers: {
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

async function captureCliError(promise: Promise<unknown>): Promise<CliError> {
  const outcome = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );

  if (!(outcome instanceof CliError)) {
    throw new Error(`Expected a CliError, received: ${String(outcome)}`);
  }

  return outcome;
}

describe("createUi (plain, non-interactive)", () => {
  it("writes information and success messages to stdout", () => {
    const { writers, stdout, stderr } = createWriters();
    const ui = createUi({ writers, interactive: false });

    ui.info("some info");
    ui.success("all good");

    expect(stdout()).toContain("some info");
    expect(stdout()).toContain("all good");
    expect(stderr()).toBe("");
  });

  it("writes warnings and errors to stderr with prefixes", () => {
    const { writers, stdout, stderr } = createWriters();
    const ui = createUi({ writers, interactive: false });

    ui.warn("careful");
    ui.error("broken");

    expect(stderr()).toContain("warning: careful");
    expect(stderr()).toContain("error: broken");
    expect(stdout()).toBe("");
  });

  it("renders a note as a title followed by an indented body", () => {
    const { writers, stdout } = createWriters();
    const ui = createUi({ writers, interactive: false });

    ui.note("Title", "First line\nSecond line");

    const lines = stdout().split("\n");
    expect(lines).toContain("Title");
    expect(lines).toContain("  First line");
    expect(lines).toContain("  Second line");
  });

  it("writes intro and outro messages to stdout", () => {
    const { writers, stdout } = createWriters();
    const ui = createUi({ writers, interactive: false });

    ui.intro("Welcome");
    ui.outro("Done");

    expect(stdout()).toContain("Welcome");
    expect(stdout()).toContain("Done");
  });

  it("fails to confirm with a usage error pointing at --yes", async () => {
    const { writers, stdout, stderr } = createWriters();
    const ui = createUi({ writers, interactive: false });

    await expect(ui.confirm("Proceed?")).rejects.toThrow(CliError);

    const error = await captureCliError(ui.confirm("Proceed?"));
    expect(error).toBeInstanceOf(Error);
    expect(error.exitCode).toBe(2);
    expect(error.message).toContain("--yes");
    expect(stdout()).toBe("");
    expect(stderr()).toBe("");
  });

  it("fails to select with a usage error", async () => {
    const { writers, stdout, stderr } = createWriters();
    const ui = createUi({ writers, interactive: false });

    const error = await captureCliError(
      ui.select("Pick one", [
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B", hint: "second" },
      ]),
    );

    expect(error.exitCode).toBe(2);
    expect(error.message).toContain("interactive terminal");
    expect(stdout()).toBe("");
    expect(stderr()).toBe("");
  });

  it("spinner resolves with the task value", async () => {
    const { writers, stdout, stderr } = createWriters();
    const ui = createUi({ writers, interactive: false });

    const value = await ui.spinner("working", async () => 42);

    expect(value).toBe(42);
    expect(stdout()).toBe("");
    expect(stderr()).toBe("");
  });

  it("spinner propagates task rejections", async () => {
    const { writers } = createWriters();
    const ui = createUi({ writers, interactive: false });

    await expect(
      ui.spinner("working", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});

describe("createUi (clack, interactive)", () => {
  it("exposes every Ui method as a function", () => {
    const { writers } = createWriters();
    const ui = createUi({ writers, interactive: true });

    const methods: readonly (keyof Ui)[] = [
      "intro",
      "outro",
      "note",
      "info",
      "success",
      "warn",
      "error",
      "confirm",
      "select",
      "spinner",
    ];

    for (const method of methods) {
      expect(typeof ui[method]).toBe("function");
    }
  });
});

describe("detectInteractive", () => {
  it("is true only when both streams are TTYs", () => {
    expect(detectInteractive({ stdout: { isTTY: true }, stdin: { isTTY: true } })).toBe(true);
    expect(detectInteractive({ stdout: { isTTY: true }, stdin: { isTTY: false } })).toBe(false);
    expect(detectInteractive({ stdout: { isTTY: false }, stdin: { isTTY: true } })).toBe(false);
    expect(detectInteractive({ stdout: { isTTY: false }, stdin: { isTTY: false } })).toBe(false);
  });

  it("is false when a stream does not report isTTY", () => {
    expect(detectInteractive({ stdout: {}, stdin: {} })).toBe(false);
    expect(detectInteractive({ stdout: { isTTY: undefined }, stdin: { isTTY: true } })).toBe(false);
  });
});

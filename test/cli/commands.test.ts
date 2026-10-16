import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../../src/cli/main.js";

function context(runtime: {
  cwd: string;
  home: string;
  env?: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
}) {
  let output = "";
  let errors = "";
  return {
    ctx: {
      runtime,
      write: (text: string) => {
        output += text;
      },
      writeError: (text: string) => {
        errors += text;
      },
    },
    output: () => output,
    errors: () => errors,
  };
}

const catalog = {
  skills: [
    { name: "git-release", version: "1.2.0", files: ["git-release.md"] },
    { name: "review-pr", files: ["SKILL.md"] },
  ],
};

function fetchCatalog(): typeof fetch {
  return async (input) =>
    new Response(
      String(input).endsWith("catalog-version.json")
        ? JSON.stringify({ version: "1.0.1" })
        : JSON.stringify(catalog),
    );
}

async function projectFixture(): Promise<{ root: string; home: string }> {
  const root = await mkdtemp(join(tmpdir(), "ai-config-command-"));
  const home = await mkdtemp(join(tmpdir(), "ai-config-home-"));
  await mkdir(join(root, ".git"));
  return { root, home };
}

describe("registered commands", () => {
  it("init creates a project config and preserves JSONC content", async () => {
    const { root, home } = await projectFixture();
    await writeFile(
      join(root, "opencode.jsonc"),
      ["{", "  // keep this comment", '  "model": "example"', "}", ""].join("\n"),
      "utf8",
    );
    const run = context({
      cwd: root,
      home,
      fetchImpl: fetchCatalog(),
    });

    await expect(main(["init"], run.ctx)).resolves.toBe(0);
    const text = await readFile(join(root, "opencode.jsonc"), "utf8");
    expect(text).toContain("// keep this comment");
    expect(text).toContain('"model": "example"');
    expect(text).toContain("https://raulmoracode.github.io/raulmoracode-skills/");
  });

  it("skills --json reports catalog, configured URLs, and cached skills", async () => {
    const { root, home } = await projectFixture();
    await writeFile(
      join(root, "opencode.json"),
      JSON.stringify({ skills: ["https://raulmoracode.github.io/raulmoracode-skills/"] }),
      "utf8",
    );
    const run = context({
      cwd: root,
      home,
      fetchImpl: fetchCatalog(),
    });

    await expect(main(["skills", "--json"], run.ctx)).resolves.toBe(0);
    const result = JSON.parse(run.output()) as {
      available: { name: string }[];
      configured: string[];
      cached: unknown[];
      catalogVersion: string;
    };
    expect(result.available.map((skill) => skill.name)).toEqual(["git-release", "review-pr"]);
    expect(result.configured).toEqual(["https://raulmoracode.github.io/raulmoracode-skills/"]);
    expect(result.cached).toEqual([]);
    expect(result.catalogVersion).toBe("1.0.1");
  });

  it("doctor is read-only and returns a failing status for missing config", async () => {
    const { root, home } = await projectFixture();
    const run = context({
      cwd: root,
      home,
      fetchImpl: fetchCatalog(),
    });

    await expect(main(["doctor", "--json"], run.ctx)).resolves.toBe(1);
    await expect(stat(join(root, "opencode.json"))).rejects.toMatchObject({ code: "ENOENT" });
    const result = JSON.parse(run.output()) as {
      ok: boolean;
      checks: { name: string; ok: boolean }[];
    };
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual(expect.objectContaining({ name: "config", ok: false }));
  });
});

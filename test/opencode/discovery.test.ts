import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findProjectRoot } from "../../src/opencode/discovery.js";

async function makeDir(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}

describe("findProjectRoot", () => {
  it("finds the closest ancestor containing a .git directory", async () => {
    const root = await makeDir("discovery-test-");
    await mkdir(join(root, ".git"));
    const nested = join(root, "packages", "app", "src");
    await mkdir(nested, { recursive: true });

    expect(await findProjectRoot(nested)).toBe(root);
  });

  it("accepts a .git file (worktrees and submodules)", async () => {
    const root = await makeDir("discovery-test-");
    await writeFile(join(root, ".git"), "gitdir: /elsewhere\n");
    const nested = join(root, "nested");
    await mkdir(nested);

    expect(await findProjectRoot(nested)).toBe(root);
  });

  it("returns the starting directory when no marker exists up the tree", async () => {
    const dir = await makeDir("discovery-test-");

    expect(await findProjectRoot(dir)).toBe(dir);
  });

  it("resolves the starting directory before walking up", async () => {
    const dir = await makeDir("discovery-test-");

    expect(await findProjectRoot(`${dir}/nested/..`)).toBe(dir);
  });
});

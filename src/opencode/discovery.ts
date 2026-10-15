import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Walk up from `cwd` looking for a project root: the closest ancestor (or
 * `cwd` itself) containing a `.git` entry. The marker may be a directory (a
 * normal clone) or a file (worktrees and submodules). Falls back to the
 * resolved `cwd` when no marker exists anywhere up the tree.
 */
export async function findProjectRoot(cwd: string): Promise<string> {
  const start = resolve(cwd);
  let current = start;

  while (true) {
    if (await pathExists(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return start;
    }
    current = parent;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

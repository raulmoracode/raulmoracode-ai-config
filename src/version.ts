import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | undefined;

/**
 * Read the `version` field from the package manifest.
 *
 * The manifest lives one directory above the compiled module, which resolves
 * correctly both from `src/` during development and from `dist/` when built.
 */
export function readPackageVersion(): string {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }

  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
    throw new Error(`Invalid package manifest at ${packageJsonPath}: missing "version" field`);
  }

  if (typeof parsed.version !== "string") {
    throw new Error(`Invalid package manifest at ${packageJsonPath}: "version" must be a string`);
  }

  cachedVersion = parsed.version;
  return cachedVersion;
}

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readPackageVersion } from "../src/version.js";

function readManifestVersion(): string {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(manifestUrl, "utf8"));

  if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
    throw new Error(`Test setup error: ${manifestUrl.pathname} has no "version" field`);
  }

  if (typeof parsed.version !== "string") {
    throw new Error(`Test setup error: ${manifestUrl.pathname} "version" is not a string`);
  }

  return parsed.version;
}

describe("readPackageVersion", () => {
  it("returns the package.json version as a semver string", () => {
    const version = readPackageVersion();

    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(version).toBe(readManifestVersion());
  });
});

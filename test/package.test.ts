import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  name?: unknown;
  version?: unknown;
  private?: unknown;
  bin?: unknown;
  files?: unknown;
  scripts?: unknown;
};

function readPackageManifest(): PackageManifest {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(manifestUrl, "utf8"));

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Test setup error: package.json must contain an object");
  }

  return parsed;
}

describe("npm package manifest", () => {
  it("is configured for the first public release", () => {
    const manifest = readPackageManifest();

    expect(manifest.name).toBe("@raulmoracode/ai-config");
    expect(manifest.version).toBe("0.0.1");
    expect(manifest.private).toBeUndefined();
    expect(manifest.bin).toEqual({ "raulmoracode-ai-config": "dist/index.js" });
    expect(manifest.files).toEqual(["dist", "README.md", "CHANGELOG.md", "LICENSE"]);
    expect(manifest.scripts).toMatchObject({ prepack: "npm run build" });
  });
});

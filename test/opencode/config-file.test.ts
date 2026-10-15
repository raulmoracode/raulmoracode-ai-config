import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySkillsUrl,
  findExistingConfigFile,
  parseConfigText,
  readConfigFile,
  type SkillsConfig,
  skillsFromConfig,
  writeConfigFile,
} from "../../src/opencode/config-file.js";
import { projectConfigCandidates } from "../../src/opencode/paths.js";

function parseValueOrThrow(text: string): unknown {
  const result = parseConfigText(text);
  if (!result.ok) {
    throw new Error(`Expected valid JSONC, got: ${result.errors.join("; ")}`);
  }
  return result.value;
}

function skillsOf(text: string): SkillsConfig {
  return skillsFromConfig(parseValueOrThrow(text));
}

function applyOrThrow(text: string, url: string): { text: string; changed: boolean } {
  const result = applySkillsUrl(text, url);
  if (!result.ok) {
    throw new Error(`Expected the edit to succeed, got: ${result.error}`);
  }
  return { text: result.text, changed: result.changed };
}

describe("parseConfigText", () => {
  it("parses JSONC with comments and trailing commas", () => {
    const text = [
      "{",
      "  // remote catalog sources",
      '  "skills": ["https://skills.example/catalog",],',
      "}",
    ].join("\n");

    expect(parseValueOrThrow(text)).toEqual({ skills: ["https://skills.example/catalog"] });
  });

  it("reports a parse error with its line and column", () => {
    const result = parseConfigText('{\n  "skills": [\n}');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parsing to fail");
    }
    expect(result.errors[0]).toBe("ValueExpected at line 3 column 1");
  });

  it("reports every parse error it collects", () => {
    const result = parseConfigText('{\n  "skills" 3\n}');

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parsing to fail");
    }
    expect(result.errors).toEqual(["ColonExpected at line 2 column 12"]);
  });
});

describe("skillsFromConfig", () => {
  it("reports absent when there is no skills key", () => {
    expect(skillsFromConfig({})).toEqual({
      form: "absent",
      urls: [],
      paths: [],
      invalidEntries: 0,
    });
  });

  it("reports absent when there is no configuration object", () => {
    expect(skillsFromConfig(undefined).form).toBe("absent");
    expect(skillsFromConfig([]).form).toBe("absent");
  });

  it("classifies a v2 array of strings", () => {
    const config = skillsFromConfig({
      skills: ["https://skills.example/catalog", "./vendor/skills"],
    });

    expect(config).toEqual({
      form: "array",
      urls: ["https://skills.example/catalog"],
      paths: ["./vendor/skills"],
      invalidEntries: 0,
    });
  });

  it("counts non-string array entries instead of failing", () => {
    const config = skillsFromConfig({ skills: ["https://skills.example/catalog", 42, null] });

    expect(config.form).toBe("array");
    expect(config.urls).toEqual(["https://skills.example/catalog"]);
    expect(config.paths).toEqual([]);
    expect(config.invalidEntries).toBe(2);
  });

  it("reads the deprecated object form", () => {
    const config = skillsFromConfig({
      skills: { paths: ["./vendor/skills"], urls: ["https://skills.example/catalog"] },
    });

    expect(config).toEqual({
      form: "object",
      urls: ["https://skills.example/catalog"],
      paths: ["./vendor/skills"],
      invalidEntries: 0,
    });
  });

  it("accepts an object form without any list", () => {
    expect(skillsFromConfig({ skills: {} })).toEqual({
      form: "object",
      urls: [],
      paths: [],
      invalidEntries: 0,
    });
  });

  it("counts non-string object entries instead of failing", () => {
    const config = skillsFromConfig({ skills: { urls: [1, "https://skills.example/catalog"] } });

    expect(config.form).toBe("object");
    expect(config.urls).toEqual(["https://skills.example/catalog"]);
    expect(config.invalidEntries).toBe(1);
  });

  it("reports a malformed object form as invalid", () => {
    expect(skillsFromConfig({ skills: { urls: "https://skills.example/catalog" } }).form).toBe(
      "invalid",
    );
  });

  it("reports a non-array, non-object skills value as invalid", () => {
    expect(skillsFromConfig({ skills: 42 })).toEqual({
      form: "invalid",
      urls: [],
      paths: [],
      invalidEntries: 0,
    });
  });
});

describe("applySkillsUrl", () => {
  it("creates the skills array when the setting is absent", () => {
    const applied = applyOrThrow('{\n  "model": "example"\n}\n', "https://skills.example");

    expect(applied.changed).toBe(true);
    expect(applied.text).toContain('"model": "example"');
    expect(skillsOf(applied.text)).toEqual({
      form: "array",
      urls: ["https://skills.example"],
      paths: [],
      invalidEntries: 0,
    });
    expect(applied.text.endsWith("}\n")).toBe(true);
  });

  it("creates the skills array in an empty object", () => {
    const applied = applyOrThrow("{}", "https://skills.example");

    expect(applied.changed).toBe(true);
    expect(skillsOf(applied.text).urls).toEqual(["https://skills.example"]);
  });

  it("appends to an existing array without touching comments elsewhere", () => {
    const text = ["{", "  // catalog sources", '  "skills": ["https://a.example"]', "}", ""].join(
      "\n",
    );

    const applied = applyOrThrow(text, "https://b.example");

    expect(applied.changed).toBe(true);
    expect(applied.text).toContain("// catalog sources");
    expect(skillsOf(applied.text).urls).toEqual(["https://a.example", "https://b.example"]);
  });

  it("leaves the text untouched when the url is already present", () => {
    const text = '{\n  "skills": ["https://a.example"]\n}\n';

    const applied = applyOrThrow(text, "https://a.example");

    expect(applied.changed).toBe(false);
    expect(applied.text).toBe(text);
  });

  it("appends to urls of the deprecated object form, preserving other keys", () => {
    const text = [
      "{",
      '  "skills": {',
      '    "paths": ["./vendor/skills"],',
      '    "urls": ["https://a.example"]',
      "  },",
      '  "model": "example"',
      "}",
      "",
    ].join("\n");

    const applied = applyOrThrow(text, "https://b.example");

    expect(applied.changed).toBe(true);
    expect(applied.text).toContain('"model": "example"');
    expect(skillsOf(applied.text)).toEqual({
      form: "object",
      urls: ["https://a.example", "https://b.example"],
      paths: ["./vendor/skills"],
      invalidEntries: 0,
    });
  });

  it("creates urls inside the deprecated object form when missing", () => {
    const text = '{\n  "skills": {\n    "paths": ["./vendor/skills"]\n  }\n}\n';

    const applied = applyOrThrow(text, "https://skills.example");

    expect(skillsOf(applied.text)).toEqual({
      form: "object",
      urls: ["https://skills.example"],
      paths: ["./vendor/skills"],
      invalidEntries: 0,
    });
  });

  it("leaves the object form untouched when the url is already present", () => {
    const text = '{\n  "skills": {\n    "urls": ["https://a.example"]\n  }\n}\n';

    const applied = applyOrThrow(text, "https://a.example");

    expect(applied.changed).toBe(false);
    expect(applied.text).toBe(text);
  });

  it("fails when the skills setting has an unsupported type", () => {
    const result = applySkillsUrl('{\n  "skills": 42\n}\n', "https://skills.example");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the edit to fail");
    }
    expect(result.error).toContain('"skills"');
  });

  it("fails when the object form has a malformed urls setting", () => {
    const result = applySkillsUrl(
      '{\n  "skills": {\n    "urls": "https://a.example"\n  }\n}\n',
      "https://skills.example",
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the edit to fail");
    }
    expect(result.error).toContain('"skills.urls"');
  });

  it("fails on invalid JSONC input", () => {
    const result = applySkillsUrl('{\n  "skills": [\n}', "https://skills.example");

    expect(result.ok).toBe(false);
  });

  it("keeps four-space indentation", () => {
    const applied = applyOrThrow('{\n    "model": "example"\n}\n', "https://skills.example");

    expect(applied.text).toMatch(/\n {4}"skills":/);
    expect(applied.text).not.toMatch(/\n {2}"skills":/);
  });

  it("preserves a trailing newline", () => {
    const applied = applyOrThrow('{\n  "skills": ["https://a.example"]\n}\n', "https://b.example");

    expect(applied.text.endsWith("}\n")).toBe(true);
  });

  it("preserves the absence of a trailing newline", () => {
    const applied = applyOrThrow('{\n  "skills": ["https://a.example"]\n}', "https://b.example");

    expect(applied.text.endsWith("}")).toBe(true);
  });

  it("produces text that parses cleanly", () => {
    const applied = applyOrThrow('{\n  "skills": ["https://a.example"]\n}\n', "https://b.example");

    expect(parseConfigText(applied.text).ok).toBe(true);
  });
});

describe("config file IO", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "ai-config-test-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe("findExistingConfigFile", () => {
    it("prefers the jsonc candidate over json when both exist", async () => {
      await writeFile(join(directory, "opencode.json"), "{}\n", "utf8");
      await writeFile(join(directory, "opencode.jsonc"), "{}\n", "utf8");

      await expect(findExistingConfigFile(projectConfigCandidates(directory))).resolves.toBe(
        join(directory, "opencode.jsonc"),
      );
    });

    it("finds the json candidate when only it exists", async () => {
      await writeFile(join(directory, "opencode.json"), "{}\n", "utf8");

      await expect(findExistingConfigFile(projectConfigCandidates(directory))).resolves.toBe(
        join(directory, "opencode.json"),
      );
    });

    it("returns undefined when no candidate exists", async () => {
      await expect(
        findExistingConfigFile(projectConfigCandidates(directory)),
      ).resolves.toBeUndefined();
    });
  });

  describe("readConfigFile", () => {
    it("returns the text of an existing file", async () => {
      await writeFile(join(directory, "opencode.json"), '{ "skills": [] }\n', "utf8");

      await expect(readConfigFile(join(directory, "opencode.json"))).resolves.toEqual({
        exists: true,
        text: '{ "skills": [] }\n',
      });
    });

    it("reports a missing file instead of throwing", async () => {
      await expect(readConfigFile(join(directory, "missing.json"))).resolves.toEqual({
        exists: false,
      });
    });

    it("rethrows other errors with the path as context", async () => {
      const blocker = join(directory, "plain.txt");
      await writeFile(blocker, "not a directory", "utf8");

      await expect(readConfigFile(join(blocker, "nested.json"))).rejects.toThrow(
        join(blocker, "nested.json"),
      );
    });
  });

  describe("writeConfigFile", () => {
    it("writes the file and leaves no temporary files behind", async () => {
      const path = join(directory, "opencode.json");

      await writeConfigFile(path, '{ "skills": [] }\n');

      await expect(readFile(path, "utf8")).resolves.toBe('{ "skills": [] }\n');
      await expect(readdir(directory)).resolves.toEqual(["opencode.json"]);
    });

    it("does not create parent directories", async () => {
      const path = join(directory, "missing", "opencode.json");

      await expect(writeConfigFile(path, "{}\n")).rejects.toThrow(path);
      await expect(readdir(directory)).resolves.toEqual([]);
    });
  });
});

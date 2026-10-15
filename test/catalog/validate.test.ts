import { describe, expect, it } from "vitest";
import { isSafeRelativePath, validateCatalog } from "../../src/catalog/validate.js";

interface ValidCase {
  label: string;
  value: unknown;
}

interface ErrorCase {
  label: string;
  value: unknown;
  fragments: string[];
}

const validCases: ValidCase[] = [
  {
    label: "a minimal catalog",
    value: { skills: [{ name: "git-release", files: ["git-release.md"] }] },
  },
  {
    label: "a skill with a version and a nested reference file",
    value: {
      skills: [
        {
          name: "git-release",
          version: "1.2.3",
          files: ["git-release.md", "references/tags.md"],
        },
      ],
    },
  },
  {
    label: "a skill that uses SKILL.md as its entry file",
    value: { skills: [{ name: "code-review", files: ["SKILL.md"] }] },
  },
  {
    label: "a catalog with several skills",
    value: {
      skills: [
        { name: "git-release", version: "1.0.0", files: ["git-release.md"] },
        { name: "code-review", files: ["SKILL.md", "checklist.md"] },
      ],
    },
  },
  {
    label: "an empty skills array",
    value: { skills: [] },
  },
];

const unsafePaths = [
  "/x",
  "a/../b",
  "..",
  ".",
  "a\\b",
  "a//b",
  "x?y",
  "x#y",
  "trailing/",
  "a/./b",
  "",
  "nul\u0000char",
  "bell\u0007char",
];

const errorCases: ErrorCase[] = [
  { label: "null", value: null, fragments: ["catalog: expected an object"] },
  { label: "a top-level array", value: [], fragments: ["catalog: expected an object"] },
  {
    label: "an unknown top-level key",
    value: { skills: [], extra: true },
    fragments: ['catalog: unknown key "extra"'],
  },
  {
    label: "a missing skills key",
    value: {},
    fragments: ['catalog: missing required key "skills"'],
  },
  {
    label: "skills not being an array",
    value: { skills: {} },
    fragments: ['catalog: "skills" must be an array'],
  },
  {
    label: "an entry that is not an object",
    value: { skills: [42] },
    fragments: ["skills[0]: expected an object"],
  },
  {
    label: "an array entry",
    value: { skills: [["git-release"]] },
    fragments: ["skills[0]: expected an object"],
  },
  {
    label: "an unknown entry key",
    value: { skills: [{ name: "git-release", files: ["git-release.md"], description: "x" }] },
    fragments: ['skill "git-release": unknown key "description"'],
  },
  {
    label: "a missing name",
    value: { skills: [{ files: ["git-release.md"] }] },
    fragments: ['skills[0]: "name" must be a non-empty string'],
  },
  {
    label: "an uppercase name",
    value: { skills: [{ name: "Git-Release", files: ["Git-Release.md"] }] },
    fragments: ['skill "Git-Release": invalid name'],
  },
  {
    label: "an underscored name",
    value: { skills: [{ name: "git_release", files: ["git_release.md"] }] },
    fragments: ['skill "git_release": invalid name'],
  },
  {
    label: "a name with spaces",
    value: { skills: [{ name: "git release", files: ["git release.md"] }] },
    fragments: ['skill "git release": invalid name'],
  },
  {
    label: "an empty name",
    value: { skills: [{ name: "", files: ["SKILL.md"] }] },
    fragments: ['skills[0]: "name" must be a non-empty string'],
  },
  {
    label: "a non-string name",
    value: { skills: [{ name: 7, files: ["SKILL.md"] }] },
    fragments: ['skills[0]: "name" must be a non-empty string'],
  },
  {
    label: "a name longer than 64 characters",
    value: { skills: [{ name: "a".repeat(65), files: ["SKILL.md"] }] },
    fragments: ["name must be at most 64 characters"],
  },
  {
    label: "an empty version",
    value: { skills: [{ name: "git-release", version: "", files: ["git-release.md"] }] },
    fragments: ['skill "git-release": "version" must be a non-empty string'],
  },
  {
    label: "a non-string version",
    value: { skills: [{ name: "git-release", version: 2, files: ["git-release.md"] }] },
    fragments: ['skill "git-release": "version" must be a non-empty string'],
  },
  {
    label: "a missing files key",
    value: { skills: [{ name: "git-release" }] },
    fragments: ['skill "git-release": missing required key "files"'],
  },
  {
    label: "an empty files array",
    value: { skills: [{ name: "git-release", files: [] }] },
    fragments: ['skill "git-release": "files" must not be empty'],
  },
  {
    label: "files not being an array",
    value: { skills: [{ name: "git-release", files: "git-release.md" }] },
    fragments: ['skill "git-release": "files" must be an array'],
  },
  {
    label: "a non-string files entry",
    value: { skills: [{ name: "git-release", files: ["git-release.md", 7] }] },
    fragments: ['skill "git-release": files[1] must be a string'],
  },
  {
    label: "duplicate skill names",
    value: {
      skills: [
        { name: "git-release", files: ["git-release.md"] },
        { name: "git-release", files: ["SKILL.md"] },
      ],
    },
    fragments: ['duplicate skill name "git-release"'],
  },
  {
    label: "duplicate files within one entry",
    value: { skills: [{ name: "git-release", files: ["git-release.md", "git-release.md"] }] },
    fragments: ['skill "git-release": duplicate file "git-release.md"'],
  },
  {
    label: "files without the entry markdown file",
    value: { skills: [{ name: "git-release", files: ["README.md", "docs/usage.md"] }] },
    fragments: ['skill "git-release": files must include "git-release.md" or "SKILL.md"'],
  },
  ...unsafePaths.map(
    (path): ErrorCase => ({
      label: `the unsafe path ${JSON.stringify(path)}`,
      value: { skills: [{ name: "git-release", files: [path] }] },
      fragments: [`skill "git-release": unsafe file path ${JSON.stringify(path)}`],
    }),
  ),
];

describe("isSafeRelativePath", () => {
  const safePaths = [
    "git-release.md",
    "SKILL.md",
    "references/tags.md",
    "assets/logo-2x.png",
    "file with spaces.md",
  ];

  it.each(safePaths)("accepts %j", (path) => {
    expect(isSafeRelativePath(path)).toBe(true);
  });

  it.each(unsafePaths)("rejects %j", (path) => {
    expect(isSafeRelativePath(path)).toBe(false);
  });
});

describe("validateCatalog", () => {
  it.each(validCases)("accepts $label", ({ value }) => {
    const result = validateCatalog(value);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.catalog).toEqual(value);
    }
  });

  it.each(errorCases)("rejects $label", ({ value, fragments }) => {
    const result = validateCatalog(value);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const joined = result.errors.join("\n");
      for (const fragment of fragments) {
        expect(joined, `expected an error containing ${JSON.stringify(fragment)}`).toContain(
          fragment,
        );
      }
    }
  });

  it("collects every error instead of stopping at the first", () => {
    const result = validateCatalog({
      skills: [
        { name: "Bad_Name", files: ["../escape.md"] },
        { name: "other", files: ["README.md"] },
        42,
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      const joined = result.errors.join("\n");
      expect(joined).toContain("invalid name");
      expect(joined).toContain("unsafe file path");
      expect(joined).toContain('skill "other": files must include "other.md" or "SKILL.md"');
      expect(joined).toContain("skills[2]: expected an object");
    }
  });

  it("accepts a 64-character name and rejects a 65-character one", () => {
    const maxLength = "a".repeat(64);

    expect(validateCatalog({ skills: [{ name: maxLength, files: [`${maxLength}.md`] }] }).ok).toBe(
      true,
    );
    expect(validateCatalog({ skills: [{ name: `${maxLength}a`, files: ["SKILL.md"] }] }).ok).toBe(
      false,
    );
  });
});

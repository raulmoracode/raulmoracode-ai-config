import type { Catalog, CatalogSkill, CatalogVersion } from "./types.js";

export type CatalogValidation = { ok: true; catalog: Catalog } | { ok: false; errors: string[] };

const SKILL_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SKILL_NAME_LENGTH = 64;
const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(["skills"]);
const ENTRY_KEYS: ReadonlySet<string> = new Set(["name", "version", "files"]);
const CATALOG_VERSION_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * True when `path` is a safe relative file path: non-empty, no leading `/`,
 * no backslashes, no `?` or `#`, no empty, `.` or `..` segments and no NUL
 * or other control characters. Catalog file paths are resolved against
 * `<base>/<encoded skill name>/` on the same origin, so anything unusual is
 * rejected rather than sanitized.
 */
export function isSafeRelativePath(path: string): boolean {
  if (path.length === 0) {
    return false;
  }
  if (path.startsWith("/") || path.includes("\\") || path.includes("?") || path.includes("#")) {
    return false;
  }
  if (hasControlCharacter(path)) {
    return false;
  }

  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/** Quote an untrusted string for an error message, escaping control characters. */
function quote(value: string): string {
  return JSON.stringify(value);
}

/**
 * Strictly validate a parsed catalog index document. Treats the input as
 * untrusted: unknown keys, malformed entries, unsafe file paths, duplicates
 * and skills without an entry markdown file are all reported. Every problem
 * is collected so a single run surfaces the complete list of errors.
 */
export function validateCatalog(value: unknown): CatalogValidation {
  if (!isPlainObject(value)) {
    return { ok: false, errors: ["catalog: expected an object"] };
  }

  const errors: string[] = [];

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      errors.push(`catalog: unknown key ${quote(key)}`);
    }
  }

  if (!Object.hasOwn(value, "skills")) {
    errors.push('catalog: missing required key "skills"');
    return { ok: false, errors };
  }

  const rawSkills = value.skills;
  if (!isUnknownArray(rawSkills)) {
    errors.push('catalog: "skills" must be an array');
    return { ok: false, errors };
  }

  const skills: CatalogSkill[] = [];
  const seenNames = new Set<string>();

  rawSkills.forEach((entry: unknown, index: number) => {
    const skill = validateSkillEntry(entry, index, errors);
    if (skill === undefined) {
      return;
    }
    if (seenNames.has(skill.name)) {
      errors.push(`duplicate skill name ${quote(skill.name)}`);
    } else {
      seenNames.add(skill.name);
    }
    skills.push(skill);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, catalog: { skills } };
}

export type CatalogVersionValidation =
  | { ok: true; catalogVersion: CatalogVersion }
  | { ok: false; errors: string[] };

export function validateCatalogVersion(value: unknown): CatalogVersionValidation {
  if (!isPlainObject(value)) {
    return { ok: false, errors: ["catalog version: expected an object"] };
  }

  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "version") {
      errors.push(`catalog version: unknown key ${quote(key)}`);
    }
  }
  const version = value.version;
  if (!Object.hasOwn(value, "version")) {
    errors.push('catalog version: missing required key "version"');
  } else if (typeof version !== "string" || !CATALOG_VERSION_PATTERN.test(version)) {
    errors.push('catalog version: "version" must be a semantic version string');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (typeof version !== "string") {
    return { ok: false, errors: ['catalog version: "version" must be a semantic version string'] };
  }
  return { ok: true, catalogVersion: { version } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function validateSkillEntry(
  value: unknown,
  index: number,
  errors: string[],
): CatalogSkill | undefined {
  const indexLabel = `skills[${index}]`;

  if (!isPlainObject(value)) {
    errors.push(`${indexLabel}: expected an object`);
    return undefined;
  }

  const rawName = value.name;
  const label =
    typeof rawName === "string" && rawName.length > 0 ? `skill ${quote(rawName)}` : indexLabel;

  for (const key of Object.keys(value)) {
    if (!ENTRY_KEYS.has(key)) {
      errors.push(`${label}: unknown key ${quote(key)}`);
    }
  }

  const name = validateName(rawName, label, errors);
  const version = validateVersion(value, label, errors);
  const files = validateFilesKey(value, label, name, errors);

  if (name === undefined || files === undefined) {
    return undefined;
  }

  const skill: CatalogSkill = { name, files };
  if (version !== undefined) {
    skill.version = version;
  }
  return skill;
}

function validateName(rawName: unknown, label: string, errors: string[]): string | undefined {
  if (typeof rawName !== "string" || rawName.length === 0) {
    errors.push(`${label}: "name" must be a non-empty string`);
    return undefined;
  }
  if (!SKILL_NAME_PATTERN.test(rawName)) {
    errors.push(`${label}: invalid name (expected lowercase words joined by single hyphens)`);
    return undefined;
  }
  if (rawName.length > MAX_SKILL_NAME_LENGTH) {
    errors.push(`${label}: name must be at most ${MAX_SKILL_NAME_LENGTH} characters`);
    return undefined;
  }
  return rawName;
}

function validateVersion(
  entry: Record<string, unknown>,
  label: string,
  errors: string[],
): string | undefined {
  if (!Object.hasOwn(entry, "version")) {
    return undefined;
  }

  const rawVersion = entry.version;
  if (typeof rawVersion !== "string" || rawVersion.length === 0) {
    errors.push(`${label}: "version" must be a non-empty string`);
    return undefined;
  }
  return rawVersion;
}

function validateFilesKey(
  entry: Record<string, unknown>,
  label: string,
  name: string | undefined,
  errors: string[],
): string[] | undefined {
  if (!Object.hasOwn(entry, "files")) {
    errors.push(`${label}: missing required key "files"`);
    return undefined;
  }

  const rawFiles = entry.files;
  if (!isUnknownArray(rawFiles)) {
    errors.push(`${label}: "files" must be an array`);
    return undefined;
  }
  if (rawFiles.length === 0) {
    errors.push(`${label}: "files" must not be empty`);
    return undefined;
  }

  return validateFiles(rawFiles, label, name, errors);
}

function validateFiles(
  rawFiles: unknown[],
  label: string,
  name: string | undefined,
  errors: string[],
): string[] {
  const files: string[] = [];
  const seen = new Set<string>();

  rawFiles.forEach((rawFile: unknown, index: number) => {
    if (typeof rawFile !== "string") {
      errors.push(`${label}: files[${index}] must be a string`);
      return;
    }
    if (!isSafeRelativePath(rawFile)) {
      errors.push(`${label}: unsafe file path ${quote(rawFile)}`);
      return;
    }
    if (seen.has(rawFile)) {
      errors.push(`${label}: duplicate file ${quote(rawFile)}`);
      return;
    }
    seen.add(rawFile);
    files.push(rawFile);
  });

  if (name !== undefined && !files.includes(`${name}.md`) && !files.includes("SKILL.md")) {
    errors.push(`${label}: files must include ${quote(`${name}.md`)} or ${quote("SKILL.md")}`);
  }

  return files;
}

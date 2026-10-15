import { randomUUID } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { FormattingOptions, JSONPath, ParseError } from "jsonc-parser";
import { applyEdits, modify, parse, printParseErrorCode } from "jsonc-parser";

const FIRST_INDENT_PATTERN = /\n([ \t]+)\S/;

/**
 * Parses JSONC text (comments and trailing commas allowed) and reports
 * structured, human-readable errors instead of throwing.
 */
export function parseConfigText(
  text: string,
): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    return { ok: false, errors: errors.map((error) => describeParseError(text, error)) };
  }

  return { ok: true, value };
}

/**
 * Normalized view of the `skills` setting.
 *
 * `form` describes which OpenCode generation the setting follows:
 * `"array"` is the v2 array of strings, `"object"` the deprecated
 * `{ paths?, urls? }` form, `"invalid"` a value of any other shape and
 * `"absent"` a configuration without the key (or without an object root).
 */
export interface SkillsConfig {
  form: "absent" | "array" | "object" | "invalid";
  urls: string[];
  paths: string[];
  invalidEntries: number;
}

/** Reads the `skills` setting of a parsed configuration value. */
export function skillsFromConfig(value: unknown): SkillsConfig {
  if (!isRecord(value)) {
    return emptySkills("absent");
  }

  const skills = value.skills;
  if (skills === undefined) {
    return emptySkills("absent");
  }

  if (Array.isArray(skills)) {
    return skillsFromArrayForm(skills);
  }

  if (isRecord(skills)) {
    return skillsFromObjectForm(skills);
  }

  return emptySkills("invalid");
}

/**
 * Adds `url` to the `skills` setting of JSONC text, using `jsonc-parser`
 * edits so comments, formatting, key order and unknown fields are preserved.
 *
 * Only the minimal edit is applied: an absent setting is created, an array
 * gains one entry, and the deprecated object form gains one entry in its
 * `urls` list. The user's chosen form is never rewritten.
 */
export function applySkillsUrl(
  text: string,
  url: string,
): { ok: true; text: string; changed: boolean } | { ok: false; error: string } {
  const parsed = parseConfigText(text);
  if (!parsed.ok) {
    return { ok: false, error: `Invalid JSONC: ${parsed.errors.join("; ")}` };
  }

  if (!isRecord(parsed.value)) {
    return { ok: false, error: "The configuration root must be a JSON object." };
  }

  const skills = parsed.value.skills;
  if (skills === undefined) {
    return editValue(text, ["skills"], [url]);
  }

  if (Array.isArray(skills)) {
    if (skills.includes(url)) {
      return { ok: true, text, changed: false };
    }
    return editValue(text, ["skills", skills.length], url);
  }

  if (isRecord(skills)) {
    const urls = skills.urls;
    if (urls === undefined) {
      return editValue(text, ["skills", "urls"], [url]);
    }
    if (!Array.isArray(urls)) {
      return { ok: false, error: 'The "skills.urls" setting must be an array of strings.' };
    }
    if (urls.includes(url)) {
      return { ok: true, text, changed: false };
    }
    return editValue(text, ["skills", "urls", urls.length], url);
  }

  return {
    ok: false,
    error:
      'The "skills" setting must be an array of strings or the deprecated object form; ' +
      `found ${describeValueType(skills)}.`,
  };
}

/**
 * Reads a configuration file, reporting absence as data rather than as an
 * error. Any other failure is rethrown with the path as context.
 */
export async function readConfigFile(
  path: string,
): Promise<{ exists: false } | { exists: true; text: string }> {
  try {
    const text = await readFile(path, "utf8");
    return { exists: true, text };
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return { exists: false };
    }
    throw new Error(`Failed to read config file ${path}: ${describeError(error)}`, {
      cause: error,
    });
  }
}

/**
 * Writes a configuration file atomically: the content goes to a temporary
 * file in the same directory and is then renamed over the target. Parent
 * directories are never created.
 */
export async function writeConfigFile(path: string, text: string): Promise<void> {
  const directory = dirname(path);
  const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, text, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await removeQuietly(temporaryPath);
    throw new Error(`Failed to write config file ${path}: ${describeError(error)}`, {
      cause: error,
    });
  }
}

/** Returns the first candidate path that exists as a file, if any. */
export async function findExistingConfigFile(
  candidates: readonly string[],
): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function skillsFromArrayForm(entries: readonly unknown[]): SkillsConfig {
  const config = emptySkills("array");

  for (const entry of entries) {
    if (typeof entry !== "string") {
      config.invalidEntries += 1;
      continue;
    }
    if (isHttpUrl(entry)) {
      config.urls.push(entry);
    } else {
      config.paths.push(entry);
    }
  }

  return config;
}

function skillsFromObjectForm(skills: Record<string, unknown>): SkillsConfig {
  const urlsField = skills.urls;
  const pathsField = skills.paths;

  if (urlsField !== undefined && !Array.isArray(urlsField)) {
    return emptySkills("invalid");
  }
  if (pathsField !== undefined && !Array.isArray(pathsField)) {
    return emptySkills("invalid");
  }

  const config = emptySkills("object");

  if (Array.isArray(urlsField)) {
    config.invalidEntries += collectStrings(urlsField, config.urls);
  }
  if (Array.isArray(pathsField)) {
    config.invalidEntries += collectStrings(pathsField, config.paths);
  }

  return config;
}

function collectStrings(entries: readonly unknown[], into: string[]): number {
  let invalidEntries = 0;

  for (const entry of entries) {
    if (typeof entry === "string") {
      into.push(entry);
    } else {
      invalidEntries += 1;
    }
  }

  return invalidEntries;
}

function emptySkills(form: SkillsConfig["form"]): SkillsConfig {
  return { form, urls: [], paths: [], invalidEntries: 0 };
}

function editValue(
  text: string,
  path: JSONPath,
  value: unknown,
): { ok: true; text: string; changed: true } {
  const edits = modify(text, path, value, { formattingOptions: detectFormattingOptions(text) });
  return { ok: true, text: applyEdits(text, edits), changed: true };
}

/** Detects the indentation used by the document, defaulting to two spaces. */
function detectFormattingOptions(text: string): FormattingOptions {
  const indent = FIRST_INDENT_PATTERN.exec(text)?.[1];

  if (indent === undefined) {
    return { tabSize: 2, insertSpaces: true };
  }
  if (indent.includes("\t")) {
    return { tabSize: 1, insertSpaces: false };
  }
  return { tabSize: indent.length, insertSpaces: true };
}

function describeParseError(text: string, error: ParseError): string {
  const { line, column } = lineAndColumnAt(text, error.offset);
  return `${printParseErrorCode(error.error)} at line ${line} column ${column}`;
}

interface Position {
  line: number;
  column: number;
}

/** Maps a zero-based offset to a one-based line and column. */
function lineAndColumnAt(text: string, offset: number): Position {
  const end = Math.min(Math.max(offset, 0), text.length);
  let line = 1;
  let column = 1;

  for (let index = 0; index < end; index += 1) {
    if (text.charAt(index) === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function describeValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "an array" : `a ${typeof value}`;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileSystemError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function removeQuietly(path: string): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch {
    return;
  }
}

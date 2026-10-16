import type { Catalog, CatalogVersion } from "./types.js";
import { validateCatalog, validateCatalogVersion } from "./validate.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 512 * 1024;

/** Error raised for any catalog problem: bad base URL, transport, size, JSON or schema. */
export class CatalogError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CatalogError";
  }
}

/**
 * Normalize a catalog base URL: it must parse as an http(s) URL and its
 * pathname must end with `/` so relative index and file paths resolve
 * against the catalog root.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new CatalogError(`invalid catalog base URL "${baseUrl}"`, { cause: error });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CatalogError(
      `unsupported catalog base URL protocol "${url.protocol}" (expected http or https)`,
    );
  }

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.href;
}

export interface FetchCatalogOptions {
  /** Fetch implementation to use; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Milliseconds before the request is aborted; defaults to 10 seconds. */
  timeoutMs?: number;
  /** Maximum accepted index size in bytes; defaults to 512 KiB. */
  maxBytes?: number;
}

/**
 * Download and validate the skills catalog index at `<base>/index.json`.
 * Every failure mode (transport, HTTP status, oversized response, invalid
 * JSON, schema violations) is raised as a `CatalogError`; the response body
 * is treated as untrusted input throughout.
 */
export async function fetchCatalog(
  baseUrl: string,
  options: FetchCatalogOptions = {},
): Promise<Catalog> {
  const indexUrl = new URL("index.json", normalizeBaseUrl(baseUrl));
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let response: Response;
  try {
    response = await fetchImpl(indexUrl, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new CatalogError(`failed to fetch ${indexUrl.href}`, { cause: error });
  }

  if (!response.ok) {
    throw new CatalogError(`failed to fetch ${indexUrl.href}: HTTP ${response.status}`);
  }

  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new CatalogError(oversizedMessage(indexUrl.href, maxBytes));
    }
  }

  const text = await readBody(response, indexUrl.href, maxBytes);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CatalogError(`catalog index at ${indexUrl.href} is not valid JSON`, { cause: error });
  }

  const validation = validateCatalog(parsed);
  if (!validation.ok) {
    const details = validation.errors.map((error) => `  - ${error}`).join("\n");
    throw new CatalogError(`catalog index at ${indexUrl.href} is invalid:\n${details}`);
  }

  return validation.catalog;
}

export async function fetchCatalogVersion(
  baseUrl: string,
  options: FetchCatalogOptions = {},
): Promise<CatalogVersion> {
  const metadataUrl = new URL("catalog-version.json", normalizeBaseUrl(baseUrl));
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let response: Response;
  try {
    response = await fetchImpl(metadataUrl, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new CatalogError(`failed to fetch ${metadataUrl.href}`, { cause: error });
  }
  if (!response.ok) {
    throw new CatalogError(`failed to fetch ${metadataUrl.href}: HTTP ${response.status}`);
  }
  const text = await readBody(response, metadataUrl.href, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CatalogError(`catalog version at ${metadataUrl.href} is not valid JSON`, {
      cause: error,
    });
  }
  const validation = validateCatalogVersion(parsed);
  if (!validation.ok) {
    const details = validation.errors.map((error) => `  - ${error}`).join("\n");
    throw new CatalogError(`catalog version at ${metadataUrl.href} is invalid:\n${details}`);
  }
  return validation.catalogVersion;
}

function oversizedMessage(url: string, maxBytes: number): string {
  return `catalog index at ${url} exceeds the maximum size of ${maxBytes} bytes`;
}

async function readBody(response: Response, url: string, maxBytes: number): Promise<string> {
  const body = response.body;
  if (body === null) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new CatalogError(oversizedMessage(url, maxBytes));
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

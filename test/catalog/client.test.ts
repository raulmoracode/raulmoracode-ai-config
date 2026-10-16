import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  CatalogError,
  fetchCatalog,
  fetchCatalogVersion,
  normalizeBaseUrl,
} from "../../src/catalog/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseUrl = "https://catalog.test/base";
const indexUrl = "https://catalog.test/base/index.json";

const validCatalog = {
  skills: [{ name: "git-release", version: "1.2.3", files: ["git-release.md"] }],
};

function stubFetch(fetchImpl: typeof fetch): Mock<typeof fetch> {
  const fetchMock = vi.fn<typeof fetch>(fetchImpl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function catchCatalogError(promise: Promise<unknown>): Promise<CatalogError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(CatalogError);
  if (!(error instanceof CatalogError)) {
    throw new Error("expected fetchCatalog to reject with a CatalogError");
  }
  return error;
}

describe("normalizeBaseUrl", () => {
  it("appends a trailing slash to the pathname", () => {
    expect(normalizeBaseUrl(baseUrl)).toBe(`${baseUrl}/`);
  });

  it("keeps an existing trailing slash", () => {
    expect(normalizeBaseUrl(`${baseUrl}/`)).toBe(`${baseUrl}/`);
  });

  it("normalizes a bare origin", () => {
    expect(normalizeBaseUrl("https://catalog.test")).toBe("https://catalog.test/");
  });

  it("rejects a non-http protocol", () => {
    expect(() => normalizeBaseUrl("file:///tmp/catalog")).toThrow(CatalogError);
  });

  it("rejects an invalid URL", () => {
    expect(() => normalizeBaseUrl("not a url")).toThrow(CatalogError);
  });
});

describe("fetchCatalog", () => {
  it("returns the validated catalog and requests the normalized index URL", async () => {
    const fetchMock = stubFetch(async () => new Response(JSON.stringify(validCatalog)));

    const catalog = await fetchCatalog(baseUrl);

    expect(catalog).toEqual(validCatalog);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(input?.toString()).toBe(indexUrl);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  describe("fetchCatalogVersion", () => {
    it("fetches and validates catalog-version.json", async () => {
      const fetchMock = stubFetch(async () => new Response(JSON.stringify({ version: "1.0.1" })));

      await expect(fetchCatalogVersion(baseUrl)).resolves.toEqual({ version: "1.0.1" });
      expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe(
        "https://catalog.test/base/catalog-version.json",
      );
    });

    it("rejects malformed metadata", async () => {
      stubFetch(async () => new Response(JSON.stringify({ version: "latest" })));

      await expect(fetchCatalogVersion(baseUrl)).rejects.toThrow(
        'version" must be a semantic version string',
      );
    });
  });

  it("prefers the provided fetch implementation over the global one", async () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("global fetch must not be used");
    });

    const catalog = await fetchCatalog(baseUrl, {
      fetchImpl: async () => new Response(JSON.stringify(validCatalog)),
    });

    expect(catalog).toEqual(validCatalog);
  });

  it("fails with a CatalogError on a non-OK HTTP status", async () => {
    stubFetch(async () => new Response("not found", { status: 404, statusText: "Not Found" }));

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain(indexUrl);
    expect(error.message).toContain("HTTP 404");
  });

  it("wraps network failures in a CatalogError mentioning the URL", async () => {
    const cause = new TypeError("fetch failed");
    stubFetch(async () => {
      throw cause;
    });

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain(indexUrl);
    expect(error.cause).toBe(cause);
  });

  it("wraps a timeout abort in a CatalogError", async () => {
    stubFetch(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain(indexUrl);
    expect(error.cause).toBeInstanceOf(DOMException);
  });

  it("fails with a CatalogError when the body is not valid JSON", async () => {
    stubFetch(async () => new Response("{ not json"));

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain(indexUrl);
    expect(error.message).toContain("not valid JSON");
  });

  it("fails with a CatalogError listing the schema validation errors", async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ skills: [{ name: "git-release", files: ["README.md"] }] })),
    );

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain(`${indexUrl} is invalid`);
    expect(error.message).toContain('files must include "git-release.md" or "SKILL.md"');
  });

  it("rejects a non-http base URL without calling fetch", async () => {
    const fetchMock = stubFetch(async () => new Response("{}"));

    await expect(fetchCatalog("file:///tmp/catalog")).rejects.toBeInstanceOf(CatalogError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response whose content-length header exceeds the limit", async () => {
    stubFetch(async () => new Response("{}", { headers: { "content-length": "614400" } }));

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain("exceeds the maximum size");
  });

  it("rejects an oversized streaming body without a content-length header", async () => {
    const bigBody = JSON.stringify({ skills: [], padding: "a".repeat(600 * 1024) });

    stubFetch(async () => {
      const response = new Response(bigBody);
      response.headers.delete("content-length");
      return response;
    });

    const error = await catchCatalogError(fetchCatalog(baseUrl));

    expect(error.message).toContain("exceeds the maximum size");
  });

  it("respects a custom maxBytes option", async () => {
    stubFetch(async () => new Response(JSON.stringify(validCatalog)));

    const error = await catchCatalogError(fetchCatalog(baseUrl, { maxBytes: 8 }));

    expect(error.message).toContain("exceeds the maximum size of 8 bytes");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { Leads2bHttpClient } from "../src/client/http.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Leads2bHttpClient", () => {
  it("appends repeated query parameters for array values", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    globalThis.fetch = fetchMock;
    const client = new Leads2bHttpClient({
      api: "v2",
      baseUrl: "https://app.example.test/api/v2",
      token: "token"
    });

    await client.get("/mail/calendars/events", {
      query: {
        "users[]": [10, 20],
        "calendars[]": ["leads2b"],
        "types[]": ["action", "meet"],
        limit: 200,
        ignored: undefined
      } as never
    });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const url = new URL(String(firstCall?.[0]));

    expect(url.searchParams.getAll("users[]")).toEqual(["10", "20"]);
    expect(url.searchParams.getAll("calendars[]")).toEqual(["leads2b"]);
    expect(url.searchParams.getAll("types[]")).toEqual(["action", "meet"]);
    expect(url.searchParams.get("limit")).toBe("200");
    expect(url.searchParams.has("ignored")).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV2Client } from "../src/client/v2.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const client = () => new Leads2bV2Client(new Leads2bHttpClient({
  api: "v2", baseUrl: "https://example.com/api/v2", token: "<TOKEN>", maxReadRetries: 0
}));

describe("observed deals pagination", () => {
  it("reads later pages even when the server caps page size below the requested limit", async () => {
    globalThis.fetch = async url => {
      const offset = Number(new URL(String(url)).searchParams.get("offset"));
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }].slice(offset, offset + 2);
      return Response.json({ data: rows, total: 3, entity: "OPPORTUNITY" });
    };
    const result = await client().scanDeals({ entity: "OPPORTUNITY", pageSize: 100, maxPages: 3 });
    expect(result.data.map(x => x.id)).toEqual([1, 2, 3]);
    expect(result.coverage).toMatchObject({ status: "complete", pagesFetched: 2, recordsFetched: 3 });
  });

  it("returns a continuation when it reaches the page budget", async () => {
    globalThis.fetch = async () => Response.json({ data: [{ id: 1 }, { id: 2 }], total: 5 });
    const result = await client().scanDeals({ entity: "LEAD", pageSize: 2, maxPages: 1 });
    expect(result.coverage).toMatchObject({ status: "partial", reason: "page_limit", nextOffset: 2 });
  });

  it("stops when the upstream ignores offset instead of reporting complete", async () => {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return Response.json({ data: [{ id: 1 }, { id: 2 }], total: 8 }); };
    const result = await client().scanDeals({ entity: "LEAD", pageSize: 2, maxPages: 5 });
    expect(result.data).toHaveLength(2);
    expect(result.coverage).toMatchObject({ status: "partial", reason: "repeated_page" });
    expect(requests).toBe(2);
  });

  it("keeps retrieved data and marks partial when a later page fails", async () => {
    globalThis.fetch = async url => Number(new URL(String(url)).searchParams.get("offset")) === 0
      ? Response.json({ data: [{ id: 1 }], total: 2 }) : new Response("unavailable", { status: 503 });
    const result = await client().scanDeals({ entity: "OPPORTUNITY", pageSize: 1, maxPages: 3 });
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.coverage).toMatchObject({ status: "partial", reason: "request_failed", nextOffset: 1 });
  });

  it("never treats an unrecognized response as an empty successful collection", async () => {
    globalThis.fetch = async () => Response.json({ unexpected: [] });
    await expect(client().scanDeals({ entity: "LEAD" })).rejects.toThrow(/formato/i);
  });

  it.each([{ unexpected: [] }, { data: [null], total: 2 }])(
    "preserves valid pages when a later response has an invalid format: %j", async invalid => {
      globalThis.fetch = async url => Number(new URL(String(url)).searchParams.get("offset")) === 0
        ? Response.json({ data: [{ id: 1 }], total: 2 }) : Response.json(invalid);
      const result = await client().scanDeals({ entity: "OPPORTUNITY", pageSize: 1, maxPages: 3 });
      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.coverage).toMatchObject({
        status: "partial", reason: "invalid_response", pagesFetched: 1, recordsFetched: 1, nextOffset: 1
      });
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  );

  it.each([0, 0.5, -1, "0"])("does not claim completeness with an invalid or contradictory total: %j", async total => {
    globalThis.fetch = async () => Response.json({ data: [{ id: 1 }], total });
    const result = await client().scanDeals({ entity: "LEAD", pageSize: 1, maxPages: 1 });
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.coverage).toMatchObject({
      status: "partial", reason: "inconsistent_total", pagesFetched: 1, recordsFetched: 1, nextOffset: 1
    });
  });

  it("preserves all received records when a later total falls below the consumed offset", async () => {
    globalThis.fetch = async url => Number(new URL(String(url)).searchParams.get("offset")) === 0
      ? Response.json({ data: [{ id: 1 }], total: 3 }) : Response.json({ data: [{ id: 2 }], total: 1 });
    const result = await client().scanDeals({ entity: "OPPORTUNITY", pageSize: 1, maxPages: 3 });
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.coverage).toMatchObject({ status: "partial", reason: "inconsistent_total", nextOffset: 2 });
  });

  it("does not reuse a previous total as proof when a later page exceeds it without a total", async () => {
    globalThis.fetch = async url => Number(new URL(String(url)).searchParams.get("offset")) === 0
      ? Response.json({ data: [{ id: 1 }], total: 2 }) : Response.json({ data: [{ id: 2 }, { id: 3 }] });
    const result = await client().scanDeals({ entity: "LEAD", pageSize: 2, maxPages: 3 });
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(result.coverage).toMatchObject({ status: "partial", reason: "inconsistent_total", nextOffset: 3 });
  });
});

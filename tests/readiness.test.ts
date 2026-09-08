import { afterEach, describe, expect, it, vi } from "vitest";
import { Leads2bHttpClient } from "../src/client/http.js";
import { listRecentOpportunitiesFromDeals } from "../src/lead-ops/records.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.useRealTimers(); });

function http(options: Record<string, unknown> = {}) {
  return new Leads2bHttpClient({ api: "v2", baseUrl: "https://example.com/api/v2", token: "<TOKEN>", ...options });
}

describe("bounded HTTP reads", () => {
  it("recovers from a transient GET failure without retrying a write", async () => {
    let reads = 0;
    let writes = 0;
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "GET") return ++reads === 1
        ? new Response("busy", { status: 503 }) : Response.json({ data: [{ id: 1 }] });
      writes++;
      return new Response("busy", { status: 503 });
    };
    const client = http({ retryDelayMs: 1 });
    await expect(client.get("/deals")).resolves.toEqual({ data: [{ id: 1 }] });
    await expect(client.post("/customer", { body: { name: "Example" } })).rejects.toMatchObject({ status: 503 });
    expect(reads).toBe(2);
    expect(writes).toBe(1);
  });

  it("stops a stalled request at the configured timeout", async () => {
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });
    await expect(http({ timeoutMs: 20, maxReadRetries: 0 }).get("/deals")).rejects.toMatchObject({ code: "LEADS2B_TIMEOUT" });
  }, 250);

  it("respects Retry-After and does not retry permission errors", async () => {
    vi.useFakeTimers();
    let count = 0;
    globalThis.fetch = async () => ++count === 1
      ? new Response("limited", { status: 429, headers: { "Retry-After": "2" } })
      : Response.json({ data: [] });
    const promise = http().get("/deals");
    void promise.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1999);
    expect(count).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ data: [] });
    let denied = 0;
    globalThis.fetch = async () => { denied++; return new Response("denied", { status: 401 }); };
    await expect(http().get("/deals")).rejects.toMatchObject({ status: 401 });
    expect(denied).toBe(1);
  });
});

describe("portable creation-date filters", () => {
  it("does not extend an explicit end timestamp by another day", () => {
    const data = listRecentOpportunitiesFromDeals({
      response: { data: [{ id: 1, created_at: "2026-09-08T14:00:00Z" }, { id: 2, created_at: "2026-09-08T16:00:00Z" }] },
      filters: { createdTo: "2026-09-08T12:00:00-03:00" }
    });
    expect(data.opportunities.map(x => x.leads2bId)).toEqual(["1"]);
  });

  it("uses the observed UTC-03 offset for naive API timestamps regardless of host timezone", () => {
    const oldTZ = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const data = listRecentOpportunitiesFromDeals({
        response: { data: [{ id: 1, created_at: "2026-09-07 23:59:59" }, { id: 2, created_at: "2026-09-08 00:00:00" }] },
        filters: { createdFrom: "2026-09-08T00:00:00-03:00" }
      });
      expect(data.opportunities.map(x => x.leads2bId)).toEqual(["2"]);
    } finally { if (oldTZ === undefined) delete process.env.TZ; else process.env.TZ = oldTZ; }
  });
});

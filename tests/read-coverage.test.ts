import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { registerReadTools } from "../src/tools/read.js";

const originalFetch = globalThis.fetch;
let client: Client;
let server: McpServer;
afterEach(async () => {
  await client?.close();
  await server?.close();
  globalThis.fetch = originalFetch;
});

async function connect() {
  server = new McpServer({ name: "read-coverage-test", version: "1.0.0" });
  const http = (api: "v1" | "v2") => new Leads2bHttpClient({
    api, baseUrl: `https://example.com/api/${api}`, token: "<TOKEN>", maxReadRetries: 0
  });
  registerReadTools(server, { v1: new Leads2bV1Client(http("v1")), v2: new Leads2bV2Client(http("v2")) });
  client = new Client({ name: "read-coverage-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
}

function deals(count: number, deniedEntity?: string) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: index + 1, name: "Example", created_at: new Date(Date.UTC(2025, 0, index + 1)).toISOString()
  }));
  globalThis.fetch = async url => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/api/v1/customer/index") return Response.json({ data: { customers: [] } });
    if (parsed.pathname !== "/api/v2/deals") throw new Error("Unexpected endpoint");
    if (parsed.searchParams.get("entity") === deniedEntity) return Response.json({ error: "Forbidden" }, { status: 403 });
    // The API may ignore search and return the collection in ascending order.
    const offset = Number(parsed.searchParams.get("offset"));
    const limit = Number(parsed.searchParams.get("limit"));
    return Response.json({ data: rows.slice(offset, offset + limit), total: count });
  };
}

async function call(name: string, args: Record<string, unknown>) {
  return client.callTool({ name, arguments: args });
}

describe("bounded record search coverage", () => {
  it("finds an ID beyond the first page when upstream search is ignored", async () => {
    deals(250); await connect();
    const result = await call("leads2b_find_records", { search: "250", entities: ["OPPORTUNITY"] });
    expect(result.structuredContent).toMatchObject({ ok: true, data: {
      records: [{ leads2bId: "250" }], totalScanned: 250, matchedTotal: 1,
      coverage: { status: "complete", sources: [{ entity: "OPPORTUNITY", status: "complete", pagesFetched: 3 }] }
    } });
  });

  it("orders recent opportunities after scanning later pages", async () => {
    deals(250); await connect();
    const result = await call("leads2b_list_recent_opportunities", { limit: 1 });
    expect(result.structuredContent).toMatchObject({ data: {
      opportunities: [{ leads2bId: "250" }], matchedTotal: 250,
      coverage: { status: "complete", recordsFetched: 250, pagesFetched: 3 }
    } });
  });

  it("reports a partial zero match when an explicit page budget excludes the ID", async () => {
    deals(250); await connect();
    const result = await call("leads2b_find_records", { search: "250", entities: ["OPPORTUNITY"], maxPages: 1 });
    expect(result.structuredContent).toMatchObject({ data: {
      records: [], matchedTotal: 0, totalScanned: 100,
      coverage: { status: "partial", sources: [{ entity: "OPPORTUNITY", reason: "page_limit", nextOffset: 100 }] }
    } });
    expect((result.content as Array<{ text: string }>)[0].text).toContain("partial");
  });

  it("stops at the default page budget and reports the remaining collection", async () => {
    deals(101); await connect();
    const result = await call("leads2b_list_recent_opportunities", { fetchLimit: 5, search: "101" });
    expect(result.structuredContent).toMatchObject({ data: {
      opportunities: [], matchedTotal: 0,
      coverage: { status: "partial", reason: "page_limit", pagesFetched: 20, recordsFetched: 100, nextOffset: 100 }
    } });
    expect((result.content as Array<{ text: string }>)[0].text).toContain("partial");
  });

  it("preserves successful sources while exposing a failed source", async () => {
    deals(2, "LEAD"); await connect();
    const result = await call("leads2b_find_records", { search: "Example", entities: ["LEAD", "OPPORTUNITY"] });
    expect(result.structuredContent).toMatchObject({ data: {
      matchedTotal: 2, coverage: { status: "partial", sources: [
        { entity: "LEAD", status: "partial", reason: "source_failed" },
        { entity: "OPPORTUNITY", status: "complete" }
      ] }
    } });
  });

  it("does not claim complete coverage for unverified customers or unsupported contacts", async () => {
    deals(0); await connect();
    const customers = await call("leads2b_find_records", { search: "Example", entities: ["CUSTOMER"] });
    expect(customers.structuredContent).toMatchObject({ data: { coverage: { status: "unknown", sources: [
      { entity: "CUSTOMER", status: "unknown", reason: "native_pagination_unverified" }
    ] } } });
    const contacts = await call("leads2b_find_records", { search: "Example", entities: ["CONTACT"] });
    expect(contacts.structuredContent).toMatchObject({ data: { coverage: { status: "partial", sources: [
      { entity: "CONTACT", status: "partial", reason: "unsupported_entity" }
    ] } } });
  });

  it.each([{ data: { unexpected: [] } }, { data: { customers: [null] } }])(
    "exposes an invalid customer envelope while preserving deals: %j", async response => {
      deals(2);
      const fetchDeals = globalThis.fetch;
      globalThis.fetch = async (url, init) => String(url).includes("/api/v1/customer/index")
        ? Response.json(response) : fetchDeals(url, init);
      await connect();
      const result = await call("leads2b_find_records", { search: "Example", entities: ["CUSTOMER", "OPPORTUNITY"] });
      expect(result.structuredContent).toMatchObject({ ok: true, data: {
        matchedTotal: 2, coverage: { status: "partial", sources: [
          { entity: "CUSTOMER", status: "partial", reason: "source_failed" },
          { entity: "OPPORTUNITY", status: "complete" }
        ] }
      } });
    }
  );
});

describe("read-only history pages", () => {
  it("requests the chosen page and preserves an unfamiliar envelope without claiming completeness", async () => {
    const requests: Array<{ method?: string; url: string }> = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ method: init?.method, url: String(url) });
      return Response.json({ data: { entries: [{ id: 91, message: "Example", custom: { zero: 0, enabled: false } }] }, extra: "kept" });
    };
    await connect();
    const result = await call("leads2b_list_history", { entity: "OPPORTUNITY", id: "123", limit: 10, offset: 20 });
    expect(requests).toEqual([{ method: "GET", url: "https://example.com/api/v1/history/index/?entity=OPPORTUNITY&id_entity=123&limit=10&offset=20" }]);
    expect(result.structuredContent).toMatchObject({ ok: true, data: {
      response: { data: { entries: [{ id: 91, message: "Example", custom: { zero: 0, enabled: false } }] }, extra: "kept" },
      coverage: { status: "unknown", reason: "native_pagination_unverified", requested: { limit: 10, offset: 20 } }
    }, source: { api: "v1", endpoint: "/history/index/", stability: "observed" } });
  });

  it("requests the first page by default without requiring a logged user", async () => {
    const requests: string[] = [];
    globalThis.fetch = async url => { requests.push(String(url)); return Response.json({ data: [] }); };
    await connect();
    const result = await call("leads2b_list_history", { entity: "LEAD", id: 123 });
    expect(result.structuredContent).toMatchObject({ ok: true, data: { response: { data: [] } } });
    expect(requests).toEqual(["https://example.com/api/v1/history/index/?entity=LEAD&id_entity=123&limit=25&offset=0"]);
  });

  it("returns a server failure without turning it into an empty history", async () => {
    globalThis.fetch = async () => Response.json({ message: "Failure" }, { status: 500 });
    await connect();
    const result = await call("leads2b_list_history", { entity: "LEAD", id: 123 });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: { status: 500, endpoint: "/history/index/" } });
  });
});

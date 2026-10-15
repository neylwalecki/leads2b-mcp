import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { registerReadTools } from "../src/tools/read.js";
import errors from "./fixtures/read-errors.example.json" with { type: "json" };
import page from "./fixtures/history-page.example.json" with { type: "json" };

const originalFetch = globalThis.fetch;
let client: Client;
let server: McpServer;
afterEach(async () => {
  await client?.close();
  await server?.close();
  globalThis.fetch = originalFetch;
});

async function connect() {
  server = new McpServer({ name: "read-failures-test", version: "1.0.0" });
  const http = (api: "v1" | "v2") => new Leads2bHttpClient({
    api, baseUrl: `https://example.com/api/${api}`, token: `<TOKEN_${api}>`, maxReadRetries: 0
  });
  registerReadTools(server, { v1: new Leads2bV1Client(http("v1")), v2: new Leads2bV2Client(http("v2")) });
  client = new Client({ name: "read-failures-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
}

// Dropping failure context, swallowing an HTTP error, switching tokens or retrying
// another entity must break these tests. Only fetch is replaced; MCP and clients run.
describe("commercial read failures", () => {
  it.each([
    { tool: "leads2b_list_history", args: { entity: "OPPORTUNITY", id: "123", limit: 5, offset: 10 }, status: 400, body: errors.history, endpoint: "/history/index/", request: { entity: "OPPORTUNITY", id: "123", limit: 5, offset: 10 } },
    { tool: "leads2b_get_opportunity", args: { id: 123 }, status: 500, body: errors.detail, endpoint: "/opportunity/index/123", request: { entity: "OPPORTUNITY", id: 123 } },
    { tool: "leads2b_get_record_detail", args: { entity: "OPPORTUNITY", id: 123 }, status: 500, body: errors.detail, endpoint: "/opportunity/index/123", request: { entity: "OPPORTUNITY", id: 123 } }
  ])("preserves $tool errors with unavailable coverage and the original request", async ({ tool, args, status, body, endpoint, request }) => {
    const requests: Array<{ url: string; method?: string; authorization: string | null }> = [];
    globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), method: init?.method, authorization: new Headers(init?.headers).get("Authorization") });
      return Response.json(body, { status });
    };
    await connect();
    const result = await client.callTool({ name: tool, arguments: args });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: { status, code: "LEADS2B_HTTP_ERROR", endpoint, details: body },
      readState: {
        outcome: "unavailable", request: { api: "v1", method: "GET", endpoint, ...request },
        coverage: { status: "unknown", reason: "request_failed" }, userContext: "unverified"
      }
    });
    expect(result.structuredContent).not.toHaveProperty("data");
    expect(JSON.stringify(result.content)).toContain("leads2b_health_check");
    expect(result.structuredContent).toHaveProperty("warnings", expect.any(Array));
    expect(JSON.stringify(result)).not.toContain("<TOKEN");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "GET", authorization: "Bearer <TOKEN_v1>" });
    expect(new URL(requests[0].url).pathname).toBe(`/api/v1${endpoint}`);
    if (tool === "leads2b_list_history") {
      expect(new URL(requests[0].url).search).toBe("?entity=OPPORTUNITY&id_entity=123&limit=5&offset=10");
    }
  });

  it("does not diagnose a confirmed missing user or erase access errors from HTTP status alone", async () => {
    globalThis.fetch = async () => Response.json({ message: "Forbidden" }, { status: 403 });
    await connect();
    const result = await client.callTool({ name: "leads2b_list_history", arguments: { entity: "LEAD", id: 123 } });
    expect(result.structuredContent).toMatchObject({
      ok: false, error: { status: 403, details: { message: "Forbidden" } },
      readState: { request: { entity: "LEAD", id: 123, limit: 25, offset: 0 }, userContext: "unverified" }
    });
    expect(result.structuredContent).not.toHaveProperty("data");
  });
});

// A repeated, unordered, overlong or empty page is evidence only of that response.
// Silently deduplicating/sorting it or declaring completeness must fail here.
it.each([page, [page[0], page[0]], [...page].reverse(), []].map(response => ({ response })))("preserves the history page without inferring order, uniqueness or completeness (%#)", async ({ response }) => {
  globalThis.fetch = async () => Response.json(response);
  await connect();
  const result = await client.callTool({ name: "leads2b_list_history", arguments: { entity: "OPPORTUNITY", id: 123, limit: 1, offset: 0 } });
  expect(result.isError).toBeUndefined();
  expect(result.structuredContent).toMatchObject({ data: { response, coverage: { status: "unknown", reason: "native_pagination_unverified", requested: { limit: 1, offset: 0 } } } });
  expect(result.structuredContent).not.toHaveProperty("data.coverage.nextOffset");
  expect(result.structuredContent).not.toHaveProperty("readState");
});

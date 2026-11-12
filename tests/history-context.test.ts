import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { registerHistoryTools } from "../src/tools/read/history.js";
import fixtures from "./fixtures/history-effects.example.json" with { type: "json" };

const originalFetch = globalThis.fetch;
let client: Client;
let server: McpServer;
afterEach(async () => { await client?.close(); await server?.close(); globalThis.fetch = originalFetch; });
async function setup(token = "<TOKEN>") {
  server = new McpServer({ name: "history-context-test", version: "1.0.0" });
  const http = new Leads2bHttpClient({ api: "v1", baseUrl: "https://example.com/api/v1", token, maxReadRetries: 0 });
  registerHistoryTools(server, { v1: new Leads2bV1Client(http), v2: {} as Leads2bV2Client });
  client = new Client({ name: "history-context-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
}
it.each(["comment", "action", "tracking"])("preserves history while sending %s and boolean filters including false", async type => {
  const urls: string[] = [];
  globalThis.fetch = async (url, init) => { expect(init?.method).toBe("GET"); urls.push(String(url)); return Response.json([fixtures.note]); };
  await setup();
  const result = await client.callTool({ name: "leads2b_list_history", arguments: { entity: "OPPORTUNITY", id: 123, type, unfinished: true, pinned: false, limit: 5, offset: 10 } });
  expect(new URL(urls[0]).searchParams.toString()).toBe(`entity=OPPORTUNITY&id_entity=123&limit=5&offset=10&type=${type}&unfinished=true&pinned=false`);
  expect(result.structuredContent).toMatchObject({ data: { response: [fixtures.note], coverage: { status: "unknown", requested: { limit: 5, offset: 10 } } } });
});
it.each([[], [fixtures.activity]].map(activities => ({ activities })))("returns planned activities intact, without treating the scope as complete (%#)", async ({ activities }) => {
  const response = { data: { activities }, custom: false };
  globalThis.fetch = async (url, init) => {
    expect(String(url)).toBe("https://example.com/api/v1/history/activities/?entity=OPPORTUNITY&id_entity=123");
    expect(init?.method).toBe("GET"); return Response.json(response);
  };
  await setup(); const result = await client.callTool({ name: "leads2b_list_activities", arguments: { entity: "OPPORTUNITY", id: 123 } });
  expect(result.structuredContent).toMatchObject({ data: { response, coverage: { status: "unknown" } }, source: { stability: "experimental" } });
});
it("scopes active responsible users to the pipeline", async () => {
  globalThis.fetch = async url => { expect(String(url)).toBe("https://example.com/api/v1/pipeline/responsible_users/321/active"); return Response.json({ data: [{ id: 7 }] }); };
  await setup(); expect((await client.callTool({ name: "leads2b_list_pipeline_responsible_users", arguments: { pipelineId: 321 } })).structuredContent).toMatchObject({ data: { data: [{ id: 7 }] } });
});
it.each(["leads2b_list_history", "leads2b_list_activities"])("preserves 403 and request scope for %s", async name => {
  globalThis.fetch = async () => Response.json({ message: "Forbidden" }, { status: 403 }); await setup();
  const result = await client.callTool({ name, arguments: { entity: "OPPORTUNITY", id: 123 } });
  expect(result.structuredContent).toMatchObject({ ok: false, error: { status: 403 }, readState: { outcome: "unavailable", request: { entity: "OPPORTUNITY", id: 123 } } });
});
it("fails locally without credentials and rejects invalid scope before I/O", async () => {
  globalThis.fetch = vi.fn(); await setup("");
  for (const args of [{ entity: "OPPORTUNITY", id: 123 }, { entity: "CUSTOMER", id: 123 }, { entity: "OPPORTUNITY", id: "../123" }]) {
    expect((await client.callTool({ name: "leads2b_list_activities", arguments: args })).isError).toBe(true);
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

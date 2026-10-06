import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../src/config.js";
import { registerHealthTool } from "../src/tools/health.js";
import { Leads2bHttpError } from "../src/client/http.js";
import { DEAL_ACTION_TOOL_NAMES } from "../src/tools/deal-actions.js";
import { WRITE_TOOL_NAMES } from "../src/tools/write.js";

async function health(mode: "disabled" | "preview" | "live", user = false, denied = false, configured = true) {
  let call!: (input: any) => Promise<any>;
  const config = loadConfig({ LEADS2B_API_V1_TOKEN: configured ? "<TOKEN>" : "", LEADS2B_API_V2_TOKEN: configured ? "<TOKEN>" : "", LEADS2B_WRITE_MODE: mode });
  const v1 = { hasToken: () => configured, getLoggedUser: vi.fn().mockResolvedValue({ data: { user: user ? { id: 7 } : [] } }) };
  const v2 = { hasToken: () => configured, listUsers: vi.fn().mockImplementation(async () => { if (denied) throw new Leads2bHttpError({ endpoint: "/users", status: 403, message: "HTTP 403" }); return { data: [] }; }) };
  registerHealthTool({ registerTool: (_name: string, _config: any, handler: any) => { call = handler; } } as unknown as McpServer, { config, v1, v2 } as never);
  return (await call({})).structuredContent.data;
}

describe("health evidence scope", () => {
  it("keeps registered v2 and cross tools visible after a single endpoint 403", async () => {
    const data = await health("disabled", false, true);
    expect(data.availableTools).toContain("leads2b_search_customers");
    expect(data.registeredTools).toContain("leads2b_find_records");
    expect(data.apis.v2).toMatchObject({ endpoint: "/users", method: "GET", ok: false, status: 403, scope: "tested_endpoint_only" });
    expect(data.verifiedCapabilities).toEqual([{ api: "v1", method: "GET", endpoint: "/user/logged/" }]);
  });
  it("previews every registered write even without tokens or a user", async () => {
    const data = await health("preview", false, false, false);
    expect(data.writeTools.availableTools).toEqual([...WRITE_TOOL_NAMES, ...DEAL_ACTION_TOOL_NAMES]);
    expect(data.writeTools.previewTools).toEqual([...WRITE_TOOL_NAMES, ...DEAL_ACTION_TOOL_NAMES]);
    expect(data.writeTools.livePrerequisitesMetTools).toEqual([]);
  });
  it("does not call live prerequisites verified write permissions", async () => {
    const data = await health("live");
    expect(data.registeredTools).toContain("leads2b_update_opportunity");
    expect(data.writeTools.availableTools).not.toContain("leads2b_update_opportunity");
    expect(data.writeTools.livePrerequisitesMetTools).toContain("leads2b_update_customer");
    expect(data.writeTools.verifiedExecutionTools).toEqual([]);
  });
});

it("reports exactly the catalog actually registered for each mode", async () => {
  const { registerReadTools } = await import("../src/tools/read.js");
  const { registerAttributionTools } = await import("../src/tools/attribution.js");
  const { registerWriteTools } = await import("../src/tools/write.js");
  const { registerDealActionTools } = await import("../src/tools/deal-actions.js");
  for (const mode of ["disabled", "preview", "live"] as const) {
    const names: string[] = [];
    const server = { registerTool: (name: string) => names.push(name) } as unknown as McpServer;
    const deps = { v1: {}, v2: {} } as never;
    registerReadTools(server, deps); registerAttributionTools(server, deps);
    registerWriteTools(server, { v1: {} as never, writeMode: mode });
    registerDealActionTools(server, { v1: {} as never, writeMode: mode });
    expect((await health(mode)).registeredTools.slice().sort()).toEqual(["leads2b_health_check", ...names].sort());
  }
});

it("scopes the optional snippet observation to GET /latest", async () => {
  const originalFetch = globalThis.fetch;
  let call!: (input: any) => Promise<any>;
  globalThis.fetch = async () => new Response("Example", { status: 200 });
  try {
    registerHealthTool({ registerTool: (_name: string, _config: any, handler: any) => { call = handler; } } as unknown as McpServer, {
      config: loadConfig({}), v1: { hasToken: () => false }, v2: { hasToken: () => false }
    } as never);
    const data = (await call({ includeSnippet: true })).structuredContent.data;
    expect(data.apis.snippet).toMatchObject({ endpoint: "/latest", method: "GET", scope: "tested_endpoint_only", ok: true });
  } finally { globalThis.fetch = originalFetch; }
});

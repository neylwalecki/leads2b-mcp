import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../src/config.js";
import { registerHealthTool } from "../src/tools/health.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { DEAL_ACTION_TOOL_NAMES } from "../src/tools/deal-actions.js";
import { CHAT_ACTION_TOOL_NAMES, registerChatActionTools } from "../src/tools/chat-actions.js";
import { WRITE_TOOL_NAMES } from "../src/tools/write.js";

const directoryDenied = { message: "access denied", code: 403, type: "PERMISSION_DENIED", data: { scope: "coupon:read" } };
const chatDenied = { message: "access denied", code: 403 };

async function health(mode: "disabled" | "preview" | "live", {
  user = false, denyDirectory = false, denyChat = false, configured = true
} = {}) {
  let call!: (input: any) => Promise<any>;
  const config = loadConfig({ LEADS2B_API_V1_TOKEN: configured ? "<TOKEN>" : "", LEADS2B_API_V2_TOKEN: configured ? "<TOKEN>" : "", LEADS2B_WRITE_MODE: mode });
  const v1 = { hasToken: () => configured, getLoggedUser: vi.fn().mockResolvedValue({ data: { user: user ? { id: 7 } : [] } }) };
  const v2 = new Leads2bV2Client(new Leads2bHttpClient({ api: "v2", baseUrl: "https://example.com/api/v2", token: config.apiV2Token }));
  const originalFetch = globalThis.fetch;
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(init?.method).toBe("GET");
    if (url.pathname === "/api/v2/users") {
      return denyDirectory ? Response.json(directoryDenied, { status: 403 }) : Response.json({ data: [] });
    }
    expect(url.pathname).toBe("/api/v2/messages/chats/users");
    expect(url.searchParams.get("situation")).toBe("open");
    expect(url.searchParams.get("order")).toBe("desc");
    return denyChat ? Response.json(chatDenied, { status: 403 }) : Response.json({ users: [{ id_user: 7 }] });
  });
  globalThis.fetch = fetch;
  try {
    registerHealthTool({ registerTool: (_name: string, _config: any, handler: any) => { call = handler; } } as unknown as McpServer, { config, v1, v2 } as never);
    const data = (await call({})).structuredContent.data;
    expect(fetch).toHaveBeenCalledTimes(configured ? 2 : 0);
    return data;
  } finally { globalThis.fetch = originalFetch; }
}

describe("health evidence scope", () => {
  it("keeps registered v2 and cross tools visible after a single endpoint 403", async () => {
    const data = await health("disabled", { denyDirectory: true });
    expect(data.availableTools).toContain("leads2b_search_customers");
    expect(data.registeredTools).toContain("leads2b_find_records");
    expect(data.apis.v2).toMatchObject({ endpoint: "/users", method: "GET", ok: false, status: 403, scope: "tested_endpoint_only" });
    expect(data.verifiedCapabilities).toEqual([
      { api: "v1", method: "GET", endpoint: "/user/logged/" },
      { api: "v2", method: "GET", endpoint: "/messages/chats/users" }
    ]);
  });
  it("keeps the directory 403 intact while using the successful chat probe for live prerequisites", async () => {
    const data = await health("live", { user: true, denyDirectory: true });
    expect(data.apis.v2).toMatchObject({ endpoint: "/users", ok: false, status: 403, responded: true, error: {
      endpoint: "/users", status: 403, code: "LEADS2B_HTTP_ERROR", details: directoryDenied
    } });
    expect(data.apis.v2Chat).toMatchObject({ endpoint: "/messages/chats/users", ok: true, responded: true, scope: "tested_endpoint_only" });
    expect(data.apis.v2Chat.error).toBeUndefined();
    expect(data.writeTools.livePrerequisitesMetTools).toEqual(expect.arrayContaining([...CHAT_ACTION_TOOL_NAMES]));
    expect(data.writeTools.verifiedExecutionTools).toEqual([]);
  });
  it("keeps the chat 403 intact when the directory works and omits chat write prerequisites", async () => {
    const data = await health("live", { user: true, denyChat: true });
    expect(data.apis.v2.ok).toBe(true);
    expect(data.apis.v2Chat).toMatchObject({ endpoint: "/messages/chats/users", ok: false, status: 403, error: {
      endpoint: "/messages/chats/users", status: 403, details: chatDenied
    } });
    expect(data.verifiedCapabilities).toContainEqual({ api: "v2", method: "GET", endpoint: "/users" });
    for (const name of CHAT_ACTION_TOOL_NAMES) {
      expect(data.writeTools.registeredTools).toContain(name);
      expect(data.writeTools.livePrerequisitesMetTools).not.toContain(name);
    }
  });
  it("previews every registered write even without tokens or a user", async () => {
    const data = await health("preview", { configured: false });
    expect(data.writeTools.availableTools).toEqual([...WRITE_TOOL_NAMES, ...DEAL_ACTION_TOOL_NAMES, ...CHAT_ACTION_TOOL_NAMES]);
    expect(data.writeTools.previewTools).toEqual([...WRITE_TOOL_NAMES, ...DEAL_ACTION_TOOL_NAMES, ...CHAT_ACTION_TOOL_NAMES]);
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
    registerChatActionTools(server, { v2: {} as never, writeMode: mode });
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

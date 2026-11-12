import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { registerReadTools } from "../src/tools/read.js";

const response = { data: [{ id: 123, detail: { arbitrary: false } }], total: 1 };
const fetchMock = vi.fn<typeof fetch>();
let client: Client;
let server: McpServer;

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json(response));
  vi.stubGlobal("fetch", fetchMock);
  server = new McpServer({ name: "operational-reads-test", version: "1.0.0" });
  const http = (api: "v1" | "v2") => new Leads2bHttpClient({
    api, baseUrl: `https://example.com/api/${api}`, token: "<TOKEN>", maxReadRetries: 2, retryDelayMs: 0
  });
  registerReadTools(server, { v1: new Leads2bV1Client(http("v1")), v2: new Leads2bV2Client(http("v2")) });
  client = new Client({ name: "operational-reads-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
});

afterEach(async () => {
  await client?.close();
  await server?.close();
  vi.unstubAllGlobals();
});

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name: `leads2b_${name}`, arguments: args });
type Case = { name: string; path: string; args?: Record<string, unknown>; page?: boolean };

async function expectGet({ name, path, args, page }: Case) {
  const result = await call(name, args);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`https://example.com/api${path}`, expect.objectContaining({ method: "GET" }));
  expect(result.structuredContent).toMatchObject({
    ok: true,
    data: page ? { response, coverage: { status: "unknown" } } : response
  });
}

describe("P1 operational reads", () => {
  it.each<Case>([
    { name: "list_history_users", path: "/v1/history/history_users/" },
    { name: "list_stage_activities", args: { id: 123, entity: "OPPORTUNITY", stageId: 45 }, path: "/v1/history/history_pipeline_item/?entity=OPPORTUNITY&id_entity=123&id_pipeline_item=45" },
    { name: "get_chat_inbox_counts", path: "/v2/messages/chats/count" },
    { name: "list_inbox_chats", args: { situation: "closed", limit: 5 }, path: "/v2/messages/chats?situation=closed&order=desc&limit=5&offset=0", page: true },
    { name: "list_scheduled_activities", args: { page: 2, pageSize: 5, todo: true, responsible: [7, "8"], date: { start: "2026-01-02", end: "2026-01-03" } },
      path: "/v1/schedule/index/?pagination%5Bpage%5D=2&pagination%5BperPage%5D=5&todo=true&responsible%5B0%5D=7&responsible%5B1%5D=8&date%5BstartDate%5D=2026-01-02+00%3A00%3A00&date%5BendDate%5D=2026-01-03+23%3A59%3A59", page: true },
    { name: "count_scheduled_activities", args: { todo: true }, path: "/v1/schedule/count/?todo=true" },
    { name: "list_deal_contacts", args: { entity: "OPPORTUNITY", id: 123 }, path: "/v1/deal/contacts?id=123&type=opportunity" },
    { name: "get_opportunity_card_info", args: { id: 123 }, path: "/v1/deal/cards_info_v2/123/OPPORTUNITY" },
    { name: "list_opportunity_field_definitions", args: { id: 123 }, path: "/v1/custom_column/entity_columns/OPPORTUNITY/123" },
    { name: "list_accessible_pipelines", path: "/v1/pipeline/accessible" },
    { name: "list_kanban_columns", args: { pipelineId: 32 }, path: "/v1/pipeline/kanbanColumns/32" },
    { name: "list_kanban_cards", args: { pipelineId: 32 }, path: "/v1/pipeline/kanbanData/32?page=1&limitPage=25", page: true },
    { name: "list_customer_directory", args: { type: "ORGANIZATION", limit: 5, offset: 10 }, path: "/v2/customer/organizations?limit=5&offset=10", page: true },
    { name: "list_customer_directory", args: { type: "PERSON" }, path: "/v2/customer/persons?limit=25&offset=0", page: true },
    { name: "list_team_users", args: { includeInactives: false }, path: "/v1/user/all?include_inactives=false" }
  ])("routes $name to $path and keeps the response", expectGet);

  it("keeps authorization links out of channel diagnostics and errors", async () => {
    const privateLink = "https://example.com/authorization";
    fetchMock.mockResolvedValueOnce(Response.json({ data: {
      id_channel: 1, status: "active", authentication_link: privateLink,
      status_detail: { status: "ready", authentication_link: privateLink }
    } }));
    const activation = await call("get_chat_channel_activation_status");
    expect(activation.structuredContent).toMatchObject({ data: { activation: { id_channel: 1, status: "active", status_detail: "ready" } } });
    expect(JSON.stringify(activation)).not.toContain(privateLink);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/api/v2/messages/channels/activations/status");

    fetchMock.mockResolvedValueOnce(Response.json({ channels: [{ id: 1, type: "whatsapp", parameters: { authentication_link: privateLink } }] }));
    const channels = await call("list_user_chat_channels");
    expect(channels.structuredContent).toMatchObject({ data: { channels: [{ id: 1, type: "whatsapp" }] } });
    expect(JSON.stringify(channels)).not.toContain(privateLink);
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.com/api/v2/messages/channels/user");

    fetchMock.mockResolvedValueOnce(Response.json({ authentication_link: privateLink }, { status: 403 }));
    const failure = await call("get_chat_channel_activation_status");
    expect(failure.structuredContent).toMatchObject({ error: { status: 403 } });
    expect(JSON.stringify(failure)).not.toContain(privateLink);
  });

  it("rejects invalid scope and reversed dates before HTTP", async () => {
    expect((await call("list_stage_activities", { id: 123, entity: "CUSTOMER", stageId: 5 })).isError).toBe(true);
    expect((await call("list_scheduled_activities", { date: { start: "2026-01-03", end: "2026-01-02" } })).isError).toBe(true);
    expect((await call("list_kanban_cards", { pipelineId: "../wrong" })).isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("P2 journeys and agents", () => {
  it.each<Case>([
    { name: "list_workflows", path: "/v2/workflow", page: true },
    { name: "count_active_workflows", path: "/v2/workflow/activeCount" },
    { name: "list_deal_workflow_instances", args: { id: 123, entity: "OPPORTUNITY" }, path: "/v1/deal/workflow_instances?id=123&type=opportunity" },
    { name: "get_opportunity_journey_cards", args: { id: 123 }, path: "/v2/deals/journey-cards/OPPORTUNITY/123" },
    { name: "list_agents", path: "/v2/agents", page: true },
    { name: "get_opportunity_insights", args: { id: 123 }, path: "/v2/smarts/entities/opportunity/123" },
    { name: "get_pipeline_insights", args: { pipelineId: 45 }, path: "/v2/smarts/pipelines/45/insights" }
  ])("routes $name to $path", expectGet);
});

describe("P3 catalogs and query-only POSTs", () => {
  it.each<Case>([
    { name: "count_forms", path: "/v1/form/count/" },
    { name: "count_landing_pages", path: "/v1/websites/count" },
    { name: "search_landing_pages", args: { search: "Example", limit: 5, offset: 10 }, path: "/v1/websites/search/?draw=1&start=10&length=5&search%5Bvalue%5D=Example&search%5Bregex%5D=false&oldVersion=false", page: true },
    { name: "get_landing_page", args: { id: 123 }, path: "/v1/websites/index?id=123" },
    { name: "list_mailboxes", path: "/v2/mail/mailboxes" },
    { name: "count_market_companies", path: "/v2/markets/companies/count" },
    { name: "list_panels", path: "/v2/panels" },
    { name: "list_panel_widgets", args: { id: 123 }, path: "/v2/panels/123/widgets" },
    { name: "list_report_tabs", path: "/v1/report_tab/list" },
    { name: "list_reports", args: { tabId: "45" }, path: "/v1/report/list/report?tab=45" },
    { name: "list_opportunity_files", args: { id: 123 }, path: "/v1/opportunity/uploaded_files/123" },
    { name: "list_opportunity_quotations", args: { id: 123 }, path: "/v1/opportunity/quotation/123/QUOTATION?loadItems=false" },
    { name: "list_opportunity_quotations", args: { id: 123, loadItems: true }, path: "/v1/opportunity/quotation/123/QUOTATION?loadItems=true" },
    { name: "list_pipelines_by_entity", args: { entity: "AFTER_SALE" }, path: "/v1/pipeline/byEntity/AFTER_SALE" },
    { name: "list_segmentations", args: { entity: "COMPANIES" }, path: "/v2/segmentations?entity=COMPANIES&limit=20&offset=0" }
  ])("routes $name to $path", expectGet);

  it.each([
    { name: "list_lead_inbox", path: "/deals/lead-inbox", args: { limit: 5, offset: 10, search: "Example" }, body: { limit: 5, offset: 10, search: "Example" } },
    { name: "search_market_lists", path: "/markets/lists/search", args: { search: "Example" }, body: {
      limit: 25, offset: 0, filter: { search: "Example", entity: null, users: [] }, sort: { column: null, value: null }
    } }
  ])("exposes $name as a fixed read-only query without retrying HTTP POST", async ({ name, path, args, body }) => {
    const { tools } = await client.listTools();
    expect(tools.find(tool => tool.name === `leads2b_${name}`)?.annotations?.readOnlyHint).toBe(true);
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Unavailable" }, { status: 503 }));
    const failure = await call(name, args);
    expect(failure.structuredContent).toMatchObject({ error: { status: 503 } });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`https://example.com/api/v2${path}`, expect.objectContaining({
      method: "POST", body: JSON.stringify(body)
    }));
    fetchMock.mockClear();
    expect((await call(name, { ...args, path: "/messages/upload", body: { unsafe: true } })).isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await call(name, args)).structuredContent).toMatchObject({ data: { response, coverage: { status: "unknown" } } });
  });

  it("exposes only presence of voice details", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { token: "synthetic-voice-credential" } }));
    const result = await call("get_voice_details_status");
    expect(result.structuredContent).toMatchObject({ data: { detailsReturned: true } });
    expect(JSON.stringify(result)).not.toContain("synthetic-voice-credential");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://example.com/api/v1/voice/details", expect.objectContaining({ method: "GET" }));
  });
});

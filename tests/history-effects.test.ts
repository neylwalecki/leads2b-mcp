import { afterEach, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { registerDealActionTools } from "../src/tools/deal-actions.js";
import fixtures from "./fixtures/history-effects.example.json" with { type: "json" };

const fetchBefore = globalThis.fetch;
let server: McpServer;
let client: Client;
afterEach(async () => { await client?.close(); await server?.close(); globalThis.fetch = fetchBefore; });

async function setup(mode: "disabled" | "preview" | "live" = "live") {
  server = new McpServer({ name: "history-effects-test", version: "1.0.0" });
  registerDealActionTools(server, { writeMode: mode, v1: new Leads2bV1Client(new Leads2bHttpClient({
    api: "v1", baseUrl: "https://example.com/api/v1", token: "<TOKEN>", maxReadRetries: 0
  })) });
  client = new Client({ name: "history-effects-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
}
const note = { entity: "OPPORTUNITY", id: 123, message: fixtures.note.history_message };
const activity = { entity: "OPPORTUNITY", id: 123, message: fixtures.activity.history_message, receiver: 7, action: 2,
  data: fixtures.activity.data, final_date: fixtures.activity.final_date };
const call = (kind: "note" | "activity", input = kind === "note" ? note : activity) => client.callTool({ name: `leads2b_create_${kind}`, arguments: input });

function mockApi(kind: "note" | "activity", options: {
  before?: unknown; after?: unknown; planned?: unknown; result?: unknown; failWrite?: boolean; failReadback?: boolean;
} = {}) {
  let posts = 0;
  const bodies: URLSearchParams[] = [];
  const requests: string[] = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    const path = new URL(String(url)).pathname; requests.push(`${init?.method} ${path}`);
    if (path === "/api/v1/user/logged/") return Response.json({ data: { user: { id: 7 } } });
    if (init?.method === "POST") {
      expect(path).toBe("/api/v1/history/index/");
      expect(new Headers(init.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
      posts++; bodies.push(new URLSearchParams(String(init.body)));
      if (options.failWrite) return Response.json({ error: "Ambiguous synthetic failure" }, { status: 500 });
      return Response.json(options.result ?? { message: { id: fixtures[kind].id } });
    }
    if (posts && options.failReadback) return Response.json({ message: "Forbidden" }, { status: 403 });
    if (path === "/api/v1/history/index/") return Response.json(posts ? options.after ?? [fixtures[kind]] : options.before ?? []);
    if (path === "/api/v1/history/activities/") return Response.json({ data: { activities: posts ? options.planned ?? [fixtures.activity] : [] } });
    throw new Error("Unexpected request");
  });
  return { bodies, requests, posts: () => posts };
}

it("previews an explicit choice with exact text, form contract and verification plan without I/O", async () => {
  globalThis.fetch = vi.fn(async () => { throw new Error("No network expected"); }); await setup("preview");
  for (const kind of ["note", "activity"] as const) {
    const result = await call(kind);
    expect(result.structuredContent).toMatchObject({ data: { executed: false, encoding: "application/x-www-form-urlencoded", envelope: "data",
      body: { option: kind === "note" ? "comment" : "action", message: fixtures[kind].history_message }, verificationPlan: { automaticRetry: false } } });
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each(["note", "activity"] as const)("sends one %s and verifies ID, target, exact text and relevant fields", async kind => {
  const mock = mockApi(kind); await setup(); const result = await call(kind);
  expect(mock.posts()).toBe(1);
  expect(mock.bodies[0].get("data[message]")).toBe(fixtures[kind].history_message);
  expect(result.structuredContent).toMatchObject({ data: { outcome: "request_accepted", verification: {
    status: "observed", id: fixtures[kind].id, target: { entity: "OPPORTUNITY", id: 123 }, existedBefore: false,
    history: { confirmed: true, idOccurrences: 1 }, uniqueness: "unverified"
  } } });
  if (kind === "activity") expect(result.structuredContent).toMatchObject({ data: { verification: { activities: { confirmed: true, fields: { pending: true } } } } });
  expect(mock.requests.every(request => /\/user\/logged\/|\/history\/(index|activities)\//.test(request))).toBe(true);
});

it.each([
  { label: "duplicate", before: [fixtures.note] },
  { label: "possible duplicate with missing fields", before: [{ id: 9000, history_message: fixtures.note.history_message }] },
  { label: "possible duplicate with unrecognized receiver shape", before: [{ ...fixtures.note, receiver: { id: 7 } }] },
  { label: "conflicting collection envelopes", before: { data: [], history: [fixtures.note] } },
  { label: "unrecognized response", before: { data: { unfamiliar: [] } } }
])("does not send on $label", async ({ before }) => {
  const mock = mockApi("note", { before }); await setup(); const result = await call("note");
  expect(mock.posts()).toBe(0); expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({ data: { executed: false, outcome: "not_sent" } });
});

it("does not send when preflight history is denied", async () => {
  const mock = mockApi("note");
  const fetchMock = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url).includes("/history/index/")
    ? Response.json({ message: "Forbidden" }, { status: 403 }) : fetchMock(url, init);
  await setup(); const result = await call("note");
  expect(mock.posts()).toBe(0);
  expect(result.structuredContent).toMatchObject({ ok: false, data: { outcome: "not_sent", readback: { history: { status: "failed" } } } });
});

it("does not treat a reused response ID as a newly observed effect", async () => {
  mockApi("note", { before: [{ ...fixtures.note, history_message: "Another synthetic note" }] }); await setup();
  expect((await call("note")).structuredContent).toMatchObject({ data: { verification: { status: "unconfirmed", existedBefore: true } } });
});

it.each([
  { label: "HTTP 200 without record", after: [] },
  { label: "different ID", result: { message: { id: 9999 } } },
  { label: "different entity", after: [{ ...fixtures.note, entity: "LEAD" }] },
  { label: "different target", after: [{ ...fixtures.note, id_entity: "456" }] },
  { label: "changed text", after: [{ ...fixtures.note, history_message: fixtures.note.history_message.trim() }] },
  { label: "missing target", after: [{ id: fixtures.note.id, history_message: fixtures.note.history_message }] },
  { label: "unknown receiver shape", after: [{ ...fixtures.note, receiver: { id: 7 } }] },
  { label: "duplicate occurrences", after: [fixtures.note, { ...fixtures.note, id: "9103" }] },
  { label: "repeated ID", after: [fixtures.note, fixtures.note] },
  { label: "unrecognized response", after: { data: {} } },
  { label: "readback failure", failReadback: true },
  { label: "no returned ID", result: { success: true } }
])("does not infer persistence from $label", async options => {
  mockApi("note", options); await setup(); const result = await call("note");
  expect(result.structuredContent).toMatchObject({ data: { outcome: "request_accepted", verification: { status: "unconfirmed" } } });
});

it.each(["receiver", "action", "data", "final_date", "status"])("does not confirm activity with different %s", async field => {
  mockApi("activity", { planned: [{ ...fixtures.activity, [field]: "different" }] }); await setup();
  expect((await call("activity")).structuredContent).toMatchObject({ data: { verification: { status: "unconfirmed", activities: { confirmed: false } } } });
});

it.each([false, true])("reconciles the observed brief activity row and full history (closed=%s)", async closed => {
  const id = fixtures.activity.id;
  const event = {
    id, entity: "opportunity", id_entity: "123", history_type: "action",
    history_message: activity.message, id_user_to: "7", id_action: "2", action_name: "Example follow-up",
    action_date: "localized date", action_date_sql: activity.data, final_date: activity.final_date, status: "pending"
  };
  const planned = { id, action_date: activity.data, action_name: event.action_name, close_date: closed ? activity.data : null };
  const mock = mockApi("activity", { after: [event], planned: [planned] });
  await setup();
  const result = await call("activity");
  expect(mock.posts()).toBe(1);
  expect(result.structuredContent).toMatchObject({ data: { verification: {
    status: closed ? "unconfirmed" : "observed",
    history: { confirmed: true, fields: { receiver: true, action: true, data: true } },
    activities: { confirmed: !closed, fields: { pending: !closed, action_name: true, data: true } }
  } } });
});

it("preserves ambiguous write, requested payload and observed occurrence without retrying", async () => {
  const mock = mockApi("note", { failWrite: true }); await setup(); const result = await call("note");
  expect(result.isError).toBe(true); expect(mock.posts()).toBe(1);
  expect(result.structuredContent).toMatchObject({ writeState: { outcome: "unknown", automaticRetry: false },
    target: { entity: "OPPORTUNITY", id: 123 }, requested: { message: note.message }, readback: { history: { result: [fixtures.note] } } });
  // Repeating the same client request still reconciles first and finds the occurrence.
  const repeated = await call("note"); expect(mock.posts()).toBe(1);
  expect(repeated.structuredContent).toMatchObject({ data: { outcome: "not_sent" } });
});

it("rejects unverified subject and blank text before I/O", async () => {
  globalThis.fetch = vi.fn(); await setup();
  for (const input of [{ ...activity, action_type_label: "Subject" }, { ...activity, message: " \n " }]) {
    expect((await call("activity", input)).isError).toBe(true);
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

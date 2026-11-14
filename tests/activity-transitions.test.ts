import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, expect, it, vi } from "vitest";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import type { Leads2bWriteMode } from "../src/config.js";
import { registerDealActionTools } from "../src/tools/deal-actions.js";

const original = {
  id: "9102", id_entity: "123", entity: "opportunity", history_type: "action",
  action_date: "05/01/2026", action_date_sql: "2026-01-05 10:00:00", final_date: "2026-01-05 10:30:00",
  status: "pending", done: null, close_date: null, external: "0", external_id: null,
  history_message: "Descrição sintética", action_type_label: "Assunto sintético",
  id_action: "2", id_user_to: "7"
};
const target = { entity: "OPPORTUNITY", id: 123, activity_id: 9102, close_description: "Motivo sintético" };
const action_date = "2026-01-06 10:00:00";
const close_date = "2026-01-06 11:00:00";
const rescheduled = {
  ...original, status: "reschedule", action_date_sql: action_date, final_date: "2026-01-06 10:30:00",
  close_description: target.close_description
};
const closed = { ...rescheduled, status: "done", done: "1", close_date };
const planned = (row: Record<string, unknown>) => ({
  id: row.id, action_date: row.action_date_sql, close_date: row.close_date
});

let client: Client;
let server: McpServer;
afterEach(async () => { await client?.close(); await server?.close(); vi.unstubAllGlobals(); });

async function setup(mode: Leads2bWriteMode = "live") {
  server = new McpServer({ name: "transition-test", version: "1.0.0" });
  registerDealActionTools(server, { writeMode: mode, v1: new Leads2bV1Client(new Leads2bHttpClient({
    api: "v1", baseUrl: "https://example.com/api/v1", token: "<TOKEN>", maxReadRetries: 2, retryDelayMs: 0
  })) });
  client = new Client({ name: "transition-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
}

type Row = Record<string, unknown>;
function mockApi(options: {
  before?: Row[]; after?: Row[]; beforePlanned?: Row[]; afterPlanned?: Row[];
  writeStatus?: number; result?: unknown; denyReread?: boolean; user?: boolean; onWrite?: () => Promise<void>;
} = {}) {
  const writes: unknown[] = [];
  const fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input);
    expect(url.origin).toBe("https://example.com");
    if (url.pathname === "/api/v1/user/logged/") return Response.json({ data: { user: options.user === false ? [] : { id: 7 } } });
    if (init?.method === "PUT" || init?.method === "DELETE") {
      expect(url.pathname).toBe("/api/v1/history/index/9102");
      if (init.body) expect(new Headers(init.headers).get("content-type")).toBe("application/json");
      writes.push(init.body ? JSON.parse(String(init.body)) : null);
      await options.onWrite?.();
      return Response.json(options.result ?? { message: "example-response" }, { status: options.writeStatus ?? 200 });
    }
    expect(init?.method).toBe("GET");
    expect(url.searchParams.get("entity")).toBe("OPPORTUNITY");
    expect(url.searchParams.get("id_entity")).toBe("123");
    if (writes.length && options.denyReread) return Response.json({}, { status: 403 });
    if (url.pathname === "/api/v1/history/index/") {
      expect(url.searchParams.get("type")).toBe("action");
      return Response.json(writes.length ? options.after ?? [rescheduled] : options.before ?? [original]);
    }
    expect(url.pathname).toBe("/api/v1/history/activities/");
    const activities = writes.length ? options.afterPlanned ?? [planned(rescheduled)] : options.beforePlanned ?? [planned(original)];
    return Response.json({ data: { activities } });
  });
  vi.stubGlobal("fetch", fetch);
  return { writes, fetch };
}
const reschedule = (arguments_: Record<string, unknown> = { ...target, action_date }) =>
  client.callTool({ name: "leads2b_reschedule_activity", arguments: arguments_ });
const complete = () => client.callTool({ name: "leads2b_complete_activity", arguments: { ...target, close_date } });

it("records the follow-up date in a failed contact attempt using the authenticated user", async () => {
  const after = { ...rescheduled, status: "tried", tried_by_user_id: "7" };
  const { entity, id, activity_id, close_description } = target;
  const { writes } = mockApi({ after: [after], afterPlanned: [planned(after)] });
  await setup();
  const call = () => client.callTool({ name: "leads2b_record_activity_attempt", arguments: { entity, id, activity_id, close_description, action_date } });
  expect((await call()).structuredContent).toMatchObject({ data: { verification: { status: "observed" } } });
  expect((await call()).structuredContent).toMatchObject({ data: { outcome: "not_sent" } });
  expect(writes).toEqual([{ status: "tried", action_date, close_description, tried_by_user_id: 7 }]);
});

it("closes without reaching the objective and requires the explicitly false completion flag on readback", async () => {
  const after = { ...original, status: "unfinishedGoal", done: "0", close_date, close_description: target.close_description };
  const { writes } = mockApi({ after: [after], afterPlanned: [] });
  await setup();
  const result = await client.callTool({ name: "leads2b_close_activity_without_goal", arguments: { ...target, close_date } });
  expect(result.structuredContent).toMatchObject({ data: { verification: { status: "observed" } } });
  expect(writes).toEqual([{ status: "unfinishedGoal", done: false, close_date, close_description: target.close_description }]);
});

it.each([false, true])("requires confirmation before deleting and sends a reason only for closed activities (%s)", async isClosed => {
  const before = isClosed ? closed : original;
  const { fetch, writes } = mockApi({ before: [before], beforePlanned: isClosed ? [] : [planned(before)], after: [], afterPlanned: [] });
  await setup();
  const { entity, id, activity_id } = target;
  const call = (extra: Record<string, unknown>) => client.callTool({ name: "leads2b_delete_activity", arguments: { entity, id, activity_id, ...extra } });
  expect((await call({})).structuredContent).toMatchObject({ data: { executed: false } });
  expect(fetch).not.toHaveBeenCalled();
  expect((await call({ confirm_destructive: true, ...(isClosed ? {} : { reason: "Exemplo" }) })).isError).toBe(true);
  expect(writes).toHaveLength(0);
  expect((await call({ confirm_destructive: true, ...(isClosed ? { reason: "Exemplo" } : {}) })).structuredContent).toMatchObject({ data: {
    method: "DELETE", verification: { status: "absent_in_readback", coverage: { status: "unknown" } }
  } });
  expect(writes).toEqual([isClosed ? { reason: "Exemplo" } : null]);
});

it("reports exact previews, including target and body, without HTTP", async () => {
  const { fetch } = mockApi();
  await setup("preview");
  expect((await reschedule()).structuredContent).toMatchObject({ data: {
    executed: false, target: { entity: "OPPORTUNITY", id: 123, activity_id: 9102 }, endpoint: "/history/index/9102",
    method: "PUT", body: { status: "reschedule", action_date, close_description: target.close_description }
  } });
  expect((await complete()).structuredContent).toMatchObject({ data: {
    executed: false, body: { status: "done", done: true, close_date, close_description: target.close_description }
  } });
  expect(fetch).not.toHaveBeenCalled();
});

it("reconciles reschedule as an open activity with the same ID and duration", async () => {
  const { writes } = mockApi();
  await setup();
  const result = await reschedule();
  expect(writes).toEqual([{ status: "reschedule", action_date, close_description: target.close_description }]);
  expect(result.structuredContent).toMatchObject({ data: { verification: {
    status: "observed", history: { occurrences: 1 }, planned: { occurrences: 1, matches: true }
  } } });
  expect((await reschedule()).structuredContent).toMatchObject({ data: { outcome: "not_sent" } });
  expect(writes).toHaveLength(1);
});

it.each([true, false])("concludes a rescheduled activity whether the list retains its closed row (%s)", async keepClosed => {
  const { writes } = mockApi({
    before: [rescheduled], beforePlanned: [planned(rescheduled)], after: [closed], afterPlanned: keepClosed ? [planned(closed)] : []
  });
  await setup();
  const result = await complete();
  expect(writes).toEqual([{ status: "done", done: true, close_date, close_description: target.close_description }]);
  expect(result.structuredContent).toMatchObject({ data: { verification: { status: "observed" } } });
  expect((await complete()).structuredContent).toMatchObject({ data: { outcome: "not_sent" } });
  expect(writes).toHaveLength(1);
});

it.each([
  { before: [{ ...original, id_entity: "555" }] },
  { before: [{ ...original, history_type: "meet" }] },
  { before: [{ ...original, external_id: "example-calendar-id" }] },
  { before: [{ ...original, done: "1" }] },
  { before: [original, original] },
  { beforePlanned: [] },
  { beforePlanned: [{ ...planned(original), action_date: "missing-match" }] }
])("blocks a write if the scope or open state cannot be confirmed (%#)", async options => {
  const { writes } = mockApi(options);
  await setup();
  const result = await reschedule();
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({ data: { outcome: "not_sent" } });
  expect(writes).toHaveLength(0);
});

it("requires v1 user context and rejects invalid IDs before writing", async () => {
  const { writes } = mockApi({ user: false });
  await setup();
  expect((await reschedule({ ...target, activity_id: "../bad", action_date })).isError).toBe(true);
  expect((await complete()).structuredContent).toMatchObject({ error: { code: "LEADS2B_USER_CONTEXT_REQUIRED" } });
  expect(writes).toHaveLength(0);
});

it.each([
  { after: [original], afterPlanned: [planned(original)] },
  { after: [{ ...rescheduled, action_type_label: "Alterado" }] },
  { after: [{ ...rescheduled, final_date: "2026-01-06 10:05:00" }] },
  { afterPlanned: [] },
  { denyReread: true }
])("keeps HTTP acceptance distinct from an observed effect (%#)", async options => {
  const { writes } = mockApi(options);
  await setup();
  expect((await reschedule()).structuredContent).toMatchObject({ data: {
    outcome: "request_accepted", verification: { status: "unconfirmed", automaticRetry: false }
  } });
  expect(writes).toHaveLength(1);
});

it("keeps the error and rereads after a potentially applied 503, without retry", async () => {
  const { writes } = mockApi({ writeStatus: 503 });
  await setup();
  const result = await reschedule();
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({
    error: { status: 503 }, writeState: { outcome: "unknown", automaticRetry: false },
    verification: { status: "observed" }
  });
  expect(writes).toHaveLength(1);
});

it("reports the API business rejection even with HTTP 200", async () => {
  const { writes } = mockApi({ result: { message: "create_action" }, after: [original], afterPlanned: [planned(original)] });
  await setup();
  const result = await reschedule();
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({ data: { outcome: "rejected", verification: { status: "unconfirmed" } } });
  expect(writes).toHaveLength(1);
});

it("blocks a competing transition for the same ID while a write is in flight", async () => {
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const { writes } = mockApi({ onWrite: () => { entered(); return wait; } });
  await setup();
  const first = reschedule();
  try {
    await started;
    expect((await complete()).structuredContent).toMatchObject({ data: { outcome: "not_sent" } });
  } finally { release(); }
  await first;
  expect(writes).toHaveLength(1);
});

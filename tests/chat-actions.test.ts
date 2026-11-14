import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, expect, it, vi } from "vitest";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import type { Leads2bWriteMode } from "../src/config.js";
import { CHAT_ACTION_TOOL_NAMES, registerChatActionTools } from "../src/tools/chat-actions.js";

const target = { chatId: 501, entityId: 123, channelId: 21 };
const textInput = { recipient: "12025550101", text: "Mensagem sintética" };
const chat = { id: 501, id_entity: 123, entity: "opportunity", last_id_channel: 21, id_user: null,
  channel_type: "whatsapp", status: "open", channel_deleted: false, blocked: false, activeSession: true,
  deleted_at: null, type: "private", phone: textInput.recipient, session_id: null };
const textMessage = { type: "text", id_channel: 21, id_entity: 123, entity: "opportunity", to: textInput.recipient,
  template: null, message: textInput.text };
type Row = Record<string, unknown>;

let client: Client;
let server: McpServer;
afterEach(async () => { await client?.close(); await server?.close(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(mode: Leads2bWriteMode, options: {
  chat?: Row; afterChat?: Row; messages?: Row[]; afterMessages?: Row[]; users?: Row[];
  status?: number; response?: Row; chatAfterStatus?: number;
} = {}) {
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  const fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input);
    expect(url.origin).toBe("https://example.com");
    if (init?.method !== "GET") {
      writes.push({ method: init?.method ?? "", path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
      return Response.json(options.response ?? { id: 11 }, { status: options.status ?? 200 });
    }
    if (url.pathname.endsWith("/users")) {
      expect(url.searchParams.get("situation")).toBe("open");
      return Response.json({ users: options.users ?? [{ id_user: 8 }] });
    }
    if (url.pathname.endsWith("/messages")) {
      return Response.json({ messages: writes.length ? options.afterMessages ?? [] : options.messages ?? [] });
    }
    expect(url.pathname).toBe("/api/v2/messages/chats/501");
    return Response.json({ chat: writes.length ? options.afterChat ?? chat : options.chat ?? chat },
      { status: writes.length ? options.chatAfterStatus ?? 200 : 200 });
  });
  vi.stubGlobal("fetch", fetch);
  server = new McpServer({ name: "chat-action-test", version: "1.0.0" });
  if (mode === "disabled") server.registerTool("fixture_read", {}, () => ({ content: [] }));
  const v2 = new Leads2bV2Client(new Leads2bHttpClient({ api: "v2", baseUrl: "https://example.com/api/v2", token: "<TOKEN>", maxReadRetries: 2 }));
  registerChatActionTools(server, { v2, writeMode: mode });
  client = new Client({ name: "chat-action-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  return { writes, fetch };
}

const call = (name: string, args: Row = {}) => client.callTool({ name: `leads2b_${name}`, arguments: { ...target, ...args } });

it("does not register chat writes in disabled mode", async () => {
  const { fetch } = await setup("disabled");
  expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(["fixture_read"]);
  expect(fetch).not.toHaveBeenCalled();
});

it("previews all five operations and annotates deletion as destructive without reading HTTP", async () => {
  const { fetch } = await setup("preview");
  const { tools } = await client.listTools();
  expect(tools.map(tool => tool.name)).toEqual(CHAT_ACTION_TOOL_NAMES);
  expect(tools.find(tool => tool.name === "leads2b_delete_chat")?.annotations?.destructiveHint).toBe(true);
  const inputs = [{ assigneeId: 8, priorAssigneeId: null }, textInput, { messageId: 10, reaction: "👍" },
    { ...textInput, scheduledAt: "2026-01-06T15:00:00-03:00" }, { confirm_destructive: true }];
  for (const [index, name] of CHAT_ACTION_TOOL_NAMES.entries()) {
    expect((await client.callTool({ name, arguments: { ...target, ...inputs[index] } })).structuredContent).toMatchObject({ data: { executed: false } });
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("sends only the ordinary assignment request, then verifies the owner on the chat", async () => {
  const { writes } = await setup("live", { afterChat: { ...chat, id_user: 8 } });
  expect((await call("assign_chat", { assigneeId: 8, priorAssigneeId: null })).structuredContent).toMatchObject({ data: {
    outcome: "request_accepted", verification: { status: "observed" }
  } });
  expect(writes).toEqual([{ method: "PUT", path: "/api/v2/messages/chats/501", body: { chat: { id: 501, id_user: 8 } } }]);
});

it("blocks assignment if the specified prior owner is wrong or the assignee is outside the directory", async () => {
  const { writes } = await setup("live", { users: [{ id_user: 9 }] });
  expect((await call("assign_chat", { assigneeId: 8, priorAssigneeId: 7 })).isError).toBe(true);
  expect((await call("assign_chat", { assigneeId: 8, priorAssigneeId: null })).isError).toBe(true);
  expect(writes).toEqual([]);
});

it("checks chat, channel and recipient and reconciles the exact message ID without inferring delivery", async () => {
  const { writes } = await setup("live", { afterMessages: [{ ...textMessage, id: 11, id_chat: 501, scheduled_at: null, sent: 0 }] });
  for (const mismatch of [{ channelId: 22 }, { entityId: 124 }, { recipient: "12025550102" }]) {
    expect((await call("send_chat_text", { ...textInput, ...mismatch })).isError).toBe(true);
  }
  expect(writes).toEqual([]);
  expect((await call("send_chat_text", textInput)).structuredContent).toMatchObject({ data: { verification: { status: "observed", id: "11" } } });
  expect(writes).toEqual([{ method: "POST", path: "/api/v2/messages/chats/501/messages", body: {
    message: { ...textMessage, internal: false, mentions: [], sessionId: null }
  } }]);
});

it("keeps the unknown outcome after a 503 and sends the write only once", async () => {
  const { writes } = await setup("live", { status: 503 });
  const result = await call("send_chat_text", textInput);
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toMatchObject({ error: { status: 503 }, writeState: { outcome: "unknown", automaticRetry: false },
    verification: { status: "unconfirmed" } });
  expect(writes).toHaveLength(1);
});

it("rejects free text when the official WhatsApp session is inactive", async () => {
  const { writes } = await setup("live", { chat: { ...chat, activeSession: false } });
  expect((await call("send_chat_text", textInput)).isError).toBe(true);
  expect(writes).toEqual([]);
});

it("rejects past or distant scheduling, uses UTC and verifies the scheduled CRM row", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-06T17:00:00Z"));
  const scheduledAt = "2026-01-06T18:00:00.000Z";
  const { writes } = await setup("live", { afterMessages: [{ ...textMessage, id: 11, id_chat: 501, scheduled_at: scheduledAt }] });
  for (const date of ["2026-01-05T15:00:00-03:00", "2026-01-07T15:00:00-03:00"]) {
    expect((await call("schedule_chat_text", { ...textInput, scheduledAt: date })).isError).toBe(true);
  }
  expect((await call("schedule_chat_text", { ...textInput, scheduledAt: "2026-01-06T15:00:00-03:00" })).structuredContent).toMatchObject({
    data: { verification: { status: "observed" } }
  });
  expect(writes).toEqual([{ method: "POST", path: "/api/v2/messages/chats/501/schedule", body: {
    scheduledAt, message: { ...textMessage, media: null, is_new_file: false, caption: "" }
  } }]);
});

it("reacts only to an exact message in the chat and verifies a new CRM reaction ID", async () => {
  const message = { id: 10, id_chat: 501, id_channel: 21, deleted_at: null, reactions: [] };
  const { writes } = await setup("live", { messages: [message], afterMessages: [{ ...message, reactions: [{ id: 11, reaction: "👍" }] }] });
  expect((await call("react_to_chat_message", { reaction: "👍", messageId: 9 })).isError).toBe(true);
  expect((await call("react_to_chat_message", { reaction: "👍", messageId: 10 })).structuredContent).toMatchObject({ data: {
    verification: { status: "observed", id: "11" }
  } });
  expect(writes).toEqual([{ method: "POST", path: "/api/v2/messages/chats/501/messages/10/reactions", body: { reaction: "👍" } }]);
});

it.each(["whatsapp", "whatsapp-web"])("requires confirmation and limits deletion to WhatsApp Web (%s)", async channel_type => {
  const { writes, fetch } = await setup("live", { chat: { ...chat, channel_type }, chatAfterStatus: 404 });
  expect((await call("delete_chat")).structuredContent).toMatchObject({ data: { executed: false } });
  expect(fetch).not.toHaveBeenCalled();
  const result = await call("delete_chat", { confirm_destructive: true });
  if (channel_type === "whatsapp") {
    expect(result.isError).toBe(true);
    expect(writes).toEqual([]);
  } else {
    expect(result.structuredContent).toMatchObject({ data: { verification: { status: "not_found_on_readback" } } });
    expect(writes).toEqual([{ method: "DELETE", path: "/api/v2/messages/chats/501", body: null }]);
  }
});

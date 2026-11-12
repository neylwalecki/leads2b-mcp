import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { registerReadTools } from "../src/tools/read.js";
import chats from "./fixtures/chats.example.json" with { type: "json" };
import chatDetail from "./fixtures/chat-detail.example.json" with { type: "json" };
import messagePages from "./fixtures/chat-messages-pages-14.example.json" with { type: "json" };

const originalFetch = globalThis.fetch;
let client: Client;
let server: McpServer;

afterEach(async () => {
  await client?.close();
  await server?.close();
  globalThis.fetch = originalFetch;
});

async function connect(withToken = true) {
  server = new McpServer({ name: "chat-read-test", version: "1.0.0" });
  const http = (api: "v1" | "v2") => new Leads2bHttpClient({
    api, baseUrl: `https://example.com/api/${api}`, token: withToken ? `<TOKEN_${api}>` : undefined, maxReadRetries: 0
  });
  registerReadTools(server, { v1: new Leads2bV1Client(http("v1")), v2: new Leads2bV2Client(http("v2")) });
  client = new Client({ name: "chat-read-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
}

describe("experimental V2 chat reads", () => {
  it("lists chats only in the requested opportunity scope and preserves the envelope", async () => {
    const requests: string[] = [];
    globalThis.fetch = async url => {
      requests.push(String(url));
      return Response.json(chats);
    };
    await connect();

    const result = await client.callTool({ name: "leads2b_list_chats", arguments: { entity: "OPPORTUNITY", id: 123 } });

    expect(requests).toEqual([
      "https://example.com/api/v2/messages/chats?id_entity=123&entity=opportunity&order=desc&limit=25&offset=0"
    ]);
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: {
        response: chats,
        chats: chats.data.chats,
        scope: { requested: { entity: "OPPORTUNITY", entityId: 123 }, verified: "confirmed" },
        coverage: { status: "unknown", recordsReturned: 2, duplicatesRemoved: 0 }
      },
      source: { api: "v2", endpoint: "/messages/chats", stability: "experimental" }
    });
    expect(JSON.stringify(result)).not.toContain("<TOKEN");
  });

  it("reads chat detail and checks an explicitly supplied entity context", async () => {
    globalThis.fetch = async url => {
      expect(String(url)).toBe("https://example.com/api/v2/messages/chats/501");
      return Response.json(chatDetail);
    };
    await connect();

    const result = await client.callTool({
      name: "leads2b_get_chat",
      arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123 }
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: { response: chatDetail, chat: chatDetail, scope: {
        requested: { entity: "OPPORTUNITY", entityId: 123 }, verified: "confirmed", observedEntityId: "123"
      } }
    });
  });

  it("collects 5+5+4+0 message pages, deduplicates IDs and preserves media/transcription fields", async () => {
    const requests: string[] = [];
    globalThis.fetch = async url => {
      const parsed = new URL(String(url));
      requests.push(parsed.toString());
      if (!parsed.pathname.endsWith("/messages")) return Response.json(chatDetail);
      const offset = Number(parsed.searchParams.get("offset"));
      const page = offset === 0 ? messagePages[0]
        : offset === 5 ? messagePages[1]
          : offset === 10 ? messagePages[2] : messagePages[3];
      return Response.json(page);
    };
    await connect();

    const result = await client.callTool({
      name: "leads2b_list_chat_messages",
      arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123, limit: 5, offset: 0, maxPages: 10, order: "desc" }
    });
    const data = (result.structuredContent as Record<string, unknown>).data as {
      messages: Array<Record<string, unknown>>;
      coverage: Record<string, unknown>;
      pages: unknown[];
    };

    expect(requests).toEqual([
      "https://example.com/api/v2/messages/chats/501",
      "https://example.com/api/v2/messages/chats/501/messages?offset=0&limit=5&order=desc",
      "https://example.com/api/v2/messages/chats/501/messages?offset=5&limit=5&order=desc",
      "https://example.com/api/v2/messages/chats/501/messages?offset=10&limit=5&order=desc",
      "https://example.com/api/v2/messages/chats/501/messages?offset=14&limit=5&order=desc"
    ]);
    expect(result.structuredContent).toMatchObject({ ok: true });
    expect(data.messages).toHaveLength(14);
    expect(data.messages.map(message => message.id)).toEqual([
      "m-14", "m-13", "m-12", "m-11", "m-10", "m-9", "m-8", "m-7", "m-6", "m-5", "m-4", "m-3", "m-2", "m-1"
    ]);
    expect(data.messages[2]).toMatchObject({
      file_url: "https://example.com/media/example.ogg",
      file_name: "example.ogg",
      transcription: { language: "pt-BR" },
      transcription_text: "Example transcription"
    });
    expect(data.coverage).toMatchObject({
      status: "complete", reason: "empty_page", pagesFetched: 4, rawRecordsFetched: 14,
      recordsReturned: 14, duplicatesRemoved: 0, nextOffset: null
    });
    expect(data.pages).toEqual(messagePages);
  });

  it("stops on a repeated page and does not merge messages from another chat", async () => {
    let calls = 0;
    globalThis.fetch = async url => {
      if (!String(url).includes("/messages/chats/501/messages")) return Response.json({ id: "501", id_entity: "123", entity: "opportunity" });
      calls += 1;
      expect(new URL(String(url)).searchParams.get("offset")).toBe(String(calls - 1));
      return Response.json({ data: [{ id: "same", chat_id: "501", text: "Example" }], total: 10 });
    };
    await connect();

    const result = await client.callTool({ name: "leads2b_list_chat_messages", arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123, limit: 2, maxPages: 10 } });
    expect(result.structuredContent).toMatchObject({ ok: true, data: {
      messages: [{ id: "same", chat_id: "501" }],
      coverage: { status: "partial", reason: "repeated_page", pagesFetched: 2, duplicatesRemoved: 1, nextOffset: 2 }
    } });
    expect(calls).toBe(2);
  });

  it("rejects an explicit entity or chat mismatch rather than guessing by phone", async () => {
    globalThis.fetch = async url => {
      if (String(url).includes("/messages/chats/501/messages")) {
        return Response.json({ data: [{ id: "bad", chat_id: "999", text: "Example" }] });
      }
      return Response.json({ id: "501", id_entity: "999", entity: "opportunity" });
    };
    await connect();

    const chatsResult = await client.callTool({ name: "leads2b_list_chats", arguments: { id: 123 } });
    expect(chatsResult.isError).toBe(true);
    expect(chatsResult.structuredContent).toMatchObject({ ok: false, error: { code: "MCP_TOOL_ERROR" } });

    const messagesResult = await client.callTool({ name: "leads2b_list_chat_messages", arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123, limit: 1 } });
    expect(messagesResult.isError).toBe(true);
    expect(messagesResult.structuredContent).toMatchObject({ ok: false, error: { code: "MCP_TOOL_ERROR" } });
  });

  it("requires a returned chat ID before confirming the requested scope", async () => {
    globalThis.fetch = async url => String(url).endsWith("/messages/chats/501")
      ? Response.json({ id: "999", id_entity: "123", entity: "opportunity" })
      : Response.json({ data: [] });
    await connect();

    const result = await client.callTool({
      name: "leads2b_get_chat",
      arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123 }
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: { message: expect.stringContaining("não corresponde") } });
  });

  it("preserves messages without IDs but marks the collection partial", async () => {
    globalThis.fetch = async url => {
      if (!String(url).includes("/messages/chats/501/messages")) return Response.json({ id: "501", id_entity: "123", entity: "opportunity" });
      const offset = Number(new URL(String(url)).searchParams.get("offset"));
      return Response.json(offset === 0
        ? { data: [{ chat_id: "501", created_at: "2026-06-01T12:00:00.000Z", text: "Example no id" }] }
        : { data: [] });
    };
    await connect();

    const result = await client.callTool({
      name: "leads2b_list_chat_messages",
      arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123, limit: 1, maxPages: 3 }
    });
    expect(result.structuredContent).toMatchObject({ ok: true, data: {
      messages: [{ chat_id: "501", text: "Example no id" }],
      coverage: { status: "partial", reason: "missing_identifier", missingIdentifiers: 1 }
    } });
  });

  it("does not read messages when the detail does not confirm chat and opportunity scope", async () => {
    const requests: string[] = [];
    globalThis.fetch = async url => {
      requests.push(String(url));
      return Response.json({});
    };
    await connect();

    const result = await client.callTool({
      name: "leads2b_list_chat_messages",
      arguments: { chatId: 501, entity: "OPPORTUNITY", entityId: 123, limit: 5 }
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: { message: expect.stringContaining("não confirmou") } });
    expect(requests).toEqual(["https://example.com/api/v2/messages/chats/501"]);
  });

  it.each([
    { id: 501, entity: "opportunity" },
    { id: 501, data: { id_entity: 123, entity: "opportunity" } },
    { ...chatDetail, data: { id: 999, id_entity: 456, entity: "opportunity" } },
    { ...chatDetail, entity_id: 456 }
  ])("does not combine partial or conflicting identities to authorize messages (%#)", async detail => {
    const urls: string[] = [];
    globalThis.fetch = async url => { urls.push(String(url)); return Response.json(detail); };
    await connect();
    const result = await client.callTool({ name: "leads2b_list_chat_messages", arguments: { chatId: 501, entityId: 123 } });
    expect(result.isError).toBe(true);
    expect(urls).toEqual(["https://example.com/api/v2/messages/chats/501"]);
  });

  it("rejects missing credentials and invalid IDs locally, and preserves a 403 without an empty result", async () => {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return Response.json({ message: "Forbidden" }, { status: 403 }); };
    await connect(false);
    expect((await client.callTool({ name: "leads2b_list_chat_messages", arguments: { chatId: 501, entityId: 123 } })).isError).toBe(true);
    expect(requests).toBe(0);
    await client.close(); await server.close(); await connect();
    for (const args of [{ chatId: "../501", entityId: 123 }, { chatId: 501, entityId: -1 }]) {
      expect((await client.callTool({ name: "leads2b_list_chat_messages", arguments: args })).isError).toBe(true);
    }
    expect(requests).toBe(0);
    const result = await client.callTool({ name: "leads2b_list_chat_messages", arguments: { chatId: 501, entityId: 123 } });
    expect(result.structuredContent).toMatchObject({ ok: false, error: { status: 403 } });
    expect(result.structuredContent).not.toHaveProperty("data"); expect(requests).toBe(1);
  });
});

const message = { id: "example-message", chat_id: 501, created_at: "2026-01-02T10:00:00.000Z", text: "Example" };
it.each([
  { label: "page budget", pages: [[message]], maxPages: 1, reason: "page_limit", count: 1 },
  { label: "offset tail", pages: [[]], offset: 10, reason: "empty_page_after_offset", count: 0 },
  { label: "overlapping pages", pages: [[message], [message, { ...message, id: "another" }], []], reason: "duplicate_rows", count: 2 },
  { label: "unknown timestamp", pages: [[{ ...message, created_at: null }], []], reason: "order_unverified", count: 1 },
  { label: "unstable descending order", pages: [[message], [{ ...message, id: "later", created_at: "2026-01-02T11:00:00.000Z" }]], reason: "unstable_order", count: 2 },
  { label: "malformed page", pages: [[message], { unexpected: true }], reason: "invalid_response", count: 1 },
  { label: "wrong chat on later page", pages: [[message], [{ ...message, id: "other-chat", chat_id: 999 }]], reason: "invalid_response", count: 1 },
  { label: "failed later request", pages: [[message], "403"], reason: "request_failed", count: 1 },
  { label: "malformed identifiers", pages: [[{ ...message, id: {} }, { ...message, id: "" }], []], reason: "missing_identifier", count: 2 }
])("retains valid data and partial coverage on $label", async ({ pages, reason, count, maxPages, offset }) => {
  let pageIndex = 0;
  globalThis.fetch = async url => {
    if (!new URL(String(url)).pathname.endsWith("/messages")) return Response.json(chatDetail);
    const page = pages[pageIndex++];
    return page === "403" ? Response.json({ message: "Forbidden" }, { status: 403 }) : Response.json(Array.isArray(page) ? { data: page } : page);
  };
  await connect();
  const result = await client.callTool({ name: "leads2b_list_chat_messages", arguments: { chatId: 501, entityId: 123, limit: 5, maxPages: maxPages ?? 5, offset: offset ?? 0 } });
  expect(result.structuredContent).toMatchObject({ ok: true, data: { coverage: { status: "partial", reason } } });
  const data = (result.structuredContent as { data: { messages: unknown[]; pages: unknown[] } }).data;
  expect(data.messages).toHaveLength(count);
  expect(data.pages).toHaveLength(reason === "request_failed" ? pageIndex - 1 : pageIndex);
});

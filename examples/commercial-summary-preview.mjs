// Offline demonstration. It never loads .env, accepts real credentials or sends a mutation.
// Run: npm run build && node examples/commercial-summary-preview.mjs
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Leads2bHttpClient } from "../dist/client/http.js";
import { Leads2bV1Client } from "../dist/client/v1.js";
import { Leads2bV2Client } from "../dist/client/v2.js";
import { registerReadTools } from "../dist/tools/read.js";
import { registerDealActionTools } from "../dist/tools/deal-actions.js";

const chat = { id: 501, entity: "opportunity", id_entity: 123 };
const messages = Array.from({ length: 14 }, (_, index) => ({
  id: 1014 - index, chat_id: 501, created_at: `2026-01-02T10:${String(14 - index).padStart(2, "0")}:00.000Z`,
  direction: index % 2 ? "incoming" : "outgoing",
  text: index % 2 ? "Tenho interesse no produto de exemplo." : "Vamos confirmar a quantidade necessária.",
  metadata: { synthetic: true }
}));
Object.assign(messages[3], { text: null, file_url: "https://example.com/audio-1.ogg", file_name: "audio-1.ogg", transcription_text: "Confirmarei a quantidade depois." });
Object.assign(messages[7], { text: null, file_url: "https://example.com/audio-2.ogg", file_name: "audio-2.ogg", transcription_text: null });
const originalFetch = globalThis.fetch;
const messagePages = [];
let reads = 0;
globalThis.fetch = async (url, init) => {
  assert.equal(init?.method, "GET", "A demonstração só permite leitura simulada.");
  const parsed = new URL(String(url));
  assert.equal(parsed.origin, "https://example.com");
  reads++;
  switch (parsed.pathname) {
    case "/api/v2/messages/chats": return Response.json({ data: { chats: [chat] } });
    case "/api/v2/messages/chats/501": return Response.json({ data: chat });
    case "/api/v2/messages/chats/501/messages": {
      const offset = Number(parsed.searchParams.get("offset"));
      const page = messages.slice(offset, offset + Number(parsed.searchParams.get("limit")));
      messagePages.push(page.length);
      return Response.json({ data: { messages: page } });
    }
    case "/api/v1/history/index/": return Response.json([]);
    case "/api/v1/history/activities/": return Response.json({ data: { activities: [] } });
    case "/api/v1/action/list/": return Response.json({ data: [{ id: 2, name: "FollowUp" }] });
    case "/api/v1/pipeline/responsible_users/321/active": return Response.json({ data: [{ id: 7, name: "Example User" }] });
    default: throw new Error(`Consulta não prevista na demonstração: ${parsed.pathname}`);
  }
};
const http = api => new Leads2bHttpClient({ api, baseUrl: `https://example.com/api/${api}`, token: "<TOKEN>", maxReadRetries: 0 });
const v1 = new Leads2bV1Client(http("v1"));
const v2 = new Leads2bV2Client(http("v2"));
const server = new McpServer({ name: "synthetic-commercial-summary", version: "1.0.0" });
registerReadTools(server, { v1, v2 });
registerDealActionTools(server, { v1, writeMode: "preview" });
const client = new Client({ name: "synthetic-client", version: "1.0.0" });
const [a, b] = InMemoryTransport.createLinkedPair();

try {
  await server.connect(b); await client.connect(a);
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result.structuredContent));
    return result.structuredContent.data;
  };
  await call("leads2b_list_chats", { entity: "OPPORTUNITY", id: 123 });
  await call("leads2b_get_chat", { chatId: 501, entityId: 123 });
  const conversation = await call("leads2b_list_chat_messages", { chatId: 501, entityId: 123, limit: 5 });
  assert.deepEqual(messagePages, [5, 5, 4, 0]);
  assert.equal(conversation.messages.length, 14);
  assert.equal(conversation.coverage.status, "complete");
  const notes = await call("leads2b_list_history", { entity: "OPPORTUNITY", id: 123, type: "comment" });
  await call("leads2b_list_history", { entity: "OPPORTUNITY", id: 123, unfinished: true });
  const activities = await call("leads2b_list_activities", { entity: "OPPORTUNITY", id: 123 });
  await call("leads2b_list_actions", {});
  await call("leads2b_list_pipeline_responsible_users", { pipelineId: 321 });
  const summary = "[SYNTHETIC-SUMMARY-01]\nInteresse no produto de exemplo. Quantidade ainda não confirmada.\nPróximo passo: confirmar quantidade.\nFontes: chat 501, mensagens 1001 a 1014, de 02/01/2026.\nLacunas: áudio 1007 sem transcrição. Histórico e atividades com cobertura desconhecida.";
  const readsBeforePreview = reads;
  const note = await call("leads2b_create_note", { entity: "OPPORTUNITY", id: 123, message: summary });
  const activity = await call("leads2b_create_activity", { entity: "OPPORTUNITY", id: 123, message: summary,
    receiver: 7, action: 2, data: "2030-01-07 10:00:00", final_date: "2030-01-07 10:30:00" });
  assert.equal(reads, readsBeforePreview, "As duas prévias devem dispensar I/O.");
  assert.equal(note.executed, false); assert.equal(activity.executed, false);
  assert.equal(note.body.message, summary); assert.equal(activity.body.message, summary);
  console.log(JSON.stringify({ synthetic: true, externalRequests: 0, writes: 0,
    context: { messagePages, messages: conversation.messages.length, coverage: conversation.coverage,
      historyCoverage: notes.coverage, activitiesCoverage: activities.coverage },
    preview: summary, choice: "Escolha uma operação. As duas alternativas abaixo são apenas prévias.",
    operations: { note, activity } }, null, 2));
} finally {
  await client.close(); await server.close(); globalThis.fetch = originalFetch;
}

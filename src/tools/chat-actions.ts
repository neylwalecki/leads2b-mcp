import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bHttpError, type Leads2bHttpMethod } from "../client/http.js";
import type { Leads2bV2Client } from "../client/v2.js";
import type { Leads2bWriteMode } from "../config.js";
import { EntityIdSchema } from "../crud/schemas.js";
import { evaluateWriteOperation } from "../safety/write-gates.js";
import { businessFailure } from "./deal-action-support.js";
import { readConfirmedChat } from "./read/chats.js";
import { errorResult, okResult } from "./result.js";

const ASSIGN = "leads2b_assign_chat";
const SEND = "leads2b_send_chat_text";
const REACT = "leads2b_react_to_chat_message";
const SCHEDULE = "leads2b_schedule_chat_text";
const REMOVE = "leads2b_delete_chat";
export const CHAT_ACTION_TOOL_NAMES = [ASSIGN, SEND, REACT, SCHEDULE, REMOVE] as const;

const targetSchema = z.strictObject({ chatId: EntityIdSchema, entityId: EntityIdSchema, channelId: EntityIdSchema });
const textSchema = targetSchema.extend({
  recipient: z.string().regex(/^\+?[0-9]{8,20}$/),
  text: z.string().max(4096).refine(value => value.trim().length > 0, "Informe o texto da mensagem.")
});
const assignSchema = targetSchema.extend({ assigneeId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), priorAssigneeId: EntityIdSchema.nullable() });
const reactionSchema = targetSchema.extend({
  messageId: EntityIdSchema,
  reaction: z.string().max(24).regex(/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|[\u200d\ufe0f])+$/u),
  offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0)
});
const scheduleSchema = textSchema.extend({ scheduledAt: z.iso.datetime({ offset: true }) });
const removeSchema = targetSchema.extend({ confirm_destructive: z.boolean().optional() });
type Target = z.infer<typeof targetSchema>;
type Text = z.infer<typeof textSchema>;
type Deps = { v2: Pick<Leads2bV2Client, "getChat" | "listChatMessages" | "rawRequest">; writeMode: Leads2bWriteMode };
type Row = Record<string, unknown>;
type Verification = { status: "observed" | "unconfirmed" | "not_found_on_readback"; id?: string };
type Prepared = { body?: unknown; verify: (response: unknown) => Promise<Verification> };

const record = z.record(z.string(), z.unknown());
const chatEnvelope = z.object({ chat: record });
const messageEnvelope = z.object({ messages: z.array(record) });
const sameId = (value: unknown, id: string | number) => EntityIdSchema.safeParse(value).success && String(value) === String(id);
const unconfirmed: Verification = { status: "unconfirmed" };
const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

export function registerChatActionTools(server: McpServer, deps: Deps): void {
  if (deps.writeMode === "disabled") return;
  const inFlight = new Set<string>();

  server.registerTool(ASSIGN, {
    description: "Atribui um chat aberto ao responsável indicado após conferir o responsável atual e o catálogo. Atualiza a atribuição da conversa. Rota interna experimental.",
    inputSchema: assignSchema, annotations
  }, ({ assigneeId, priorAssigneeId, ...target }) => run(ASSIGN, target, "PUT", "", { assigneeId, priorAssigneeId }, async chat => {
    if (chat.status !== "open" || !(priorAssigneeId === null ? chat.id_user === null : sameId(chat.id_user, priorAssigneeId))) {
      throw new Error("A conversa não está aberta com o responsável atual informado.");
    }
    if (sameId(chat.id_user, assigneeId)) throw new Error("O responsável indicado já está atribuído à conversa.");
    const { users } = z.object({ users: z.array(record) }).parse(await deps.v2.rawRequest({
      method: "GET", path: "/messages/chats/users", query: { situation: "open", order: "desc" }
    }));
    if (users.filter(user => sameId(user.id_user, assigneeId)).length !== 1) throw new Error("O novo responsável não foi confirmado no catálogo da caixa.");
    return {
      body: { chat: { id: chat.id, id_user: assigneeId } },
      verify: async () => sameId((await readChat(target)).id_user, assigneeId) ? { status: "observed" } : unconfirmed
    };
  }));

  server.registerTool(SEND, {
    description: "Envia texto ao destinatário explícito em um chat WhatsApp oficial aberto e com sessão ativa. Releitura confirma registro no CRM. Rota interna experimental.",
    inputSchema: textSchema, annotations
  }, ({ recipient, text, ...target }) => run(SEND, target, "POST", "/messages", { recipient, text }, async chat => {
    const message = textMessage(chat, { ...target, recipient, text });
    const sessionId = z.union([z.string().min(1), z.number().int()]).nullish().parse(chat.session_id) ?? null;
    return {
      body: { message: { ...message, internal: false, mentions: [], sessionId } },
      verify: response => verifyMessage(target, response, message, null)
    };
  }));

  server.registerTool(REACT, {
    description: "Registra uma reação no CRM para uma mensagem localizada no chat informado. A releitura busca a reação no CRM. Rota interna experimental.",
    inputSchema: reactionSchema, annotations
  }, ({ messageId, reaction, offset, ...target }) => run(REACT, target, "POST", `/messages/${messageId}/reactions`, { messageId, reaction, offset }, async chat => {
    if (chat.status !== "open") throw new Error("A reação exige um chat aberto.");
    const message = await findMessage(target, messageId, offset);
    if (!message || !sameId(message.id_channel, target.channelId) || message.deleted_at !== null || !Array.isArray(message.reactions)) {
      throw new Error("A mensagem e o canal não foram confirmados na página indicada.");
    }
    const priorReactions: unknown[] = message.reactions;
    return {
      body: { reaction },
      verify: async response => {
        const id = z.object({ id: EntityIdSchema }).safeParse(response);
        if (!id.success || priorReactions.some(item => sameId(record.safeParse(item).data?.id, id.data.id))) return unconfirmed;
        const after = await findMessage(target, messageId, offset);
        const reactions = Array.isArray(after?.reactions) ? after.reactions : [];
        const matching = reactions.map(item => record.safeParse(item).data).filter(item => sameId(item?.id, id.data.id));
        return matching.length === 1 && matching[0]?.reaction === reaction ? { status: "observed", id: String(id.data.id) } : unconfirmed;
      }
    };
  }));

  server.registerTool(SCHEDULE, {
    description: "Agenda texto para o destinatário explícito de um chat WhatsApp oficial aberto com sessão ativa, para um horário nos próximos 24h. Registra o agendamento no CRM. Rota interna experimental.",
    inputSchema: scheduleSchema, annotations
  }, ({ recipient, text, scheduledAt, ...target }) => run(SCHEDULE, target, "POST", "/schedule", { recipient, text, scheduledAt }, async chat => {
    const message = textMessage(chat, { ...target, recipient, text });
    const when = Date.parse(scheduledAt);
    const now = Date.now();
    if (!(when > now && when < now + 24 * 60 * 60 * 1000)) throw new Error("Informe um horário futuro dentro das próximas 24 horas.");
    return {
      body: { scheduledAt: new Date(when).toISOString(), message: { ...message, media: null, is_new_file: false, caption: "" } },
      verify: response => verifyMessage(target, response, message, when)
    };
  }));

  server.registerTool(REMOVE, {
    description: "Solicita a exclusão de um chat de canal WhatsApp Web vinculado à oportunidade. Exige confirmação destrutiva. Rota interna experimental.",
    inputSchema: removeSchema, annotations: { ...annotations, destructiveHint: true }
  }, ({ confirm_destructive, ...target }) => run(REMOVE, target, "DELETE", "", {}, async chat => {
    if (chat.channel_type !== "whatsapp-web") throw new Error("A exclusão observada na interface se aplica a canais WhatsApp Web.");
    return { verify: async () => {
      try {
        const after = await readChat(target, true);
        return typeof after.deleted_at === "string" && after.deleted_at ? { status: "observed" } : unconfirmed;
      } catch (error) {
        if (error instanceof Leads2bHttpError && error.status === 404) return { status: "not_found_on_readback" };
        throw error;
      }
    } };
  }, confirm_destructive));

  async function readChat(target: Target, allowDeleted = false) {
    const { response } = await readConfirmedChat(deps, { entity: "OPPORTUNITY", entityId: target.entityId }, target.chatId);
    const { chat } = chatEnvelope.parse(response);
    if (!sameId(chat.id, target.chatId) || !sameId(chat.id_entity, target.entityId)
      || typeof chat.entity !== "string" || chat.entity.toLowerCase() !== "opportunity"
      || !sameId(chat.last_id_channel, target.channelId) || (!allowDeleted && (chat.deleted_at !== null || chat.channel_deleted !== false))) {
      throw new Error("O detalhe não confirmou os IDs do chat, da oportunidade e do canal em uso.");
    }
    return chat;
  }

  async function findMessage(target: Target, id: string | number, offset: number) {
    const response = await deps.v2.listChatMessages({ id: target.chatId, order: "desc", limit: 100, offset });
    const { messages } = messageEnvelope.parse(response);
    const matches = messages.filter(message => sameId(message.id, id));
    return matches.length === 1 && sameId(matches[0].id_chat, target.chatId) ? matches[0] : undefined;
  }

  async function verifyMessage(target: Target, response: unknown, expected: ReturnType<typeof textMessage>, scheduledAt: number | null): Promise<Verification> {
    const id = z.object({ id: EntityIdSchema }).safeParse(response);
    if (!id.success) return unconfirmed;
    const row = await findMessage(target, id.data.id, 0);
    if (!row || row.type !== "text" || row.message !== expected.message || row.to !== expected.to
      || !sameId(row.id_channel, target.channelId)) return unconfirmed;
    const when = z.iso.datetime({ offset: true }).safeParse(row.scheduled_at);
    const matches = scheduledAt === null ? row.scheduled_at === null : when.success && Date.parse(when.data) === scheduledAt;
    return matches ? { status: "observed", id: String(id.data.id) } : unconfirmed;
  }

  async function run(operation: string, target: Target, method: Leads2bHttpMethod, suffix: string, parameters: Row,
    prepare: (chat: Row) => Promise<Prepared>, confirmDestructive?: boolean) {
    const key = String(target.chatId);
    const endpoint = `/messages/chats/${key}${suffix}`;
    const source = { api: "v2", stability: "experimental", endpoint } as const;
    const plan = { operation, method, endpoint, target, parameters, mode: deps.writeMode, executed: false };
    const gate = evaluateWriteOperation({ writeMode: deps.writeMode, destructive: method === "DELETE", confirmDestructive });
    if (!gate.shouldExecute) return okResult({ ok: true, data: plan, warnings: gate.warnings, summary: "Operação planejada.", source });
    if (inFlight.has(key)) return errorResult(new Error("Já existe uma alteração em andamento para este chat."));
    inFlight.add(key);
    try {
      const prepared = await prepare(await readChat(target));
      const verify = async (response: unknown) => {
        try { return await prepared.verify(response); }
        catch (error) { return { ...unconfirmed, error: errorResult(error).structuredContent?.error }; }
      };
      let response: unknown;
      try {
        response = await deps.v2.rawRequest({ method, path: endpoint, body: prepared.body });
      } catch (error) {
        const failure = errorResult(error);
        return { ...failure, structuredContent: { ...failure.structuredContent, target,
          writeState: { requestSent: true, outcome: "unknown", automaticRetry: false }, verification: await verify(undefined) } };
      }
      const rejected = businessFailure(response);
      const verification = await verify(response);
      const outcome = rejected ? "rejected" : "request_accepted";
      const result = okResult({ ok: true, data: { ...plan, executed: true, outcome, response, verification, automaticRetry: false },
        summary: rejected ? "A API rejeitou a operação." : "Resposta recebida. Consulte o estado da releitura.", source });
      return rejected ? { ...result, isError: true, structuredContent: { ...result.structuredContent, ok: false } } : result;
    } catch (error) { return errorResult(error); }
    finally { inFlight.delete(key); }
  }
}

function textMessage(chat: Row, target: Text) {
  if (chat.channel_type !== "whatsapp" || chat.status !== "open" || chat.blocked !== false
    || chat.activeSession !== true || chat.type === "group" || chat.phone !== target.recipient) {
    throw new Error("O detalhe não confirmou uma sessão ativa de WhatsApp oficial com o destinatário informado.");
  }
  return { type: "text", id_channel: chat.last_id_channel, to: chat.phone, id_entity: chat.id_entity,
    entity: chat.entity, template: null, message: target.text };
}

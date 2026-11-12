import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EntityIdSchema } from "../../crud/schemas.js";
import type { Leads2bChatOrder } from "../../client/v2.js";
import { errorResult, okResult } from "../result.js";
import type { ReadDeps } from "./shared.js";

const ChatEntitySchema = z.literal("OPPORTUNITY");
const ChatOrderSchema = z.enum(["asc", "desc"]);

type ChatEntity = "OPPORTUNITY";
type ChatScopeRequest = { entity: ChatEntity; entityId: string | number };
type CollectionPage = {
  rows: Array<Record<string, unknown>>;
  response: unknown;
};

/**
 * The chat endpoints are internal V2 routes observed in the authenticated
 * application. They are deliberately exposed as scoped reads only. The
 * server never relates messages to an opportunity by phone number.
 */
export function registerChatTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool(
    "leads2b_list_chats",
    {
      title: "List opportunity chats",
      description: "Lista uma página de conversas vinculadas explicitamente a uma oportunidade pela API V2. O vínculo é o id da entidade informado; nenhum chat é associado por telefone. A rota é interna e experimental, e a cobertura nativa de paginação permanece não verificada.",
      inputSchema: {
        entity: ChatEntitySchema.optional(),
        id: EntityIdSchema,
        order: ChatOrderSchema.optional(),
        situation: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()
      },
      annotations: { readOnlyHint: true }
    },
    async ({ entity = "OPPORTUNITY", id, order = "desc", situation, limit = 25, offset = 0 }) => {
      const scope = { entity, entityId: id } satisfies ChatScopeRequest;
      try {
        const response = await deps.v2.listChats({
          idEntity: id,
          entity: entity.toLowerCase() as "opportunity",
          order,
          situation,
          limit,
          offset
        });
        const page = extractCollectionPage(response, "chats");
        const scopedRows = validateChatRows(page.rows, scope);
        const deduplicatedRows = deduplicateRows(scopedRows);
        const duplicateCount = scopedRows.length - deduplicatedRows.length;
        const missingIdentifiers = scopedRows.filter(row => technicalRowId(row) === undefined).length;
        return okResult({
          ok: true,
          data: {
            response,
            chats: deduplicatedRows,
            scope: inspectChatScope(scopedRows, scope),
            coverage: {
              status: "unknown",
              reason: "native_pagination_unverified",
              pagesFetched: 1,
              recordsFetched: scopedRows.length,
              recordsReturned: deduplicatedRows.length,
              duplicatesRemoved: duplicateCount,
              missingIdentifiers,
              requested: { limit, offset, order, situation }
            }
          },
          warnings: [
            "A API V2 interna pode alterar o contrato; a página e o envelope foram preservados integralmente.",
            "A cobertura total e a paginação nativa de /messages/chats não foram verificadas; consulte outras páginas explicitamente.",
            "O vínculo é restrito à entidade e ao ID informados; nenhum chat é associado por telefone.",
            ...(missingIdentifiers > 0 ? ["Um ou mais chats não têm identificador técnico; foram preservados sem deduplicação."] : [])
          ],
          summary: `Chats da oportunidade ${id}: ${deduplicatedRows.length} registro(s) na página; cobertura desconhecida.`,
          source: { api: "v2", endpoint: "/messages/chats", stability: "experimental" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_chat",
    {
      title: "Get chat",
      description: "Consulta o detalhe integral de um chat pela API V2 e confirma o ID da oportunidade solicitada. A rota é interna e experimental.",
      inputSchema: {
        chatId: EntityIdSchema,
        entity: ChatEntitySchema.optional(),
        entityId: EntityIdSchema
      },
      annotations: { readOnlyHint: true }
    },
    async ({ chatId, entity = "OPPORTUNITY", entityId }) => {
      try {
        const response = await deps.v2.getChat({ id: chatId });
        const scope = { entity, entityId } satisfies ChatScopeRequest;
        const observedScope = inspectChatScopeFromResponse(response, scope, chatId);
        return okResult({
          ok: true,
          data: { response, chat: response, scope: observedScope },
          warnings: [
            "A rota de detalhe do chat é interna e experimental; o envelope integral foi preservado.",
            "Nenhum vínculo por telefone é inferido."
          ],
          summary: `Chat ${chatId}: detalhe consultado.`,
          source: { api: "v2", endpoint: "/messages/chats/{id}", stability: "experimental" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_list_chat_messages",
    {
      title: "List chat messages",
      description: "Confirma primeiro o detalhe do chat e sua oportunidade, depois lê mensagens pela API V2, repetindo páginas estáveis até uma página vazia ou o limite informado. Preserva IDs, timestamps, direção, texto, mídia, metadados e transcrições existentes; não há associação por telefone.",
      inputSchema: {
        chatId: EntityIdSchema,
        entity: ChatEntitySchema.optional(),
        entityId: EntityIdSchema,
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
        order: ChatOrderSchema.optional(),
        maxPages: z.number().int().min(1).max(20).optional()
      },
      annotations: { readOnlyHint: true }
    },
    async ({ chatId, entity = "OPPORTUNITY", entityId, limit = 25, offset = 0, order = "desc", maxPages = 20 }) => {
      try {
        const chatResponse = await deps.v2.getChat({ id: chatId });
        const scope = inspectChatScopeFromResponse(chatResponse, { entity, entityId }, chatId);
        if (scope.verified !== "confirmed") {
          throw new Error("O detalhe do chat não confirmou simultaneamente o ID do chat, id_entity e entity; mensagens não foram consultadas.");
        }
        const collected = await collectMessagePages(deps, {
          chatId,
          limit,
          offset,
          order,
          maxPages
        });
        return okResult({
          ok: true,
          data: { ...collected, chat: chatResponse, scope },
          warnings: [
            "A rota de mensagens é interna e experimental; cada envelope recebido foi preservado em pages.",
            "Mensagens repetidas pelo mesmo identificador técnico são contadas em duplicatesRemoved; a primeira ocorrência é preservada.",
            "Nenhum vínculo por telefone é inferido. Uma cobertura partial não comprova ausência de mensagens.",
            "A paginação por offset não fornece snapshot atômico; novas mensagens podem deslocar páginas durante a coleta. complete significa fim observado, sem garantia de coleção imutável.",
            ...collected.warnings
          ],
          summary: `Chat ${chatId}: ${collected.messages.length} mensagem(ns) única(s); cobertura ${collected.coverage.status}.`,
          source: { api: "v2", endpoint: "/messages/chats/{id}/messages", stability: "experimental" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

async function collectMessagePages(
  deps: ReadDeps,
  input: { chatId: string | number; limit: number; offset: number; order: Leads2bChatOrder; maxPages: number }
) {
  const messages: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const pages: unknown[] = [];
  const warnings: string[] = [];
  let currentOffset = input.offset;
  let pagesFetched = 0;
  let rawRecordsFetched = 0;
  let duplicatesRemoved = 0;
  let missingIdentifiers = 0;
  let orderVerification: "confirmed" | "unknown" | "unstable" = "unknown";
  let previousBoundary: number | undefined;
  let reason: "empty_page" | "empty_page_after_offset" | "page_limit" | "repeated_page" | "duplicate_rows" | "missing_identifier" | "order_unverified" | "unstable_order" | "invalid_response" | "request_failed" = "page_limit";

  for (let pageIndex = 0; pageIndex < input.maxPages; pageIndex += 1) {
    let response: unknown;
    try {
      response = await deps.v2.listChatMessages({
        id: input.chatId,
        offset: currentOffset,
        limit: input.limit,
        order: input.order
      });
    } catch (error) {
      if (pagesFetched === 0) throw error;
      reason = "request_failed";
      warnings.push("Uma página posterior de mensagens falhou; as mensagens anteriores foram preservadas e a cobertura é parcial.");
      break;
    }

    pages.push(response);
    let page: CollectionPage;
    try {
      page = extractCollectionPage(response, "messages");
      validateMessageRows(page.rows, input.chatId);
    } catch (error) {
      if (pagesFetched === 0) throw error;
      reason = "invalid_response";
      warnings.push("Uma página posterior de mensagens tem envelope inválido; as mensagens anteriores foram preservadas e a cobertura é parcial.");
      break;
    }

    pagesFetched += 1;
    rawRecordsFetched += page.rows.length;
    const ordering = inspectMessageOrder(page.rows, input.order, previousBoundary);
    if (ordering.status === "unstable") {
      orderVerification = "unstable";
      reason = "unstable_order";
      warnings.push("A ordem dos timestamps entre páginas não é estável; a coleta foi interrompida para evitar um resumo fora de ordem.");
    } else if (ordering.status === "confirmed" && !(orderVerification === "unknown" && pagesFetched > 1)) {
      orderVerification = "confirmed";
      previousBoundary = ordering.boundary;
    } else {
      orderVerification = "unknown";
      warnings.push("A API não forneceu timestamps comparáveis em toda a página; a estabilidade da ordem não foi confirmada.");
    }
    const before = messages.length;
    for (const row of page.rows) {
      const key = technicalRowId(row);
      if (key === undefined) {
        messages.push(row);
        missingIdentifiers += 1;
        continue;
      }
      if (seen.has(key)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(key);
      messages.push(row);
    }
    currentOffset += page.rows.length;

    if (page.rows.length === 0) {
      if (input.offset !== 0) {
        reason = "empty_page_after_offset";
      } else if (missingIdentifiers > 0) {
        reason = "missing_identifier";
      } else if (duplicatesRemoved > 0) {
        reason = "duplicate_rows";
      } else if (orderVerification === "unstable") {
        reason = "unstable_order";
      } else if (orderVerification !== "confirmed" && messages.length > 0) {
        reason = "order_unverified";
      } else {
        reason = "empty_page";
      }
      break;
    }
    if (reason === "unstable_order") break;
    if (messages.length === before) {
      reason = "repeated_page";
      warnings.push("A API repetiu uma página sem novos identificadores técnicos; a coleta foi interrompida para evitar loop.");
      break;
    }
  }

  if (reason === "page_limit") {
    warnings.push("O limite de páginas foi atingido; a cobertura é parcial e nextOffset permite continuar a leitura.");
  }

  const complete = reason === "empty_page";
  const coverage = {
    status: complete ? "complete" as const : "partial" as const,
    reason,
    pagesFetched,
    rawRecordsFetched,
    recordsReturned: messages.length,
    duplicatesRemoved,
    missingIdentifiers,
    order: orderVerification,
    startOffset: input.offset,
    nextOffset: complete ? null : currentOffset,
    requested: { limit: input.limit, offset: input.offset, order: input.order, maxPages: input.maxPages },
    outputTruncated: false
  };

  return {
    // With one request, response is the exact upstream envelope. With more
    // requests, pages is the lossless list of envelopes rather than a merged
    // synthetic API response.
    response: pages.length === 1 ? pages[0] : { pages },
    pages,
    messages,
    coverage,
    warnings
  };
}

function extractCollectionPage(response: unknown, kind: "chats" | "messages"): CollectionPage {
  const candidates: unknown[] = [];
  if (Array.isArray(response)) candidates.push(response);
  if (response && typeof response === "object") {
    const root = response as Record<string, unknown>;
    candidates.push(root[kind], root.items, root.data);
    if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
      const nested = root.data as Record<string, unknown>;
      candidates.push(nested[kind], nested.items, nested.data);
    }
  }
  const rows = candidates.find(candidate => Array.isArray(candidate)) as unknown[] | undefined;
  if (!rows || !rows.every(isRecord)) {
    throw new Error(`Formato inesperado em /messages/chats: a resposta não contém uma lista de ${kind}.`);
  }
  return { rows, response };
}

function validateChatRows(rows: Array<Record<string, unknown>>, scope: ChatScopeRequest): Array<Record<string, unknown>> {
  for (const row of rows) {
    const observedId = scopeValue([row], ["id_entity", "entity_id", "idEntity", "opportunity_id"]);
    const observedEntity = scopeValue([row], ["entity", "entity_type", "entityType"], normalizeEntity);
    if (observedId !== undefined && String(observedId) !== String(scope.entityId)) {
      throw new Error(`Chat fora do escopo: id_entity=${String(observedId)} não corresponde à entidade ${String(scope.entityId)}.`);
    }
    if (observedEntity !== undefined && normalizeEntity(observedEntity) !== scope.entity.toLowerCase()) {
      throw new Error(`Chat fora do escopo: entity=${String(observedEntity)} não corresponde a ${scope.entity}.`);
    }
    if (observedId !== undefined && observedEntity !== undefined) continue;
    if (observedId !== undefined || observedEntity !== undefined) {
      throw new Error("Chat sem vínculo completo: a resposta precisa informar id_entity e entity juntos.");
    }
  }
  return rows;
}

function validateMessageRows(rows: Array<Record<string, unknown>>, chatId: string | number): Array<Record<string, unknown>> {
  for (const row of rows) {
    const observedChatId = scopeValue([row], ["chat_id", "id_chat", "chatId"]);
    if (observedChatId !== undefined && String(observedChatId) !== String(chatId)) {
      throw new Error(`Mensagem fora do escopo: chat_id=${String(observedChatId)} não corresponde ao chat ${String(chatId)}.`);
    }
  }
  return rows;
}

function inspectMessageOrder(
  rows: Array<Record<string, unknown>>,
  order: Leads2bChatOrder,
  previousBoundary?: number
): { status: "confirmed" | "unknown" | "unstable"; boundary?: number } {
  if (rows.length === 0) return { status: previousBoundary === undefined ? "unknown" : "confirmed", boundary: previousBoundary };
  const timestamps = rows.map(row => messageTimestamp(row));
  if (timestamps.some(value => value === undefined)) return { status: "unknown" };
  const numbers = timestamps as number[];
  for (let index = 1; index < numbers.length; index += 1) {
    const valid = order === "desc" ? numbers[index - 1] >= numbers[index] : numbers[index - 1] <= numbers[index];
    if (!valid) return { status: "unstable" };
  }
  if (previousBoundary !== undefined) {
    const boundaryValid = order === "desc" ? previousBoundary >= numbers[0] : previousBoundary <= numbers[0];
    if (!boundaryValid) return { status: "unstable" };
  }
  return { status: "confirmed", boundary: numbers[numbers.length - 1] };
}

function messageTimestamp(row: Record<string, unknown>): number | undefined {
  const value = firstValue(row, ["created_at", "createdAt", "message_date_sql", "timestamp", "date"]);
  if (value === undefined) return undefined;
  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function inspectChatScope(rows: Array<Record<string, unknown>>, requested: ChatScopeRequest) {
  const observedIds = rows.map(row => firstValue(row, ["id_entity", "entity_id", "idEntity", "opportunity_id"])).filter(value => value !== undefined);
  const observedEntities = rows.map(row => firstValue(row, ["entity", "entity_type", "entityType"])).filter(value => value !== undefined);
  const confirmedRows = rows.filter(row => firstValue(row, ["id_entity", "entity_id", "idEntity", "opportunity_id"]) !== undefined
    && firstValue(row, ["entity", "entity_type", "entityType"]) !== undefined);
  return {
    requested,
    verified: rows.length > 0 && confirmedRows.length === rows.length ? "confirmed" : "unknown",
    observedEntityIds: [...new Set(observedIds.map(String))],
    observedEntities: [...new Set(observedEntities.map(value => String(value)))]
  };
}

function inspectChatScopeFromResponse(response: unknown, requested: ChatScopeRequest, chatId: string | number) {
  const records = response && typeof response === "object" ? [response as Record<string, unknown>] : [];
  const nested = records.flatMap(record => {
    const data = record.data;
    return data && typeof data === "object" && !Array.isArray(data) ? [data as Record<string, unknown>] : [];
  });
  const all = [...records, ...nested];
  const chatKeys = ["id", "chat_id", "id_chat", "chatId"];
  const idKeys = ["id_entity", "entity_id", "idEntity", "opportunity_id"];
  const entityKeys = ["entity", "entity_type", "entityType"];
  const observedChatId = scopeValue(all, chatKeys);
  const observedId = scopeValue(all, idKeys);
  const observedEntity = scopeValue(all, entityKeys, normalizeEntity);
  const completeRecord = all.some(row => firstValue(row, chatKeys) !== undefined
    && firstValue(row, idKeys) !== undefined && firstValue(row, entityKeys) !== undefined);
  if (observedChatId !== undefined && String(observedChatId) !== String(chatId)) {
    throw new Error(`Chat fora do escopo: id=${String(observedChatId)} não corresponde ao chat ${String(chatId)}.`);
  }
  if (observedId !== undefined && String(observedId) !== String(requested.entityId)) {
    throw new Error(`Chat fora do escopo: id_entity=${String(observedId)} não corresponde à entidade ${String(requested.entityId)}.`);
  }
  if (observedEntity !== undefined && normalizeEntity(observedEntity) !== requested.entity.toLowerCase()) {
    throw new Error(`Chat fora do escopo: entity=${String(observedEntity)} não corresponde a ${requested.entity}.`);
  }
  if ((observedId === undefined) !== (observedEntity === undefined)) {
    throw new Error("Chat sem vínculo completo: a resposta precisa informar id_entity e entity juntos.");
  }
  return {
    requested,
    verified: completeRecord ? "confirmed" : "unknown",
    observedChatId: observedChatId === undefined ? null : String(observedChatId),
    observedEntityId: observedId === undefined ? null : String(observedId),
    observedEntity: observedEntity === undefined ? null : String(observedEntity)
  };
}

function deduplicateRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = technicalRowId(row);
    if (key === undefined) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function technicalRowId(row: Record<string, unknown>): string | undefined {
  const id = firstValue(row, ["id", "message_id", "uuid"]);
  if (typeof id === "string" && id.trim()) return id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? String(id) : undefined;
}

function firstValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key];
  return undefined;
}

function scopeValue(rows: Array<Record<string, unknown>>, keys: string[], normalize: (value: unknown) => string = String): unknown {
  const values = rows.flatMap(row => keys.map(key => row[key])).filter(value => value !== undefined && value !== null);
  if (new Set(values.map(normalize)).size > 1) throw new Error("Campos de vínculo divergentes no retorno do chat.");
  return values[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeEntity(value: unknown): string {
  return String(value).trim().toLowerCase();
}

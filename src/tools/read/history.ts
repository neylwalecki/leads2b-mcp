import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EntityIdSchema } from "../../crud/schemas.js";
import { errorResult, okResult } from "../result.js";
import type { ReadDeps } from "./shared.js";

export function registerHistoryTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool("leads2b_list_history", {
    title: "List history",
    description: "Solicita uma página do histórico de lead ou oportunidade via GET v1 /history/index/. limit (padrão 25) e offset (padrão 0) são enviados à API. Preserva o envelope integral; paginação nativa e cobertura total não verificadas. Não cria anotação nem atividade.",
    inputSchema: {
      entity: z.enum(["LEAD", "OPPORTUNITY"]),
      id: EntityIdSchema,
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()
    },
    annotations: { readOnlyHint: true }
  }, async ({ entity, id, limit = 25, offset = 0 }) => {
    try {
      const response = await deps.v1.rawRequest({
        method: "GET", path: "/history/index/", query: { entity, id_entity: id, limit, offset }
      });
      return okResult({
        ok: true,
        data: { response, coverage: {
          status: "unknown", reason: "native_pagination_unverified", requested: { limit, offset }
        } },
        summary: "History: resposta da página solicitada recebida; cobertura total desconhecida.",
        warnings: ["limit/offset são solicitados à API; respeitar esses parâmetros e esgotar o histórico não foram verificados. Não interprete ausência como histórico vazio."],
        source: { api: "v1", endpoint: "/history/index/", stability: "observed" }
      });
    } catch (error) { return errorResult(error); }
  });
}

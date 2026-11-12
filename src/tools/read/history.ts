import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EntityIdSchema } from "../../crud/schemas.js";
import { errorResult, okResult } from "../result.js";
import { readErrorResult } from "./failure.js";
import type { ReadDeps } from "./shared.js";

export function registerHistoryTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool("leads2b_list_history", {
    title: "List history",
    description: "Solicita uma página do histórico via GET v1 /history/index/. Filtros opcionais type (comment/action/tracking), unfinished e pinned. limit (padrão 25) e offset (padrão 0) são enviados à API. Preserva o envelope integral; cobertura total não verificada. Filtros internos experimentais. Não cria anotação nem atividade.",
    inputSchema: {
      entity: z.enum(["LEAD", "OPPORTUNITY"]),
      id: EntityIdSchema,
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
      type: z.enum(["comment", "action", "tracking"]).optional(),
      unfinished: z.boolean().optional(),
      pinned: z.boolean().optional()
    },
    annotations: { readOnlyHint: true }
  }, async ({ entity, id, limit = 25, offset = 0, type, unfinished, pinned }) => {
    try {
      const response = await deps.v1.listHistory({ entity, id, limit, offset, type, unfinished, pinned });
      return okResult({
        ok: true,
        data: { response, coverage: {
          status: "unknown", reason: "native_pagination_unverified", requested: { limit, offset }
        } },
        summary: "History: resposta da página solicitada recebida; cobertura total desconhecida.",
        warnings: ["limit/offset são solicitados à API; respeitar esses parâmetros e esgotar o histórico não foram verificados. Não interprete ausência como histórico vazio."],
        source: { api: "v1", endpoint: "/history/index/", stability: "observed" }
      });
    } catch (error) {
      return readErrorResult(error, {
        api: "v1", method: "GET", endpoint: "/history/index/", entity, id, limit, offset,
        ...(type === undefined ? {} : { type }), ...(unfinished === undefined ? {} : { unfinished }), ...(pinned === undefined ? {} : { pinned })
      });
    }
  });

  server.registerTool("leads2b_list_activities", {
    title: "List planned activities",
    description: "Consulta atividades do negócio via GET v1 /history/activities/. Contrato interno experimental. Preserva o envelope, inclusive pendências e campos desconhecidos; não afirma cobertura completa nem altera o estado de atividades.",
    inputSchema: { entity: z.enum(["LEAD", "OPPORTUNITY"]), id: EntityIdSchema },
    annotations: { readOnlyHint: true }
  }, async ({ entity, id }) => {
    try {
      const response = await deps.v1.listActivities({ entity, id });
      return okResult({ ok: true, data: { response, coverage: { status: "unknown", reason: "native_pagination_unverified" } },
        summary: "Atividades consultadas; cobertura total desconhecida.",
        source: { api: "v1", endpoint: "/history/activities/", stability: "experimental" } });
    } catch (error) { return readErrorResult(error, { api: "v1", method: "GET", endpoint: "/history/activities/", entity, id }); }
  });

  server.registerTool("leads2b_list_pipeline_responsible_users", {
    title: "List active pipeline responsible users",
    description: "Lista responsáveis ativos do funil via V1. Use o funil do negócio para escolher receiver; a lista global de usuários não comprova elegibilidade. Contrato interno experimental.",
    inputSchema: { pipelineId: EntityIdSchema },
    annotations: { readOnlyHint: true }
  }, async ({ pipelineId }) => {
    try {
      return okResult({ ok: true, data: await deps.v1.listPipelineResponsibleUsers({ pipelineId }),
        summary: "Responsáveis ativos do funil consultados.",
        source: { api: "v1", endpoint: "/pipeline/responsible_users/{pipelineId}/active", stability: "experimental" } });
    } catch (error) { return errorResult(error); }
  });
}

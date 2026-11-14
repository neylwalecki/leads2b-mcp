import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Leads2bV1Client } from "../client/v1.js";
import type { Leads2bWriteMode } from "../config.js";
import { EntityIdSchema } from "../crud/schemas.js";
import { evaluateWriteOperation } from "../safety/write-gates.js";
import { errorResult, okResult } from "./result.js";
import { historyPreflight, readHistoryState, verifyHistoryEffect, type HistoryState } from "./history-effects.js";
import { businessFailure, historyEntity, nonBlankText, requireLoggedUser, timestamp } from "./deal-action-support.js";
import { ACTIVITY_TRANSITION_TOOL_NAMES, registerActivityTransitionTools } from "./activity-transitions.js";

const confirmation = { confirm_destructive: z.boolean().optional() };
const historyBase = { entity: historyEntity, id: EntityIdSchema, message: nonBlankText, id_pipeline_item: EntityIdSchema.optional() };
const actions = [
  { name: "leads2b_win_opportunity", kind: "win", description: "Marca oportunidade como ganha, sem clonar nem criar pós-venda", schema: z.object({ id: EntityIdSchema, ...confirmation }).strict() },
  { name: "leads2b_lose_opportunity", kind: "lose", description: "Marca oportunidade como perdida com motivo, sem clonar, reativar lead ou encerrar workflows", schema: z.object({ id: EntityIdSchema, id_loss: EntityIdSchema, loss_reason: z.string().trim().min(1), ...confirmation }).strict() },
  { name: "leads2b_create_note", kind: "note", description: "Escolha esta operação para guardar um resumo como nota, sem planejar atividade. Preserva o texto exato e verifica o histórico", schema: z.object(historyBase).strict() },
  { name: "leads2b_create_activity", kind: "activity", description: "Escolha esta operação para planejar o próximo passo com texto, responsável, tipo e data explícitos. Consulte os tipos e responsáveis ativos do funil. Aceita assunto opcional separado da descrição. Sem convite ou evento de agenda", schema: z.object({ ...historyBase, receiver: EntityIdSchema, action: EntityIdSchema, data: timestamp, final_date: timestamp.optional(), action_type_label: nonBlankText.optional() }).strict() }
] as const;
export const DEAL_ACTION_TOOL_NAMES = [...actions.map(action => action.name), ...ACTIVITY_TRANSITION_TOOL_NAMES];

type ActionInput = { id: string | number; entity?: "LEAD" | "OPPORTUNITY"; message?: string; id_pipeline_item?: string | number; receiver?: string | number; action?: string | number; data?: string; final_date?: string; action_type_label?: string; id_loss?: string | number; loss_reason?: string; confirm_destructive?: boolean };

type Deps = { v1: Pick<Leads2bV1Client, "rawRequest" | "getLoggedUser" | "createHistory">; writeMode: Leads2bWriteMode };

export function registerDealActionTools(server: McpServer, deps: Deps): void {
  if (deps.writeMode === "disabled") return;
  registerActivityTransitionTools(server, deps);
  actions.forEach(({ name, kind, description, schema }) => {
    const history = kind === "note" || kind === "activity";
    server.registerTool(name, {
      description: `${description}. Contrato interno experimental. Respeita write-mode; ganho/perda exigem confirm_destructive=true. Sem retry de mutação; releitura não prova resultado comercial.`,
      inputSchema: schema,
      annotations: { readOnlyHint: false, destructiveHint: !history, idempotentHint: false, openWorldHint: true }
    }, async (input: Record<string, unknown>) => {
      let requestSent = false;
      let readRequest: Parameters<Deps["v1"]["rawRequest"]>[0] | undefined;
      let historyBody: Record<string, unknown> | undefined;
      let before: HistoryState | undefined;
      try {
        const fields = schema.parse(input) as ActionInput;
        if (fields.final_date && fields.final_date < fields.data!) throw new Error("final_date deve ser igual ou posterior a data.");
        const gate = evaluateWriteOperation({ writeMode: deps.writeMode, destructive: !history, confirmDestructive: fields.confirm_destructive === true });
        const endpoint = history ? "/history/index/" : kind === "win" ? `/opportunity/winOpportunity/${fields.id}` : "/opportunity/opportunityLost";
        const source = { api: "v1", endpoint, stability: "experimental" } as const;
        const body = kind === "win" ? { cloneOpportunity: "NOT_CLONE", createAfterSale: "false", afterSalePipeline: null, idRouter: null, idUser: null }
          : kind === "lose" ? { id_opportunity: fields.id, id_loss: fields.id_loss, exclusion_reason: fields.loss_reason, cloning_opportunity: false, finishWorkflowInstances: false, reactivate_lead: false }
          : { entity: fields.entity, id_entity: fields.id, option: kind === "note" ? "comment" : "action", message: fields.message,
            ...(fields.id_pipeline_item === undefined ? {} : { id_pipeline_item: fields.id_pipeline_item }),
            ...(kind === "activity" ? { receiver: fields.receiver, action: fields.action, data: fields.data, final_date: fields.final_date ?? null,
              ...(fields.action_type_label === undefined ? {} : { action_type_label: fields.action_type_label }) } : {}) };
        const plan = { operation: name, api: "v1", method: history ? "POST" : "PUT", endpoint, body,
          ...(history ? { encoding: "application/x-www-form-urlencoded", envelope: "data", receiverBasis: kind === "note" ? "logged_user_at_execution" : "explicit" } : {}),
          ...(history ? { verificationPlan: { before: "Check the requested entity for matching text and fields; stop on a possible duplicate or unreadable response.",
            after: "Match the returned ID, entity, exact text and fields in history; activities also require the planned list with pending status.",
            historyLimit: 100, uniqueness: "unverified", automaticRetry: false } } : {}),
          mode: deps.writeMode, executed: false };
        if (!gate.shouldExecute) return okResult({ ok: true, data: plan, warnings: gate.warnings, summary: "Operação planejada; nenhuma alteração enviada.", source });
        const userId = await requireLoggedUser(deps.v1, endpoint);
        if (kind === "note") Object.assign(body, { receiver: userId });
        if (history) {
          historyBody = body;
          before = await readHistoryState(deps.v1, body);
          const preflight = historyPreflight(before, body);
          if (!preflight.readable || preflight.possibleDuplicates.length > 0) {
            const blocked = okResult({ ok: true, data: { ...plan, outcome: "not_sent", preflight, readback: before },
              summary: "Nenhuma alteração enviada: concilie a leitura ou a possível duplicidade antes de criar.",
              warnings: ["A verificação é limitada ao recorte lido e não garante idempotência global."], source });
            return { ...blocked, isError: true, structuredContent: { ...blocked.structuredContent, ok: false } };
          }
        }
        readRequest = history ? { method: "GET", path: "/history/index/", query: { entity: fields.entity, id_entity: fields.id, limit: 25, offset: 0 } }
          : { method: "GET", path: `/opportunity/index/${fields.id}` };
        requestSent = true;
        const result = history ? await deps.v1.createHistory(body) : await deps.v1.rawRequest({ method: "PUT", path: endpoint, body });
        const rejected = businessFailure(result);
        const historyReadback = history ? await readHistoryState(deps.v1, body) : undefined;
        const readback = historyReadback ?? await reread(deps.v1, readRequest);
        const verification = historyReadback ? verifyHistoryEffect(historyReadback, body, result, before) : undefined;
        const response = okResult({ ok: true, data: { ...plan, executed: true, outcome: rejected ? "rejected" : "request_accepted", result, readback, ...(verification ? { verification } : {}) },
          warnings: ["Contrato experimental. Resposta aceita não comprova persistência; confira a verificação e a releitura antes de repetir.", ...(history ? ["Histórico limitado a 100 registros; cobertura e unicidade global desconhecidas. Nenhum retry automático."] : [])],
          summary: rejected ? "Solicitação rejeitada pela API; confira a releitura." : "Solicitação aceita; estado observado na releitura disponível.", source });
        return rejected ? { ...response, isError: true, structuredContent: { ...response.structuredContent, ok: false } } : response;
      } catch (error) {
        const failure = errorResult(error);
        if (!requestSent || !readRequest) return failure;
        const readback = historyBody ? await readHistoryState(deps.v1, historyBody) : await reread(deps.v1, readRequest);
        return { ...failure, structuredContent: { ...failure.structuredContent,
          writeState: { requestSent: true, outcome: "unknown", automaticRetry: false }, readback,
          ...(historyBody ? { target: { entity: historyBody.entity, id: historyBody.id_entity }, requested: historyBody } : {}),
          warnings: ["Erro não comprova rollback. Confira a releitura antes de repetir."] } };
      }
    });
  });
}

async function reread(client: Deps["v1"], request: Parameters<Deps["v1"]["rawRequest"]>[0]) {
  try { return { status: "fetched", endpoint: request.path, result: await client.rawRequest(request) }; }
  catch (error) { return { status: "failed", endpoint: request.path, error: error instanceof Error ? error.message : "Falha de releitura." }; }
}

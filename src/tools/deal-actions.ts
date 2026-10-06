import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Leads2bV1Client } from "../client/v1.js";
import type { Leads2bWriteMode } from "../config.js";
import { Leads2bHttpError } from "../client/http.js";
import { EntityIdSchema } from "../crud/schemas.js";
import { evaluateWriteOperation } from "../safety/write-gates.js";
import { errorResult, okResult } from "./result.js";

const confirmation = { confirm_destructive: z.boolean().optional() };
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/).refine(value => {
  const parsed = new Date(value.replace(" ", "T") + "Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 19).replace("T", " ") === value;
}, "Use uma data válida no formato YYYY-MM-DD HH:mm:ss, no horário da conta.");
const historyBase = { entity: z.enum(["LEAD", "OPPORTUNITY"]), id: EntityIdSchema, message: z.string().trim().min(1), id_pipeline_item: EntityIdSchema.optional() };
const actions = [
  { name: "leads2b_win_opportunity", kind: "win", description: "Marca oportunidade como ganha, sem clonar nem criar pós-venda", schema: z.object({ id: EntityIdSchema, ...confirmation }).strict() },
  { name: "leads2b_lose_opportunity", kind: "lose", description: "Marca oportunidade como perdida com motivo, sem clonar, reativar lead ou encerrar workflows", schema: z.object({ id: EntityIdSchema, id_loss: EntityIdSchema, loss_reason: z.string().trim().min(1), ...confirmation }).strict() },
  { name: "leads2b_create_note", kind: "note", description: "Cria anotação no histórico do negócio", schema: z.object(historyBase).strict() },
  { name: "leads2b_create_activity", kind: "activity", description: "Registra atividade no histórico com responsável, tipo e data explícitos", schema: z.object({ ...historyBase, receiver: EntityIdSchema, action: EntityIdSchema, data: timestamp, final_date: timestamp.optional() }).strict() }
] as const;
export const DEAL_ACTION_TOOL_NAMES = actions.map(action => action.name);

type ActionInput = { id: string | number; entity?: "LEAD" | "OPPORTUNITY"; message?: string; id_pipeline_item?: string | number; receiver?: string | number; action?: string | number; data?: string; final_date?: string; id_loss?: string | number; loss_reason?: string; confirm_destructive?: boolean };

type Deps = { v1: Pick<Leads2bV1Client, "rawRequest" | "getLoggedUser" | "createHistory">; writeMode: Leads2bWriteMode };

export function registerDealActionTools(server: McpServer, deps: Deps): void {
  if (deps.writeMode === "disabled") return;
  actions.forEach(({ name, kind, description, schema }) => {
    const history = kind === "note" || kind === "activity";
    server.registerTool(name, {
      description: `${description}. Contrato interno observado no frontend público, sem validação live. Respeita write-mode; ganho/perda exigem confirm_destructive=true. Sem retry de mutação; releitura não prova resultado comercial.`,
      inputSchema: schema.shape,
      annotations: { readOnlyHint: false, destructiveHint: !history, idempotentHint: false, openWorldHint: true }
    }, async (input: Record<string, unknown>) => {
      let requestSent = false;
      let readRequest: Parameters<Deps["v1"]["rawRequest"]>[0] | undefined;
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
            ...(kind === "activity" ? { receiver: fields.receiver, action: fields.action, data: fields.data, final_date: fields.final_date ?? null } : {}) };
        const plan = { operation: name, api: "v1", method: history ? "POST" : "PUT", endpoint, body,
          ...(history ? { encoding: "application/x-www-form-urlencoded", envelope: "data", receiverBasis: kind === "note" ? "logged_user_at_execution" : "explicit" } : {}),
          mode: deps.writeMode, executed: false };
        if (!gate.shouldExecute) return okResult({ ok: true, data: plan, warnings: gate.warnings, summary: "Operação planejada; nenhuma alteração enviada.", source });
        const logged = await deps.v1.getLoggedUser() as { data?: { user?: unknown } };
        const user = Array.isArray(logged?.data?.user) ? logged.data.user[0] : logged?.data?.user;
        if (!user || typeof user !== "object" || !("id" in user) || !user.id) throw new Leads2bHttpError({ endpoint, code: "LEADS2B_USER_CONTEXT_REQUIRED", message: "Operação exige contexto de usuário v1 autorizado; nenhuma mutação enviada." });
        if (kind === "note") Object.assign(body, { receiver: user.id });
        readRequest = history ? { method: "GET", path: "/history/index/", query: { entity: fields.entity, id_entity: fields.id, limit: 25, offset: 0 } }
          : { method: "GET", path: `/opportunity/index/${fields.id}` };
        requestSent = true;
        const result = history ? await deps.v1.createHistory(body) : await deps.v1.rawRequest({ method: "PUT", path: endpoint, body });
        const rejected = businessFailure(result);
        const readback = await reread(deps.v1, readRequest);
        const response = okResult({ ok: true, data: { ...plan, executed: true, outcome: rejected ? "rejected" : "request_accepted", result, readback },
          warnings: ["Contrato experimental. Resposta aceita e releitura não comprovam conclusão comercial; confira o estado retornado antes de repetir.", ...(history ? ["Releitura do histórico limitada a 25 registros; não é prova de unicidade nem coleta completa."] : [])],
          summary: rejected ? "Solicitação rejeitada pela API; confira a releitura." : "Solicitação aceita; estado observado na releitura disponível.", source });
        return rejected ? { ...response, isError: true, structuredContent: { ...response.structuredContent, ok: false } } : response;
      } catch (error) {
        const failure = errorResult(error);
        if (!requestSent || !readRequest) return failure;
        return { ...failure, structuredContent: { ...failure.structuredContent,
          writeState: { requestSent: true, outcome: "unknown", automaticRetry: false }, readback: await reread(deps.v1, readRequest),
          warnings: ["Erro não comprova rollback. Confira a releitura antes de repetir."] } };
      }
    });
  });
}

async function reread(client: Deps["v1"], request: Parameters<Deps["v1"]["rawRequest"]>[0]) {
  try { return { status: "fetched", endpoint: request.path, result: await client.rawRequest(request) }; }
  catch (error) { return { status: "failed", endpoint: request.path, error: error instanceof Error ? error.message : "Falha de releitura." }; }
}

// Known rejection codes observed in the frontend; informational text is not an error.
const rejectionCodes = new Set(["time_unavailable", "required_activity_type", "pipeline_item_activities_required", "opportunity_value_required", "date_earlier"]);
function businessFailure(result: unknown): boolean {
  if (typeof result === "string") return rejectionCodes.has(result);
  if (!result || typeof result !== "object") return false;
  const value = result as Record<string, unknown>;
  return value.success === false || value.ok === false || value.status === false || Boolean(value.error)
    || (typeof value.message === "string" && rejectionCodes.has(value.message))
    || (value.data !== undefined && businessFailure(value.data));
}

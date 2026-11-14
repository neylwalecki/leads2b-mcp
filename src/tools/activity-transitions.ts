import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Leads2bV1Client } from "../client/v1.js";
import type { Leads2bWriteMode } from "../config.js";
import { EntityIdSchema } from "../crud/schemas.js";
import { evaluateWriteOperation } from "../safety/write-gates.js";
import { businessFailure, historyEntity, nonBlankText, requireLoggedUser, timestamp } from "./deal-action-support.js";
import { historyRows, readHistoryState, type HistoryState } from "./history-effects.js";
import { errorResult, okResult } from "./result.js";

const RESCHEDULE = "leads2b_reschedule_activity";
const COMPLETE = "leads2b_complete_activity";
export const ACTIVITY_TRANSITION_TOOL_NAMES = [RESCHEDULE, COMPLETE] as const;

const targetSchema = z.strictObject({
  entity: historyEntity,
  id: EntityIdSchema.describe("ID do lead ou da oportunidade."),
  activity_id: EntityIdSchema.describe("ID do item de atividade no histórico."),
  close_description: nonBlankText
});
const rescheduleSchema = targetSchema.extend({ action_date: timestamp });
const completeSchema = targetSchema.extend({ close_date: timestamp });
type Target = z.infer<typeof targetSchema>;
type Transition =
  | { status: "reschedule"; action_date: string; close_description: string }
  | { status: "done"; done: true; close_date: string; close_description: string };
type Row = Record<string, unknown>;
type Deps = { v1: Pick<Leads2bV1Client, "rawRequest" | "getLoggedUser">; writeMode: Leads2bWriteMode };

const preservedFields = ["history_message", "action_type_label", "id_action", "id_user_to"] as const;
const noExternal: ReadonlySet<unknown> = new Set([false, 0, "0", ""]);
const hasExternalLink = (row: Row) => row.external_id != null && row.external_id !== ""
  || row.external != null && !noExternal.has(row.external);
const activityDate = (row: Row) => row.action_date_sql ?? row.action_date;
const sameId = (value: unknown, id: string | number) => EntityIdSchema.safeParse(value).success && String(value) === String(id);
const isDone = (row: Row) => row.done === true || row.done === 1 || row.done === "1";

function activityRows(state: HistoryState, target: Target) {
  const history = state.history.status === "fetched" ? historyRows(state.history.result, "history") : undefined;
  const planned = state.activities?.status === "fetched" ? historyRows(state.activities.result, "activities") : undefined;
  return {
    history: history?.filter(row => sameId(row.id, target.activity_id)),
    planned: planned?.filter(row => sameId(row.id, target.activity_id))
  };
}

function matchesTarget(row: Row | undefined, target: Target): row is Row {
  return row !== undefined && row.history_type === "action"
    && typeof row.entity === "string" && row.entity.toUpperCase() === target.entity
    && sameId(row.id_entity, target.id) && !hasExternalLink(row);
}

function isSameField(field: typeof preservedFields[number], before: Row, after: Row) {
  const value = before[field];
  return (field === "id_action" || field === "id_user_to") && EntityIdSchema.safeParse(value).success
    ? sameId(after[field], String(value)) : Object.is(value, after[field]);
}

function duration(row: Row): number | null | undefined {
  const start = activityDate(row);
  const end = row.final_date;
  if (!timestamp.safeParse(start).success) return undefined;
  if (end == null || end === "") return null;
  if (!timestamp.safeParse(end).success || String(end) < String(start)) return undefined;
  // Treat the CRM's naive timestamps as wall time when comparing durations.
  return Date.parse(String(end).replace(" ", "T") + "Z") - Date.parse(String(start).replace(" ", "T") + "Z");
}

function verifyTransition(state: HistoryState, target: Target, change: Transition, before: Row) {
  const rows = activityRows(state, target);
  const row = rows.history?.length === 1 ? rows.history[0] : undefined;
  const fields = matchesTarget(row, target) ? {
    preserved: preservedFields.every(field => isSameField(field, before, row)),
    reason: row.close_description === change.close_description,
    status: row.status === change.status,
    dates: change.status === "reschedule"
      ? activityDate(row) === change.action_date && duration(row) === duration(before)
      : row.close_date === change.close_date && activityDate(row) === activityDate(before) && row.final_date === before.final_date,
    state: change.status === "reschedule" ? row.close_date === null && !isDone(row) : isDone(row)
  } : undefined;
  const planned = rows.planned;
  const plannedMatches = planned !== undefined && (change.status === "reschedule"
    ? planned.length === 1 && planned[0].close_date === null && activityDate(planned[0]) === change.action_date
    : planned.length === 0 || (planned.length === 1 && planned[0].close_date === change.close_date));
  return {
    status: fields && Object.values(fields).every(Boolean) && plannedMatches ? "observed" : "unconfirmed",
    history: { occurrences: rows.history?.length ?? null, fields: fields ?? null },
    planned: { occurrences: planned?.length ?? null, matches: plannedMatches },
    coverage: state.coverage,
    automaticRetry: false
  };
}

export function registerActivityTransitionTools(server: McpServer, deps: Deps): void {
  const inFlight = new Set<string>();
  const context = "Exige atividade comum aberta e vínculo explícito com o negócio. Rota interna experimental.";
  const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
  server.registerTool(RESCHEDULE, {
    description: `Reagenda uma atividade existente preservando sua duração. ${context}`,
    inputSchema: rescheduleSchema, annotations
  }, ({ action_date, ...target }) => run(RESCHEDULE, target, {
    status: "reschedule", action_date, close_description: target.close_description
  }));
  server.registerTool(COMPLETE, {
    description: `Conclui uma atividade existente e registra a data e o motivo. ${context}`,
    inputSchema: completeSchema, annotations
  }, ({ close_date, ...target }) => run(COMPLETE, target, {
    status: "done", done: true, close_date, close_description: target.close_description
  }));

  async function run(operation: string, target: Target, body: Transition) {
    const activityId = String(target.activity_id);
    const endpoint = `/history/index/${activityId}`;
    const source = { api: "v1", endpoint, stability: "experimental" } as const;
    const scope = { entity: target.entity, id: target.id, activity_id: target.activity_id };
    const plan = { operation, api: "v1", method: "PUT", endpoint, mode: deps.writeMode, target: scope, body, executed: false };
    const gate = evaluateWriteOperation({ writeMode: deps.writeMode, destructive: false });
    if (!gate.shouldExecute) {
      return okResult({ ok: true, data: plan, summary: "Operação planejada.", warnings: gate.warnings, source });
    }
    const read = () => readHistoryState(deps.v1, { entity: target.entity, id_entity: target.id, option: "action" });
    const stop = (reason: string, readback?: HistoryState) => {
      const response = okResult({ ok: true, data: { ...plan, outcome: "not_sent", reason, readback }, summary: reason, source });
      return { ...response, isError: true, structuredContent: { ...response.structuredContent, ok: false } };
    };
    if (inFlight.has(activityId)) return stop("Já existe uma transição em andamento para esta atividade.");
    inFlight.add(activityId);
    try {
      await requireLoggedUser(deps.v1, endpoint);
      const before = await read();
      const rows = activityRows(before, target);
      const row = rows.history?.length === 1 ? rows.history[0] : undefined;
      const planned = rows.planned?.length === 1 ? rows.planned[0] : undefined;
      if (!matchesTarget(row, target) || row.close_date !== null || isDone(row) || (row.status !== "pending" && row.status !== "reschedule")
        || !planned || planned.close_date !== null || activityDate(planned) !== activityDate(row)
        || duration(row) === undefined) {
        return stop("A releitura precisa confirmar uma atividade comum aberta, com ID, vínculo e data consistentes no histórico e em Planejado.", before);
      }
      if (body.status === "reschedule" && activityDate(row) === body.action_date) {
        return stop("A atividade já está na data e hora solicitadas.", before);
      }

      let result: unknown;
      try {
        result = await deps.v1.rawRequest({ method: "PUT", path: endpoint, body });
      } catch (error) {
        const failure = errorResult(error);
        const readback = await read();
        return { ...failure, structuredContent: { ...failure.structuredContent, target: scope, requested: body,
          writeState: { requestSent: true, outcome: "unknown", automaticRetry: false },
          readback, verification: verifyTransition(readback, target, body, row) } };
      }

      const rejected = businessFailure(result);
      const readback = await read();
      const verification = verifyTransition(readback, target, body, row);
      const outcome = rejected ? "rejected" : "request_accepted";
      const summary = rejected ? "A API rejeitou a transição." : verification.status === "observed"
        ? "Transição confirmada no histórico e em Planejado." : "A resposta foi recebida. A releitura ainda não confirmou a transição.";
      const response = okResult({ ok: true, data: { ...plan, executed: true, outcome, result, readback, verification }, summary, source });
      return rejected ? { ...response, isError: true, structuredContent: { ...response.structuredContent, ok: false } } : response;
    } catch (error) {
      return errorResult(error);
    } finally {
      inFlight.delete(activityId);
    }
  }
}

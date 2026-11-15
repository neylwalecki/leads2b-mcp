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
const ATTEMPT = "leads2b_record_activity_attempt";
const REMOVE = "leads2b_delete_activity";
const CLOSE_WITHOUT_GOAL = "leads2b_close_activity_without_goal";
export const ACTIVITY_TRANSITION_TOOL_NAMES = [RESCHEDULE, COMPLETE, ATTEMPT, REMOVE, CLOSE_WITHOUT_GOAL] as const;

const targetSchema = z.strictObject({
  entity: historyEntity,
  id: EntityIdSchema.describe("ID do lead ou da oportunidade."),
  activity_id: EntityIdSchema.describe("ID do item de atividade no histórico.")
});
const transitionSchema = targetSchema.extend({ close_description: nonBlankText });
const rescheduleSchema = transitionSchema.extend({ action_date: timestamp });
const completeSchema = transitionSchema.extend({ close_date: timestamp });
const removeSchema = targetSchema.extend({ reason: nonBlankText.optional(), confirm_destructive: z.boolean().optional() });
type Target = z.infer<typeof targetSchema>;
type Transition =
  | { status: "reschedule"; action_date: string; close_description: string }
  | { status: "tried"; action_date: string; close_description: string }
  | { status: "done"; done: true; close_date: string; close_description: string }
  | { status: "unfinishedGoal"; done: false; close_date: string; close_description: string };
type Change = Transition | { reason: string | undefined };
type Row = Record<string, unknown>;
type Deps = { v1: Pick<Leads2bV1Client, "rawRequest" | "getLoggedUser">; writeMode: Leads2bWriteMode };

const preservedFields = ["history_message", "action_type_label", "id_action", "id_user_to"] as const;
const noExternal: ReadonlySet<unknown> = new Set([false, 0, "0", ""]);
const hasExternalLink = (row: Row) => row.external_id != null && row.external_id !== ""
  || row.external != null && !noExternal.has(row.external);
const activityDate = (row: Row) => row.action_date_sql ?? row.action_date;
const sameId = (value: unknown, id: string | number) => EntityIdSchema.safeParse(value).success && String(value) === String(id);
const isDone = (row: Row) => row.done === true || row.done === 1 || row.done === "1";
const isNotDone = (row: Row) => row.done === false || row.done === 0 || row.done === "0";

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

function attemptComments(row: Row): Row[] | undefined {
  const comments = row.parentComments;
  if (!Array.isArray(comments) || !comments.every(comment => comment && typeof comment === "object" && !Array.isArray(comment))) return undefined;
  return comments as Row[];
}

function matchesAttempt(comment: Row, target: Target, change: Extract<Transition, { status: "tried" }>) {
  return comment.history_type === "comment" && comment.status === "tried"
    && typeof comment.entity === "string" && comment.entity.toUpperCase() === target.entity
    && sameId(comment.id_entity, target.id) && sameId(comment.id_parent, target.activity_id)
    && comment.history_message === change.close_description && activityDate(comment) === change.action_date;
}

function verifyAttempt(state: HistoryState, target: Target, change: Extract<Transition, { status: "tried" }>, before: Row,
  userId: string | number, response: unknown) {
  const rows = activityRows(state, target);
  const current = rows.history?.length === 1 ? rows.history[0] : undefined;
  const priorComments = attemptComments(before);
  const comments = current && attemptComments(current);
  const matches = comments?.filter(comment => matchesAttempt(comment, target, change));
  const comment = matches?.length === 1 ? matches[0] : undefined;
  const id = EntityIdSchema.safeParse(comment?.id);
  const uniqueNewComment = id.success && priorComments !== undefined
    && !sameId(id.data, target.activity_id) && !priorComments.some(row => sameId(row.id, id.data))
    && comments?.filter(row => sameId(row.id, id.data)).length === 1;
  const returnedId = response && typeof response === "object" && "new_history_id" in response ? response.new_history_id : undefined;
  const responseMatches = returnedId === undefined ? null : id.success && sameId(returnedId, id.data);
  const parentPreserved = matchesTarget(current, target) && preservedFields.every(field => isSameField(field, before, current))
    && current.status === before.status && current.done === before.done && current.close_date === before.close_date
    && current.close_description === before.close_description
    && activityDate(current) === activityDate(before) && current.final_date === before.final_date;
  const planned = rows.planned?.length === 1 ? rows.planned[0] : undefined;
  const plannedPreserved = planned?.close_date === null && activityDate(planned) === activityDate(before);
  return {
    status: uniqueNewComment && responseMatches !== false && parentPreserved && plannedPreserved ? "observed" : "unconfirmed",
    attempt: { id: uniqueNewComment ? String(id.data) : null, matchingComments: matches?.length ?? null, responseMatches, requestedBy: userId },
    history: { occurrences: rows.history?.length ?? null, parentPreserved },
    planned: { occurrences: rows.planned?.length ?? null, parentPreserved: plannedPreserved },
    coverage: state.coverage, automaticRetry: false
  };
}

function verifyTransition(state: HistoryState, target: Target, change: Change, before: Row, userId: string | number, response?: unknown) {
  const rows = activityRows(state, target);
  if ("reason" in change) {
    return {
      status: rows.history?.length === 0 && rows.planned?.length === 0 ? "absent_in_readback" : "unconfirmed",
      history: { occurrences: rows.history?.length ?? null }, planned: { occurrences: rows.planned?.length ?? null },
      coverage: state.coverage, automaticRetry: false
    };
  }
  if (change.status === "tried") return verifyAttempt(state, target, change, before, userId, response);
  const row = rows.history?.length === 1 ? rows.history[0] : undefined;
  const closes = "close_date" in change;
  const fields = matchesTarget(row, target) ? {
    preserved: preservedFields.every(field => isSameField(field, before, row)),
    reason: row.close_description === change.close_description,
    status: row.status === change.status,
    dates: closes
      ? row.close_date === change.close_date && activityDate(row) === activityDate(before) && row.final_date === before.final_date
      : activityDate(row) === change.action_date && duration(row) === duration(before),
    state: change.status === "unfinishedGoal" ? isNotDone(row)
      : change.status === "done" ? isDone(row) : row.close_date === null && !isDone(row)
  } : undefined;
  const planned = rows.planned;
  const plannedMatches = planned !== undefined && (closes
    ? planned.length === 0 || (planned.length === 1 && planned[0].close_date === change.close_date)
    : planned.length === 1 && planned[0].close_date === null && activityDate(planned[0]) === change.action_date);
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
  server.registerTool(ATTEMPT, {
    description: `Registra motivo e data informada da tentativa de contato em um comentário vinculado à atividade. Para mover a atividade em Planejado, use leads2b_reschedule_activity. ${context}`,
    inputSchema: rescheduleSchema, annotations
  }, ({ action_date, ...target }) => run(ATTEMPT, target, {
    status: "tried", action_date, close_description: target.close_description
  }));
  server.registerTool(REMOVE, {
    description: "Solicita a exclusão de uma atividade comum no negócio informado. Exige confirmação destrutiva e motivo se a atividade estiver encerrada. Rota interna experimental.",
    inputSchema: removeSchema, annotations: { ...annotations, destructiveHint: true }
  }, ({ reason, confirm_destructive, ...target }) => run(REMOVE, target, { reason }, confirm_destructive));
  server.registerTool(CLOSE_WITHOUT_GOAL, {
    description: `Encerra uma atividade com objetivo não atingido, data e motivo. ${context}`,
    inputSchema: completeSchema, annotations
  }, ({ close_date, ...target }) => run(CLOSE_WITHOUT_GOAL, target, {
    status: "unfinishedGoal", done: false, close_date, close_description: target.close_description
  }));

  async function run(operation: string, target: Target, change: Change, confirmDestructive?: boolean) {
    const activityId = String(target.activity_id);
    const endpoint = `/history/index/${activityId}`;
    const source = { api: "v1", endpoint, stability: "experimental" } as const;
    const scope = { entity: target.entity, id: target.id, activity_id: target.activity_id };
    const method = "reason" in change ? "DELETE" : "PUT";
    const isAttempt = "status" in change && change.status === "tried";
    const plan = { operation, api: "v1", method, endpoint, mode: deps.writeMode, target: scope,
      body: "reason" in change && change.reason === undefined ? null : change,
      ...(isAttempt ? { derivedFields: ["tried_by_user_id"] } : {}), executed: false };
    const gate = evaluateWriteOperation({ writeMode: deps.writeMode, destructive: method === "DELETE", confirmDestructive });
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
      const userId = await requireLoggedUser(deps.v1, endpoint);
      const before = await read();
      const rows = activityRows(before, target);
      const row = rows.history?.length === 1 ? rows.history[0] : undefined;
      const planned = rows.planned?.length === 1 ? rows.planned[0] : undefined;
      if (!matchesTarget(row, target)) return stop("A releitura não confirmou uma atividade comum com o ID e o vínculo informados.", before);
      const open = row.close_date === null && !isDone(row)
        && (row.status === "pending" || row.status === "reschedule" || row.status === "tried")
        && planned?.close_date === null && activityDate(planned) === activityDate(row) && duration(row) !== undefined;
      if ("reason" in change) {
        const closed = timestamp.safeParse(row.close_date).success && (isDone(row) || row.status === "done" || row.status === "unfinishedGoal")
          && (rows.planned?.length === 0 || planned?.close_date === row.close_date);
        if (!(open || closed)) return stop("A releitura não confirmou o estado da atividade nos dois recortes.", before);
        if (closed !== (change.reason !== undefined)) {
          return stop("Informe o motivo apenas para uma atividade encerrada.", before);
        }
      } else if (!open) {
        return stop("A releitura precisa confirmar uma atividade aberta com data consistente no histórico e em Planejado.", before);
      }
      if ("status" in change && change.status === "reschedule" && activityDate(row) === change.action_date) {
        return stop("A atividade já está na data e hora solicitadas.", before);
      }
      if ("status" in change && change.status === "tried") {
        const comments = attemptComments(row);
        if (!comments) return stop("A releitura não confirmou a lista de comentários vinculados à atividade.", before);
        if (comments.some(comment => matchesAttempt(comment, target, change))) {
          return stop("A tentativa com a mesma data e motivo já consta no histórico.", before);
        }
      }

      const body = "reason" in change ? (change.reason === undefined ? undefined : { reason: change.reason })
        : isAttempt ? { ...change, tried_by_user_id: userId } : change;
      let result: unknown;
      try {
        result = await deps.v1.rawRequest({ method, path: endpoint, body });
      } catch (error) {
        const failure = errorResult(error);
        const readback = await read();
        return { ...failure, structuredContent: { ...failure.structuredContent, target: scope, requested: body,
          writeState: { requestSent: true, outcome: "unknown", automaticRetry: false },
          readback, verification: verifyTransition(readback, target, change, row, userId) } };
      }

      const rejected = businessFailure(result);
      const readback = await read();
      const verification = verifyTransition(readback, target, change, row, userId, result);
      const outcome = rejected ? "rejected" : "request_accepted";
      const summary = rejected ? "A API rejeitou a transição." : verification.status === "observed"
        ? "Transição confirmada no histórico e em Planejado." : verification.status === "absent_in_readback"
          ? "A atividade deixou de aparecer nos recortes relidos do histórico e de Planejado."
          : "A resposta foi recebida. A releitura ainda não confirmou a transição.";
      const response = okResult({ ok: true, data: { ...plan, body: body ?? null, executed: true, outcome, result, readback, verification }, summary, source });
      return rejected ? { ...response, isError: true, structuredContent: { ...response.structuredContent, ok: false } } : response;
    } catch (error) {
      return errorResult(error);
    } finally {
      inFlight.delete(activityId);
    }
  }
}

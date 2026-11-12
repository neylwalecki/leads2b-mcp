import type { Leads2bV1Client } from "../client/v1.js";
import { EntityIdSchema } from "../crud/schemas.js";

type Row = Record<string, unknown>;
type Client = Pick<Leads2bV1Client, "rawRequest">;
type Readback = { status: "fetched"; endpoint: string; result: unknown } | { status: "failed"; endpoint: string; error: string };
export type HistoryState = Readback & { history: Readback; activities?: Readback; coverage: { status: "unknown"; limit: number; uniqueness: "unverified" } };
const limit = 100;
const object = (value: unknown): Row | undefined => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : undefined;

// Do not search arbitrary nested objects or mistake an unknown envelope for an empty list.
export function historyRows(response: unknown, collection: "history" | "activities"): Row[] | undefined {
  const envelope = object(response);
  const data = envelope?.data;
  const nested = object(data);
  const candidates = [response, data, envelope?.[collection], nested?.[collection]];
  const lists = candidates.filter(Array.isArray);
  const rows = lists.length === 1 ? lists[0] : undefined;
  return Array.isArray(rows) && rows.every(row => object(row)) ? rows as Row[] : undefined;
}

export async function readHistoryState(client: Client, expected: Row): Promise<HistoryState> {
  const query = { entity: String(expected.entity), id_entity: String(expected.id_entity) };
  const read = async (path: string, filters: Record<string, string | number>): Promise<Readback> => {
    try { return { status: "fetched", endpoint: path, result: await client.rawRequest({ method: "GET", path, query: filters }) }; }
    catch (error) { return { status: "failed", endpoint: path, error: error instanceof Error ? error.message : "Falha de releitura." }; }
  };
  const history = await read("/history/index/", { ...query, type: String(expected.option), limit, offset: 0 });
  const activities = expected.option === "action" ? await read("/history/activities/", query) : undefined;
  // Keep the original top-level readback status/endpoint/result for existing consumers.
  return { ...history, history, ...(activities ? { activities } : {}), coverage: { status: "unknown", limit, uniqueness: "unverified" } };
}

const aliases: Record<string, string[]> = {
  entity: ["entity"], id_entity: ["id_entity"], option: ["history_type", "option", "type"],
  message: ["history_message", "message"], receiver: ["receiver", "id_receiver", "id_user_to"],
  action: ["action", "id_action"], data: ["data", "action_date"],
  final_date: ["final_date"], id_pipeline_item: ["id_pipeline_item"]
};
const idFields = new Set(["id_entity", "receiver", "action", "id_pipeline_item"]);

function fieldValues(row: Row, key: string): unknown[] {
  const keys = key === "data" && row.action_date_sql !== undefined
    ? ["data", "action_date_sql"] : aliases[key] ?? [key];
  return keys.filter(alias => row[alias] !== undefined).map(alias => row[alias]);
}

function checks(row: Row, expected: Row): Record<string, boolean | null> {
  return Object.fromEntries(Object.entries(expected).map(([key, value]) => {
    const values = fieldValues(row, key);
    const match = (actual: unknown): boolean | null => {
      if (key === "final_date" && value === null && (actual === null || actual === "")) return true;
      if (idFields.has(key)) return EntityIdSchema.safeParse(actual).success ? String(actual) === String(value) : null;
      if (typeof actual !== "string") return null;
      return key === "entity" ? actual.toUpperCase() === value : actual === value;
    };
    const matches = values.map(match);
    return [key, matches.includes(false) ? false : !matches.length || matches.includes(null) ? null : true];
  }));
}

function rowsFrom(state: HistoryState, collection: "history" | "activities") {
  const read = state[collection];
  return read?.status === "fetched" ? historyRows(read.result, collection) : undefined;
}

// A matching text with missing identity/fields is a possible duplicate, not permission to send again.
export function historyPreflight(state: HistoryState, expected: Row) {
  const history = rowsFrom(state, "history");
  const activities = expected.option === "action" ? rowsFrom(state, "activities") : [];
  const possible = [...(history ?? []), ...(activities ?? [])].filter(row => {
    const fields = checks(row, expected);
    return fields.message === true && !Object.values(fields).includes(false);
  });
  return { readable: history !== undefined && activities !== undefined,
    possibleDuplicates: possible, coverage: state.coverage };
}

function responseId(response: unknown): string | undefined {
  const root = object(response);
  const data = object(root?.data);
  const candidates = [root?.id, object(root?.message)?.id, data?.id, object(data?.message)?.id]
    .filter(value => EntityIdSchema.safeParse(value).success).map(String);
  const ids = [...new Set(candidates)];
  return ids.length === 1 ? ids[0] : undefined;
}

export function verifyHistoryEffect(state: HistoryState, expected: Row, result: unknown, before?: HistoryState) {
  const id = responseId(result);
  const inspectHistory = () => {
    const rows = rowsFrom(state, "history");
    const selected = id ? rows?.filter(row => String(row.id) === id) ?? [] : [];
    const fieldChecks = selected.length === 1 ? checks(selected[0], expected) : undefined;
    const exact = rows?.filter(row => Object.values(checks(row, expected)).every(value => value === true)) ?? [];
    const exactIds = [...new Set(exact.filter(row => EntityIdSchema.safeParse(row.id).success).map(row => String(row.id)))];
    return { status: rows === undefined ? "unavailable" : "fetched", idOccurrences: selected.length,
      matchingIds: exactIds, matchingOccurrences: exact.length, fields: fieldChecks ?? null,
      confirmed: selected.length === 1 && exact.length === 1 && exactIds.length === 1 && exactIds[0] === id
        && Boolean(fieldChecks && Object.values(fieldChecks).every(value => value === true)) };
  };
  const history = inspectHistory();
  const activities = expected.option === "action" ? verifyPlannedActivity(state, expected, id) : undefined;
  const prior = before && id ? [...(rowsFrom(before, "history") ?? []), ...(rowsFrom(before, "activities") ?? [])].some(row => String(row.id) === id) : undefined;
  const confirmed = Boolean(id && !prior && history.confirmed && (!activities || activities.confirmed));
  return { status: confirmed ? "observed" : "unconfirmed", id: id ?? null, target: { entity: expected.entity, id: expected.id_entity },
    existedBefore: prior ?? null, history, ...(activities ? { activities } : {}),
    uniqueness: "unverified", coverage: state.coverage,
    automaticRetry: false };
}

function verifyPlannedActivity(state: HistoryState, expected: Row, id: string | undefined) {
  const rows = rowsFrom(state, "activities");
  const selected = id ? rows?.filter(row => String(row.id) === id) ?? [] : [];
  const row = selected.length === 1 ? selected[0] : undefined;
  const event = id ? rowsFrom(state, "history")?.find(row => String(row.id) === id) : undefined;
  const fields = row ? checks(row, expected) : null;
  if (fields && row) {
    // The observed list contains only ID, date, close_date and action_name.
    // Full target, description, assignee and type are verified in history.
    for (const [key, result] of Object.entries(fields)) {
      if (result === null && fieldValues(row, key).length > 0) fields[key] = false;
    }
    fields.pending = row.close_date != null || (event?.status !== undefined && event.status !== "pending")
      ? false : row.status !== undefined ? row.status === "pending" : row.close_date === null && event?.status === "pending";
    if (typeof row.action_name === "string" && typeof event?.action_name === "string") {
      fields.action_name = row.action_name === event.action_name;
    }
  }
  const confirmed = Boolean(fields && fields.data === true && fields.pending === true && !Object.values(fields).includes(false));
  return { status: rows === undefined ? "unavailable" : "fetched", idOccurrences: selected.length,
    matchingIds: confirmed && id ? [id] : [], matchingOccurrences: confirmed ? 1 : 0, fields, confirmed };
}

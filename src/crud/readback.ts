import type { Leads2bV1Client } from "../client/v1.js";
import { Leads2bHttpError } from "../client/http.js";

type Entity = "customer" | "contact" | "lead" | "opportunity";
const paths: Record<Entity, string> = {
  customer: "/customer/index", contact: "/customer/contact_by_id",
  lead: "/lead/index", opportunity: "/opportunity/index"
};

// A failed response does not prove rollback. Read only; never repeat a mutation here.
export async function readbackAfterFailure(client: Pick<Leads2bV1Client, "rawRequest">, entity: Entity, id: string | number | undefined, fields?: Record<string, unknown>) {
  if (id === undefined) return { status: "not_performed", reason: "No confirmed new ID; search for the record before retrying creation." };
  const path = `${paths[entity]}/${id}${entity === "lead" ? "/defaultLead" : ""}`;
  try {
    const result = await client.rawRequest({ method: "GET", path });
    const envelope = result as { data?: any; opportunity_data?: any[] };
    const row = entity === "opportunity" ? envelope?.opportunity_data?.[0] : entity === "lead" ? envelope?.data?.lead
      : entity === "customer" ? envelope?.data?.customer : envelope?.data;
    const record = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : undefined;
    return {
      status: "fetched", endpoint: path, result,
      deleted: record ? Boolean(record.deleted_at) : undefined,
      requestedFieldsMatch: fields && record ? Object.entries(fields).every(([key, expected]) => matches(record[key], expected)) : undefined
    };
  } catch (error) {
    return { status: error instanceof Leads2bHttpError && error.status === 404 ? "not_found" : "failed", endpoint: path };
  }
}

function matches(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string" && expected && typeof expected === "object") {
    try { actual = JSON.parse(actual); } catch { return false; }
  }
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    return Boolean(actual && typeof actual === "object" && Object.entries(expected).every(([key, value]) => matches((actual as Record<string, unknown>)[key], value)));
  }
  if (Array.isArray(expected)) return JSON.stringify(actual) === JSON.stringify(expected);
  if (typeof expected === "number" && typeof actual === "string" && actual.trim()) return Number(actual) === expected;
  return actual === expected;
}

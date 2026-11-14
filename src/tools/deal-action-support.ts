import { z } from "zod";
import { Leads2bHttpError } from "../client/http.js";
import type { Leads2bV1Client } from "../client/v1.js";
import { EntityIdSchema } from "../crud/schemas.js";

export const historyEntity = z.enum(["LEAD", "OPPORTUNITY"]);
export const nonBlankText = z.string().refine(value => value.trim().length > 0, "Informe texto não vazio.");
export const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/).refine(value => {
  const parsed = new Date(value.replace(" ", "T") + "Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 19).replace("T", " ") === value;
}, "Use uma data válida no formato YYYY-MM-DD HH:mm:ss, no horário da conta.");

export async function requireLoggedUser(v1: Pick<Leads2bV1Client, "getLoggedUser">, endpoint: string) {
  const logged = await v1.getLoggedUser() as { data?: { user?: unknown } };
  const user = Array.isArray(logged?.data?.user) ? logged.data.user[0] : logged?.data?.user;
  const id = EntityIdSchema.safeParse(user && typeof user === "object" && "id" in user ? user.id : undefined);
  if (!id.success) throw new Leads2bHttpError({
    endpoint, code: "LEADS2B_USER_CONTEXT_REQUIRED",
    message: "Operação exige contexto de usuário v1 autorizado. Nenhuma mutação enviada."
  });
  return id.data;
}

// Known rejection codes observed in the frontend. Informational text is not an error.
const rejectionCodes = new Set(["time_unavailable", "required_activity_type", "pipeline_item_activities_required",
  "opportunity_value_required", "date_earlier", "create_action"]);
export function businessFailure(result: unknown): boolean {
  if (typeof result === "string") return rejectionCodes.has(result);
  if (!result || typeof result !== "object") return false;
  const value = result as Record<string, unknown>;
  return value.success === false || value.ok === false || value.status === false || Boolean(value.error)
    || (typeof value.message === "string" && rejectionCodes.has(value.message))
    || (value.data !== undefined && businessFailure(value.data));
}

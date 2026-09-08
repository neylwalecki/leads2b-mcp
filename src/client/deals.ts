import type { Leads2bV2Client, Leads2bDealEntity } from "./v2.js";

export type DealScanInput = {
  entity: Leads2bDealEntity;
  pageSize?: number;
  maxPages?: number;
  offset?: number;
  search?: string;
};
export type DealCoverage = {
  status: "complete" | "partial";
  reason: "total_reached" | "empty_page" | "page_limit" | "repeated_page" | "request_failed" | "collection_changed";
  pagesFetched: number;
  recordsFetched: number;
  startOffset: number;
  nextOffset?: number;
  totalAvailable?: number;
};

// /deals uses observed limit/offset pagination. Do not apply the generic cursor guide here.
export async function scanDeals(client: Pick<Leads2bV2Client, "listDeals">, input: DealScanInput) {
  const pageSize = input.pageSize ?? 100;
  const maxPages = input.maxPages ?? 1;
  const startOffset = input.offset ?? 0;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500
    || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20
    || !Number.isSafeInteger(startOffset) || startOffset < 0) throw new Error("Limites de paginação inválidos.");
  const data: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const warnings: string[] = [];
  let total: number | undefined;
  let offset = startOffset;
  let pagesFetched = 0;
  let reason: DealCoverage["reason"] = "page_limit";
  let changed = false;
  for (let page = 0; page < maxPages; page++) {
    let response: unknown;
    try {
      response = await client.listDeals({ entity: input.entity, limit: pageSize, offset, search: input.search });
    } catch (error) {
      if (pagesFetched === 0) throw error;
      reason = "request_failed";
      warnings.push("Uma página de /deals falhou; os registros retornados são parciais.");
      break;
    }
    const envelope = response as { data?: unknown; total?: unknown };
    if (!envelope || !Array.isArray(envelope.data) || !envelope.data.every(isRow)) {
      throw new Error("Formato inesperado em /deals; não é seguro tratar a resposta como coleção vazia.");
    }
    pagesFetched++;
    const rows = envelope.data;
    const pageTotal = typeof envelope.total === "number" && Number.isFinite(envelope.total) && envelope.total >= 0
      ? envelope.total : undefined;
    if (total !== undefined && pageTotal !== undefined && total !== pageTotal) changed = true;
    total = pageTotal ?? total;
    if (rows.length === 0) {
      reason = total !== undefined && offset < total ? "collection_changed" : "empty_page";
      break;
    }
    let added = 0;
    for (const row of rows) {
      const key = row.id == null ? JSON.stringify(row) : String(row.id);
      if (seen.has(key)) continue;
      seen.add(key);
      data.push(row);
      added++;
    }
    if (added !== rows.length) changed = true;
    if (added === 0) { reason = "repeated_page"; break; }
    offset += rows.length;
    if (total !== undefined && offset >= total) { reason = "total_reached"; break; }
  }
  if (changed && ["total_reached", "empty_page"].includes(reason)) reason = "collection_changed";
  const complete = reason === "total_reached" || reason === "empty_page";
  if (!complete) warnings.push(`Cobertura parcial de ${input.entity}: ${reason}. Não interprete ausência como inexistência.`);
  const coverage: DealCoverage = {
    status: complete ? "complete" : "partial", reason, pagesFetched, recordsFetched: data.length,
    startOffset, nextOffset: complete ? undefined : offset, totalAvailable: total
  };
  return { data, total, entity: input.entity, coverage, warnings };
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

import type { Leads2bV1Client } from "../client/v1.js";
import type { Leads2bV2Client } from "../client/v2.js";
import { scanDeals, type DealCoverage } from "../client/deals.js";
import { inDateRange, dateBoundary } from "./dates.js";
import { loadAttributionForRecords } from "./attribution.js";
import { findRecordsFromSources, buildLeadOpsCandidates } from "./records.js";

export type LeadOpsScanInput = {
  entities?: Array<"CUSTOMER" | "LEAD" | "OPPORTUNITY">;
  createdFrom?: string;
  createdTo?: string;
  pageSize?: number;
  maxPages?: number;
  limit?: number;
  offset?: number;
  includeAttribution?: boolean;
  apiTimestampOffset?: string;
};
type ScanDeps = {
  v1: Pick<Leads2bV1Client, "listCustomers">;
  v2: Pick<Leads2bV2Client, "listDeals" | "getConversions" | "getTracking">;
};
type SourceCoverage = DealCoverage | { status: "unknown" | "partial"; reason: string; recordsFetched?: number };

// This public read interface contains no spreadsheet rules, client paths or writes.
export async function scanLeadOps(deps: ScanDeps, input: LeadOpsScanInput = {}) {
  const entities = [...new Set(input.entities ?? ["CUSTOMER", "LEAD", "OPPORTUNITY"] as const)];
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;
  const pageSize = input.pageSize ?? 100;
  const maxPages = input.maxPages ?? 5;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw new Error("Limites de paginação inválidos.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isSafeInteger(offset) || offset < 0) throw new Error("Paginação de saída inválida.");
  if (!entities.length || entities.some(e => !["CUSTOMER", "LEAD", "OPPORTUNITY"].includes(e))) throw new Error("Entidades de coleta inválidas.");
  if (input.createdFrom) dateBoundary(input.createdFrom, "start");
  if (input.createdTo) dateBoundary(input.createdTo, "end");
  inDateRange(undefined, input.createdFrom, input.createdTo);
  if (input.apiTimestampOffset && !/^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/.test(input.apiTimestampOffset)) throw new Error("Offset da API inválido.");
  const warnings: string[] = [];
  if (input.createdFrom || input.createdTo) warnings.push(input.apiTimestampOffset
    ? `Filtro de datas com correção explícita do horário da API: ${input.apiTimestampOffset}. Valores brutos preservados.`
    : "Timestamps Z são respeitados como declarados, mas foi observada divergência de fuso na API v2. Valide a janela ou informe apiTimestampOffset com base em evidência da conta.");
  const sources: Partial<Record<"CUSTOMER" | "LEAD" | "OPPORTUNITY", SourceCoverage>> = {};
  let customersResponse: unknown;
  const dealResponses: Array<{ entity: "LEAD" | "OPPORTUNITY"; response: unknown }> = [];
  for (const entity of entities) {
    try {
      if (entity === "CUSTOMER") {
        customersResponse = await deps.v1.listCustomers();
        const rows = (customersResponse as { data?: { customers?: unknown } })?.data?.customers;
        if (!Array.isArray(rows) || !rows.every(row => row && typeof row === "object" && !Array.isArray(row))) {
          customersResponse = undefined;
          throw new Error("Formato inesperado em customer/index.");
        }
        const normalized = findRecordsFromSources({ criteria: {}, requestedEntities: ["CUSTOMER"], customersResponse });
        sources.CUSTOMER = { status: "unknown", reason: "unpaginated_observed_endpoint", recordsFetched: normalized.totalScanned };
        warnings.push("Customers: endpoint v1 observado sem metadados de completude; cobertura total não comprovada.");
      } else {
        const response = await scanDeals(deps.v2, { entity, pageSize: input.pageSize, maxPages: input.maxPages ?? 5 });
        sources[entity] = response.coverage;
        dealResponses.push({ entity, response });
        warnings.push(...response.warnings);
      }
    } catch {
      sources[entity] = { status: "partial", reason: "request_failed" };
      warnings.push(`Falha ao coletar ${entity}; ausência de registros não comprova ausência de leads.`);
    }
  }
  const found = findRecordsFromSources({ criteria: {}, requestedEntities: entities, customersResponse, dealResponses });
  const records = found.records.filter(r => inDateRange(r.dates.createdAt, input.createdFrom, input.createdTo, input.apiTimestampOffset));
  const page = records.slice(offset, offset + limit);
  const attribution = input.includeAttribution === false ? {} : await loadAttributionForRecords(deps, page);
  const candidates = buildLeadOpsCandidates({ records: page, attributionByTechnicalId: attribution });
  const sourceStates = Object.values(sources).map(source => source.status);
  const status = sourceStates.includes("partial") ? "partial" : sourceStates.includes("unknown") ? "unknown" : "complete";
  return {
    ...candidates,
    coverage: { status, sources, totalScanned: found.totalScanned, scope: "requested_sources", atomicSnapshot: false },
    pagination: { offset, limit, matchedTotal: records.length, returned: page.length, nextOffset: offset + page.length < records.length ? offset + page.length : undefined },
    warnings: [...new Set([...warnings, ...found.warnings, ...candidates.candidates.flatMap(c => c.warnings)])],
    dateInterpretation: { naiveApiOffset: "-03:00", apiTimestampOffsetOverride: input.apiTimestampOffset },
    generatedAt: new Date().toISOString()
  };
}

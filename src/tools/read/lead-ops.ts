import { scanLeadOps } from "../../lead-ops/scan.js";
import { loadAttributionForRecords } from "../../lead-ops/attribution.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { diagnoseAttributionBatch } from "../../attribution/batch.js";
import { Leads2bEntity } from "../../attribution/normalize.js";
import { Leads2bHttpError } from "../../client/http.js";
import {
  LeadOpsEntity,
  LeadOpsRecord,
  buildLeadOpsCandidates,
  findRecordsFromSources,
  listRecentOpportunitiesFromDeals,
  recordDetailFromRaw
} from "../../lead-ops/records.js";
import { errorResult, okResult } from "../result.js";
import { IdSchema, ReadDeps } from "./shared.js";

const LeadOpsEntitySchema = z.enum(["CUSTOMER", "LEAD", "CONTACT", "OPPORTUNITY"]);
const DealEntitySchema = z.enum(["LEAD", "OPPORTUNITY"]);
const SearchCriteriaSchema = {
  search: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  document: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional()
};

export function registerLeadOpsTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool("leads2b_scan_lead_ops", {
    title: "Scan lead operations",
    description: "Coleta paginada de customers, leads e oportunidades, com janela de criação, candidatos e cobertura explícita. Não grava em planilhas nem no CRM.",
    inputSchema: {
      entities: z.array(z.enum(["CUSTOMER", "LEAD", "OPPORTUNITY"])).min(1).optional(),
      createdFrom: z.string().min(1).optional(),
      createdTo: z.string().min(1).optional(),
      pageSize: z.number().int().min(1).max(500).optional(),
      maxPages: z.number().int().min(1).max(20).optional(),
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).optional(),
      apiTimestampOffset: z.string().regex(/^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/).optional().describe("Correção de timestamps Z rotulados incorretamente; usar somente após validar o horário real da conta."),
      includeAttribution: z.boolean().optional()
    },
    annotations: { readOnlyHint: true }
  }, async input => {
    try {
      const data = await scanLeadOps(deps, input);
      return okResult({ ok: true, data, warnings: data.warnings,
        summary: `Lead ops scan: ${data.pagination.returned} de ${data.pagination.matchedTotal} candidato(s); cobertura ${data.coverage.status}.`,
        source: { api: "local", stability: "observed", endpoint: "/customer/index + /deals + /conversions + /conversions/tracking" }
      });
    } catch (error) { return errorResult(error); }
  });

  server.registerTool(
    "leads2b_find_records",
    {
      title: "Find records",
      description:
        "Busca registros genericamente por e-mail, telefone, documento, nome, empresa ou texto, cruzando customers e deals quando a API permite.",
      inputSchema: {
        ...SearchCriteriaSchema,
        entities: z.array(LeadOpsEntitySchema).min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        fetchLimit: z.number().int().min(1).max(500).optional(),
        maxPages: z.number().int().min(1).max(20).optional(),
        includeRaw: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (input) => {
      try {
        const criteria = pickSearchCriteria(input);
        if (!hasCriteria(criteria)) {
          return errorResult(
            new Error("Informe ao menos um critério: search, email, phone, document, name ou company.")
          );
        }

        const requestedEntities = (input.entities ?? [
          "CUSTOMER",
          "LEAD",
          "CONTACT",
          "OPPORTUNITY"
        ]) as LeadOpsEntity[];
        const sources = await loadRecordSources({
          deps,
          criteria,
          requestedEntities,
          fetchLimit: input.fetchLimit ?? 100,
          maxPages: input.maxPages
        });
        const data = findRecordsFromSources({
          criteria,
          customersResponse: sources.customersResponse,
          dealResponses: sources.dealResponses,
          requestedEntities,
          limit: input.limit ?? 25,
          offset: input.offset ?? 0,
          includeRaw: input.includeRaw ?? false
        });
        const warnings = [...sources.warnings, ...data.warnings];

        return okResult({
          ok: true,
          data: {
            ...data,
            warnings
          },
          warnings,
          summary: `Find records: ${data.matchedTotal} registro(s) encontrado(s) em ${data.totalScanned} analisado(s).`,
          source: {
            api: "local",
            endpoint: "/customer/index + /deals",
            stability: "observed"
          }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_list_recent_opportunities",
    {
      title: "List recent opportunities",
      description:
        "Lista oportunidades recentes via /deals e aplica filtros locais por data de criação, status, funil, etapa, responsável e busca textual.",
      inputSchema: {
        createdFrom: z.string().min(1).optional(),
        createdTo: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
        pipeline: z.string().min(1).optional(),
        stage: z.string().min(1).optional(),
        responsible: z.string().min(1).optional(),
        search: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        fetchLimit: z.number().int().min(1).max(500).optional(),
        maxPages: z.number().int().min(1).max(20).optional(),
        includeRaw: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (input) => {
      try {
        const fetchLimit = input.fetchLimit ?? Math.max(input.limit ?? 25, 100);
        const response = await deps.v2.scanDeals({
          entity: "OPPORTUNITY",
          pageSize: fetchLimit,
          maxPages: input.maxPages,
          search: input.search
        });
        const data = listRecentOpportunitiesFromDeals({
          response,
          filters: {
            createdFrom: input.createdFrom,
            createdTo: input.createdTo,
            status: input.status,
            pipeline: input.pipeline,
            stage: input.stage,
            responsible: input.responsible,
            search: input.search
          },
          limit: input.limit ?? 25,
          offset: input.offset ?? 0,
          includeRaw: input.includeRaw ?? false
        });

        return okResult({
          ok: true,
          data: { ...data, coverage: response.coverage },
          warnings: [...data.warnings, ...response.warnings],
          summary: `Recent opportunities: ${data.matchedTotal} oportunidade(s) dentro da janela buscada.`,
          source: {
            api: "v2",
            endpoint: "/deals?entity=OPPORTUNITY",
            stability: "observed"
          }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_record_detail",
    {
      title: "Get record detail",
      description:
        "Obtém detalhe normalizado de CUSTOMER, LEAD, CONTACT ou OPPORTUNITY, com atribuição vinculada quando disponível.",
      inputSchema: {
        id: IdSchema,
        entity: LeadOpsEntitySchema,
        includeAttribution: z.boolean().optional(),
        includeRaw: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, entity, includeAttribution = true, includeRaw = false }) => {
      try {
        const detail = await getRecordDetail({
          deps,
          id,
          entity: entity as LeadOpsEntity,
          includeRaw
        });
        const warnings = [...(detail.warnings ?? [])];
        const attribution = includeAttribution
          ? await getAttributionForRecord({
              deps,
              record: detail
            })
          : undefined;

        if (attribution?.warnings.length) {
          warnings.push(...attribution.warnings);
        }

        return okResult({
          ok: true,
          data: {
            detail,
            attribution: attribution?.data
          },
          warnings,
          summary: `Record detail: ${entity} ${id} consultado.`,
          source: sourceForRecordDetail(entity as LeadOpsEntity)
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_lead_ops_candidates",
    {
      title: "Get lead ops candidates",
      description:
        "Retorna candidatos genéricos para operação diária de leads com dados básicos, comerciais, atribuição, duplicidade, lacunas e warnings.",
      inputSchema: {
        records: z
          .array(
            z.object({
              id: IdSchema,
              entity: LeadOpsEntitySchema
            })
          )
          .min(1)
          .optional(),
        searches: z.array(z.object(SearchCriteriaSchema)).min(1).optional(),
        includeRecentOpportunities: z.boolean().optional(),
        entities: z.array(LeadOpsEntitySchema).min(1).optional(),
        createdFrom: z.string().min(1).optional(),
        createdTo: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
        pipeline: z.string().min(1).optional(),
        stage: z.string().min(1).optional(),
        responsible: z.string().min(1).optional(),
        search: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        fetchLimit: z.number().int().min(1).max(500).optional(),
        maxPages: z.number().int().min(1).max(20).optional(),
        includeRaw: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (input) => {
      try {
        const records: LeadOpsRecord[] = [];
        const warnings: string[] = [];
        const limit = input.limit ?? 25;
        const fetchLimit = input.fetchLimit ?? Math.max(limit, 100);

        for (const record of input.records ?? []) {
          records.push(
            await getRecordDetail({
              deps,
              id: record.id,
              entity: record.entity as LeadOpsEntity,
              includeRaw: input.includeRaw ?? false
            })
          );
        }

        for (const search of input.searches ?? []) {
          if (!hasCriteria(search)) {
            warnings.push("Busca ignorada por não informar critérios.");
            continue;
          }

          const requestedEntities = (input.entities ?? [
            "CUSTOMER",
            "LEAD",
            "CONTACT",
            "OPPORTUNITY"
          ]) as LeadOpsEntity[];
          const sources = await loadRecordSources({
            deps,
            criteria: search,
            requestedEntities,
            fetchLimit,
            maxPages: input.maxPages
          });
          const found = findRecordsFromSources({
            criteria: search,
            customersResponse: sources.customersResponse,
            dealResponses: sources.dealResponses,
            requestedEntities,
            limit,
            includeRaw: input.includeRaw ?? false
          });

          records.push(...found.records);
          warnings.push(...sources.warnings, ...found.warnings);
        }

        if (input.includeRecentOpportunities || (records.length === 0 && !input.searches?.length)) {
          const response = await deps.v2.scanDeals({
            entity: "OPPORTUNITY",
            pageSize: fetchLimit,
            maxPages: input.maxPages,
            search: input.search
          });
          const recent = listRecentOpportunitiesFromDeals({
            response,
            filters: {
              createdFrom: input.createdFrom,
              createdTo: input.createdTo,
              status: input.status,
              pipeline: input.pipeline,
              stage: input.stage,
              responsible: input.responsible,
              search: input.search
            },
            limit,
            includeRaw: input.includeRaw ?? false
          });

          records.push(...recent.opportunities);
          warnings.push(...recent.warnings, ...response.warnings);
        }

        const uniqueRecords = dedupeRecords(records).slice(0, limit);
        const attributionByTechnicalId = await loadAttributionForRecords(deps, uniqueRecords);
        const data = buildLeadOpsCandidates({
          records: uniqueRecords,
          attributionByTechnicalId
        });
        const attributionWarnings = Object.values(attributionByTechnicalId ?? {})
          .flatMap((attribution) => attribution?.warnings ?? [])
          .filter(Boolean);
        const allWarnings = uniqueWarnings([...warnings, ...attributionWarnings]);

        return okResult({
          ok: true,
          data: {
            ...data,
            warnings: allWarnings
          },
          warnings: allWarnings,
          summary: `Lead ops candidates: ${data.summary.total} candidato(s), ${data.summary.withAttribution} com atribuição observada.`,
          source: {
            api: "local",
            endpoint: "/customer/index + /deals + /conversions + /conversions/tracking",
            stability: "observed"
          }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

async function loadRecordSources(input: {
  deps: ReadDeps;
  criteria: ReturnType<typeof pickSearchCriteria>;
  requestedEntities: LeadOpsEntity[];
  fetchLimit: number;
  maxPages?: number;
}): Promise<{
  customersResponse?: unknown;
  dealResponses: Array<{ entity: "LEAD" | "OPPORTUNITY"; response: unknown }>;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const dealResponses: Array<{ entity: "LEAD" | "OPPORTUNITY"; response: unknown }> = [];
  let customersResponse: unknown;

  if (input.requestedEntities.includes("CUSTOMER")) {
    try {
      customersResponse = await input.deps.v1.listCustomers();
    } catch (error) {
      warnings.push(`Falha ao buscar customers em /customer/index: ${errorMessage(error)}`);
    }
  }

  for (const entity of ["LEAD", "OPPORTUNITY"] as const) {
    if (!input.requestedEntities.includes(entity)) {
      continue;
    }

    try {
      const response = await input.deps.v2.scanDeals({
        entity,
        pageSize: input.fetchLimit,
        maxPages: input.maxPages,
        search: firstCriteriaValue(input.criteria)
      });
      dealResponses.push({ entity, response });
      warnings.push(...response.warnings);
    } catch (error) {
      warnings.push(`Falha ao buscar ${entity} em /deals: ${errorMessage(error)}`);
    }
  }

  return {
    customersResponse,
    dealResponses,
    warnings
  };
}

async function getRecordDetail(input: {
  deps: ReadDeps;
  id: string | number;
  entity: LeadOpsEntity;
  includeRaw: boolean;
}): Promise<LeadOpsRecord> {
  if (input.entity === "CUSTOMER") {
    const response = await input.deps.v2.getCustomer({ id: input.id });
    return recordDetailFromRaw({
      entityType: "CUSTOMER",
      raw: unwrapData(response),
      includeRaw: input.includeRaw
    });
  }

  const response = input.entity === "LEAD" ? await input.deps.v1.getDefaultLead({ id: input.id })
    : input.entity === "OPPORTUNITY" ? await input.deps.v1.getOpportunity({ id: input.id })
    : await input.deps.v1.getContact({ id: input.id });
  const envelope = response as { data?: { lead?: unknown }; opportunity_data?: unknown[] };
  const raw = input.entity === "LEAD" ? envelope?.data?.lead
    : input.entity === "OPPORTUNITY" ? envelope?.opportunity_data?.[0] : envelope?.data;
  if (!raw || typeof raw !== "object" || !("id" in raw) || String(raw.id) !== String(input.id)) {
    throw new Error("Detalhe ausente ou formato inesperado; o registro não foi confirmado.");
  }
  return {
    ...recordDetailFromRaw({ entityType: input.entity, raw, includeRaw: input.includeRaw }),
    sourceEndpoint: sourceForRecordDetail(input.entity).endpoint ?? "unknown"
  };
}

async function getAttributionForRecord(input: {
  deps: ReadDeps;
  record: LeadOpsRecord;
}): Promise<{ data?: unknown; warnings: string[] }> {
  if (input.record.entityType === "CUSTOMER") {
    return {
      warnings: ["Atribuição direta de CUSTOMER não é aceita pela API; use LEAD, CONTACT ou OPPORTUNITY."]
    };
  }

  const id = input.record.leads2bId;
  if (!id) {
    return {
      warnings: ["Registro sem ID Leads2b; atribuição não consultada."]
    };
  }

  const batch = await diagnoseAttributionBatch({
    records: [
      {
        id,
        entity: input.record.entityType as Leads2bEntity
      }
    ],
    ignoreLookupError: isEmptyAttributionLookupError,
    getEvents: async ({ id: recordId, entity }) => {
      const [conversionsResponse, trackingResponse] = await Promise.all([
        input.deps.v2.getConversions({ id: recordId, entity }),
        input.deps.v2.getTracking({ id: recordId, entity })
      ]);

      return {
        conversions: extractEvents(conversionsResponse),
        tracking: extractEvents(trackingResponse)
      };
    }
  });
  const result = batch.results[0];

  if (!result) {
    return {
      warnings: ["Nenhum resultado de atribuição foi gerado."]
    };
  }

  if (!result.ok) {
    return {
      warnings: [result.error]
    };
  }

  return {
    data: result.attribution,
    warnings: result.warnings
  };
}


function sourceForRecordDetail(entity: LeadOpsEntity): {
  api: "v1" | "v2" | "snippet" | "local";
  endpoint?: string;
  stability: "confirmed" | "observed" | "experimental" | "unknown";
} {
  if (entity === "CUSTOMER") {
    return { api: "v2", endpoint: "/customer/{id}", stability: "confirmed" };
  }

  if (entity === "LEAD") {
    return { api: "v1", endpoint: "/lead/index/{id}/defaultLead", stability: "confirmed" };
  }

  if (entity === "OPPORTUNITY") {
    return { api: "v1", endpoint: "/opportunity/index/{id}", stability: "observed" };
  }

  return { api: "v1", endpoint: "/customer/contact_by_id/{id}", stability: "observed" };
}

function pickSearchCriteria(input: Record<string, unknown>): {
  search?: string;
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
  company?: string;
} {
  return {
    search: stringValue(input.search),
    email: stringValue(input.email),
    phone: stringValue(input.phone),
    document: stringValue(input.document),
    name: stringValue(input.name),
    company: stringValue(input.company)
  };
}

function hasCriteria(input: ReturnType<typeof pickSearchCriteria>): boolean {
  return Boolean(input.search || input.email || input.phone || input.document || input.name || input.company);
}

function firstCriteriaValue(input: ReturnType<typeof pickSearchCriteria>): string | undefined {
  return input.search ?? input.email ?? input.phone ?? input.document ?? input.name ?? input.company;
}

function unwrapData(response: unknown): unknown {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data?: unknown }).data;
  }

  return response;
}

function extractArrayData(response: unknown): Array<Record<string, unknown>> {
  const data = unwrapData(response);
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

function extractEvents(response: unknown): unknown[] {
  const data = unwrapData(response);
  return Array.isArray(data) ? data : [];
}

function dedupeRecords(records: LeadOpsRecord[]): LeadOpsRecord[] {
  const seen = new Set<string>();
  const unique: LeadOpsRecord[] = [];

  for (const record of records) {
    if (seen.has(record.technicalId)) {
      continue;
    }

    seen.add(record.technicalId);
    unique.push(record);
  }

  return unique;
}

function isEmptyAttributionLookupError(error: unknown): boolean {
  return error instanceof Leads2bHttpError && [400, 404, 422].includes(error.status ?? 0);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido.";
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings.filter(Boolean))];
}

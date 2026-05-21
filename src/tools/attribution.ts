import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findAttributionCandidates } from "../attribution/candidates.js";
import { diagnoseCustomerAttribution } from "../attribution/customer-diagnosis.js";
import {
  AttributionEvent,
  diagnoseAttribution,
  Leads2bEntity,
  normalizeAttributionSource,
  toAttributionEvent
} from "../attribution/normalize.js";
import { Leads2bV1Client } from "../client/v1.js";
import { Leads2bV2Client } from "../client/v2.js";
import { Leads2bHttpError } from "../client/http.js";
import { errorResult, okResult } from "./result.js";

type AttributionDeps = {
  v1: Leads2bV1Client;
  v2: Leads2bV2Client;
};

const EntitySchema = z.enum(["LEAD", "CONTACT", "OPPORTUNITY"]);
const IdSchema = z.union([z.string().min(1), z.number()]);
const DEFAULT_ENTITIES: Leads2bEntity[] = ["OPPORTUNITY", "LEAD", "CONTACT"];

export function registerAttributionTools(server: McpServer, deps: AttributionDeps): void {
  server.registerTool(
    "leads2b_normalize_source",
    {
      title: "Normalize attribution source",
      description: "Classifica origem localmente usando UTMs, click IDs, referrer, host e lead_origin do fornecedor.",
      inputSchema: {
        utm_source: z.string().nullable().optional(),
        utm_medium: z.string().nullable().optional(),
        utm_campaign: z.string().nullable().optional(),
        utm_term: z.string().nullable().optional(),
        utm_content: z.string().nullable().optional(),
        gclid: z.string().nullable().optional(),
        g_clid: z.string().nullable().optional(),
        fbclid: z.string().nullable().optional(),
        fb_clid: z.string().nullable().optional(),
        referrer: z.string().nullable().optional(),
        host: z.string().nullable().optional(),
        vendorLeadOrigin: z.string().nullable().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (input) => {
      const data = normalizeAttributionSource(input);
      return okResult({
        ok: true,
        data,
        summary: `Origem normalizada como ${data.normalizedSource} (${data.channel}).`,
        source: {
          api: "local",
          stability: "confirmed"
        }
      });
    }
  );

  server.registerTool(
    "leads2b_find_attribution_candidates",
    {
      title: "Find attribution candidates",
      description:
        "Lista clientes pela API v1 e testa IDs na API v2 para encontrar entidades com conversões ou tracking.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        entities: z.array(EntitySchema).min(1).optional(),
        onlyWithEvents: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ limit = 25, entities = DEFAULT_ENTITIES, onlyWithEvents = true }) => {
      try {
        const customerResponse = await deps.v1.listCustomers();
        const data = await findAttributionCandidates({
          customerResponse,
          entities: entities as Leads2bEntity[],
          limit,
          onlyWithEvents,
          ignoreLookupError: isEmptyAttributionLookupError,
          getEventCounts: async ({ customerId, entity }) => {
            const [conversionsResponse, trackingResponse] = await Promise.all([
              deps.v2.getConversions({ id: customerId, entity }),
              deps.v2.getTracking({ id: customerId, entity })
            ]);

            return {
              conversionsCount: extractEvents(conversionsResponse).length,
              trackingCount: extractEvents(trackingResponse).length
            };
          }
        });

        return okResult({
          ok: true,
          data,
          summary: `Encontrados ${data.candidates.length} candidatos com eventos em ${data.scannedCustomers} clientes analisados.`,
          source: {
            api: "local",
            endpoint: "/customer/index + /conversions + /conversions/tracking",
            stability: "observed"
          }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_diagnose_attribution",
    {
      title: "Diagnose attribution",
      description: "Busca conversões/tracking v2 e calcula first touch observado, last touch observado e divergências.",
      inputSchema: {
        id: IdSchema,
        entity: EntitySchema,
        includeRaw: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, entity, includeRaw = false }) => {
      try {
        const [trackingResponse, conversionsResponse] = await Promise.all([
          deps.v2.getTracking({ id, entity: entity as Leads2bEntity }),
          deps.v2.getConversions({ id, entity: entity as Leads2bEntity })
        ]);
        const tracking = extractEvents(trackingResponse).map((event) => toAttributionEvent(event, "tracking"));
        const conversions = extractEvents(conversionsResponse).map((event) =>
          toAttributionEvent(event, "conversion")
        );
        const diagnosis = diagnoseAttribution({
          id,
          entity: entity as Leads2bEntity,
          tracking,
          conversions
        });
        const data = prepareDiagnosis(diagnosis, includeRaw);

        return okResult({
          ok: true,
          data,
          summary: `Diagnóstico de atribuição calculado para ${entity} ${id}.`,
          warnings: diagnosis.warnings,
          source: {
            api: "v2",
            endpoint: "/conversions + /conversions/tracking",
            stability: "confirmed"
          }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_diagnose_customer_attribution",
    {
      title: "Diagnose customer attribution",
      description:
        "Encontra customers pela API v1 e diagnostica conversões/tracking na API v2 para as entidades encontradas.",
      inputSchema: {
        search: z.string().min(1).optional(),
        email: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        document: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        entities: z.array(EntitySchema).min(1).optional(),
        customerLimit: z.number().int().min(1).max(25).optional(),
        includeRaw: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({
      search,
      email,
      phone,
      document,
      name,
      entities = DEFAULT_ENTITIES,
      customerLimit = 5,
      includeRaw = false
    }) => {
      try {
        if (!search && !email && !phone && !document && !name) {
          return errorResult(new Error("Informe ao menos um critério: search, email, phone, document ou name."));
        }

        const customerResponse = await deps.v1.listCustomers();
        const data = await diagnoseCustomerAttribution({
          customerResponse,
          find: {
            search,
            email,
            phone,
            document,
            name
          },
          entities: entities as Leads2bEntity[],
          customerLimit,
          includeRaw,
          ignoreLookupError: isEmptyAttributionLookupError,
          getEvents: async ({ customerId, entity }) => {
            const [conversionsResponse, trackingResponse] = await Promise.all([
              deps.v2.getConversions({ id: customerId, entity }),
              deps.v2.getTracking({ id: customerId, entity })
            ]);

            return {
              conversions: extractEvents(conversionsResponse),
              tracking: extractEvents(trackingResponse)
            };
          }
        });

        const diagnosedEntities = data.results.reduce(
          (total, result) => total + result.diagnoses.length,
          0
        );

        return okResult({
          ok: true,
          data,
          summary: `Diagnóstico por customer: ${data.matchedCustomers} customer(s), ${diagnosedEntities} entidade(s) com eventos.`,
          source: {
            api: "local",
            endpoint: "/customer/index + /conversions + /conversions/tracking",
            stability: "observed"
          }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function isEmptyAttributionLookupError(error: unknown): boolean {
  return error instanceof Leads2bHttpError && [400, 404, 422].includes(error.status ?? 0);
}

function extractEvents(response: unknown): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)) {
    return (response as { data: unknown[] }).data;
  }

  return [];
}

function prepareDiagnosis(
  diagnosis: ReturnType<typeof diagnoseAttribution>,
  includeRaw: boolean
): ReturnType<typeof diagnoseAttribution> {
  return {
    ...diagnosis,
    firstTouchObserved: diagnosis.firstTouchObserved
      ? prepareEvent(diagnosis.firstTouchObserved, includeRaw)
      : undefined,
    lastTouchObserved: diagnosis.lastTouchObserved
      ? prepareEvent(diagnosis.lastTouchObserved, includeRaw)
      : undefined,
    conversions: diagnosis.conversions.map((event) => prepareEvent(event, includeRaw)),
    tracking: diagnosis.tracking.map((event) => prepareEvent(event, includeRaw))
  };
}

function prepareEvent(event: AttributionEvent, includeRaw: boolean): AttributionEvent {
  const { raw: _raw, ...safeEvent } = event;

  if (!includeRaw) {
    return safeEvent;
  }

  return {
    ...safeEvent,
    raw: event.raw
  };
}

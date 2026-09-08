import { diagnoseAttributionBatch } from "../attribution/batch.js";
import type { Leads2bEntity } from "../attribution/normalize.js";
import { Leads2bHttpError } from "../client/http.js";
import type { Leads2bV2Client } from "../client/v2.js";
import { buildLeadOpsCandidates, type LeadOpsRecord } from "./records.js";
type ReadDeps = { v2: Pick<Leads2bV2Client, "getConversions" | "getTracking"> };
export async function loadAttributionForRecords(
  deps: ReadDeps,
  records: LeadOpsRecord[]
): Promise<Parameters<typeof buildLeadOpsCandidates>[0]["attributionByTechnicalId"]> {
  const attributionByTechnicalId: NonNullable<
    Parameters<typeof buildLeadOpsCandidates>[0]["attributionByTechnicalId"]
  > = {};

  for (const record of records) {
    if (record.entityType === "CUSTOMER" || !record.leads2bId) {
      continue;
    }

    const batch = await diagnoseAttributionBatch({
      records: [
        {
          id: record.leads2bId,
          entity: record.entityType as Leads2bEntity
        }
      ],
      ignoreLookupError: isEmptyAttributionLookupError,
      getEvents: async ({ id, entity }) => {
        const [conversionsResponse, trackingResponse] = await Promise.all([
          deps.v2.getConversions({ id, entity }),
          deps.v2.getTracking({ id, entity })
        ]);

        return {
          conversions: extractEvents(conversionsResponse),
          tracking: extractEvents(trackingResponse)
        };
      }
    });
    const result = batch.results[0];

    if (!result?.ok) {
      attributionByTechnicalId[record.technicalId] = {
        warnings: result ? [result.error] : ["Nenhum resultado de atribuição foi gerado."]
      };
      continue;
    }

    attributionByTechnicalId[record.technicalId] = {
      firstTouchObserved: result.attribution.firstTouchObserved,
      lastTouchObserved: result.attribution.lastTouchObserved,
      lastConversion: result.attribution.conversions.at(-1),
      warnings: result.warnings
    };
  }

  return attributionByTechnicalId;
}

function isEmptyAttributionLookupError(error: unknown): boolean {
  return error instanceof Leads2bHttpError && [400, 404, 422].includes(error.status ?? 0);
}
function extractEvents(response: unknown): unknown[] {
  const data = response && typeof response === "object" && "data" in response ? response.data : response;
  return Array.isArray(data) ? data : [];
}

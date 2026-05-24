import {
  AttributionDiagnosis,
  Leads2bEntity,
  diagnoseAttribution,
  toAttributionEvent
} from "./normalize.js";

export type AttributionBatchRecord = {
  id: string | number;
  entity: Leads2bEntity;
};

export type AttributionBatchResult = {
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    withEvents: number;
    withoutEvents: number;
  };
  results: AttributionBatchRecordResult[];
};

export type AttributionBatchRecordResult =
  | {
      ok: true;
      id: string;
      entity: Leads2bEntity;
      events: {
        conversionsCount: number;
        trackingCount: number;
      };
      attribution: AttributionDiagnosis;
      warnings: string[];
    }
  | {
      ok: false;
      id: string;
      entity: Leads2bEntity;
      error: string;
    };

export async function diagnoseAttributionBatch(input: {
  records: AttributionBatchRecord[];
  includeRaw?: boolean;
  ignoreLookupError?: (error: unknown) => boolean;
  getEvents: (input: AttributionBatchRecord) => Promise<{ conversions: unknown[]; tracking: unknown[] }>;
}): Promise<AttributionBatchResult> {
  const results: AttributionBatchRecordResult[] = [];

  for (const record of input.records) {
    const id = String(record.id);

    try {
      const events = await getEventsOrEmpty({
        record,
        getEvents: input.getEvents,
        ignoreLookupError: input.ignoreLookupError
      });
      const conversions = events.conversions.map((event) => toAttributionEvent(event, "conversion"));
      const tracking = events.tracking.map((event) => toAttributionEvent(event, "tracking"));
      const diagnosis = diagnoseAttribution({
        id,
        entity: record.entity,
        conversions,
        tracking
      });

      results.push({
        ok: true,
        id,
        entity: record.entity,
        events: {
          conversionsCount: conversions.length,
          trackingCount: tracking.length
        },
        attribution: input.includeRaw ? diagnosis : omitRawFromDiagnosis(diagnosis),
        warnings: diagnosis.warnings
      });
    } catch (error) {
      results.push({
        ok: false,
        id,
        entity: record.entity,
        error: error instanceof Error ? error.message : "Falha desconhecida ao diagnosticar atribuição."
      });
    }
  }

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;
  const withEvents = results.filter(
    (result) => result.ok && (result.events.conversionsCount > 0 || result.events.trackingCount > 0)
  ).length;

  return {
    summary: {
      total: input.records.length,
      succeeded,
      failed,
      withEvents,
      withoutEvents: succeeded - withEvents
    },
    results
  };
}

async function getEventsOrEmpty(input: {
  record: AttributionBatchRecord;
  getEvents: (input: AttributionBatchRecord) => Promise<{ conversions: unknown[]; tracking: unknown[] }>;
  ignoreLookupError?: (error: unknown) => boolean;
}): Promise<{ conversions: unknown[]; tracking: unknown[] }> {
  try {
    return await input.getEvents(input.record);
  } catch (error) {
    if (input.ignoreLookupError?.(error)) {
      return {
        conversions: [],
        tracking: []
      };
    }

    throw error;
  }
}

function omitRawFromDiagnosis(diagnosis: AttributionDiagnosis): AttributionDiagnosis {
  return {
    ...diagnosis,
    firstTouchObserved: diagnosis.firstTouchObserved
      ? { ...diagnosis.firstTouchObserved, raw: undefined }
      : undefined,
    lastTouchObserved: diagnosis.lastTouchObserved
      ? { ...diagnosis.lastTouchObserved, raw: undefined }
      : undefined,
    conversions: diagnosis.conversions.map((event) => ({ ...event, raw: undefined })),
    tracking: diagnosis.tracking.map((event) => ({ ...event, raw: undefined }))
  };
}

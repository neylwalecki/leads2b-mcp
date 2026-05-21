import { CustomerFindOptions, findCustomers } from "../customers/list.js";
import {
  AttributionDiagnosis,
  Leads2bEntity,
  diagnoseAttribution,
  toAttributionEvent
} from "./normalize.js";

export type CustomerAttributionDiagnosisResult = {
  matchedCustomers: number;
  scannedCustomers: number;
  entities: Leads2bEntity[];
  results: Array<{
    customerId: string;
    customer: unknown;
    diagnoses: AttributionDiagnosis[];
    entitiesWithoutEvents: Leads2bEntity[];
  }>;
};

export async function diagnoseCustomerAttribution(input: {
  customerResponse: unknown;
  find: CustomerFindOptions;
  entities: Leads2bEntity[];
  customerLimit: number;
  includeRaw?: boolean;
  ignoreLookupError?: (error: unknown) => boolean;
  getEvents: (input: {
    customerId: string;
    entity: Leads2bEntity;
  }) => Promise<{ conversions: unknown[]; tracking: unknown[] }>;
}): Promise<CustomerAttributionDiagnosisResult> {
  const customerMatches = findCustomers(input.customerResponse, {
    ...input.find,
    limit: input.customerLimit
  });
  const results: CustomerAttributionDiagnosisResult["results"] = [];

  for (const customer of customerMatches.data.customers) {
    const customerId = getCustomerId(customer);
    if (!customerId) {
      continue;
    }

    const diagnoses: AttributionDiagnosis[] = [];
    const entitiesWithoutEvents: Leads2bEntity[] = [];

    for (const entity of input.entities) {
      const events = await getEventsOrEmpty({
        customerId,
        entity,
        getEvents: input.getEvents,
        ignoreLookupError: input.ignoreLookupError
      });
      const hasEvents = events.conversions.length > 0 || events.tracking.length > 0;

      if (!hasEvents) {
        entitiesWithoutEvents.push(entity);
        continue;
      }

      const diagnosis = diagnoseAttribution({
        id: customerId,
        entity,
        conversions: events.conversions.map((event) => toAttributionEvent(event, "conversion")),
        tracking: events.tracking.map((event) => toAttributionEvent(event, "tracking"))
      });

      diagnoses.push(input.includeRaw ? diagnosis : omitRawFromDiagnosis(diagnosis));
    }

    results.push({
      customerId,
      customer,
      diagnoses,
      entitiesWithoutEvents
    });
  }

  return {
    matchedCustomers: customerMatches.data.matchedTotal,
    scannedCustomers: customerMatches.data.total,
    entities: input.entities,
    results
  };
}

async function getEventsOrEmpty(input: {
  customerId: string;
  entity: Leads2bEntity;
  getEvents: (input: {
    customerId: string;
    entity: Leads2bEntity;
  }) => Promise<{ conversions: unknown[]; tracking: unknown[] }>;
  ignoreLookupError?: (error: unknown) => boolean;
}): Promise<{ conversions: unknown[]; tracking: unknown[] }> {
  try {
    return await input.getEvents({
      customerId: input.customerId,
      entity: input.entity
    });
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

function getCustomerId(customer: unknown): string | null {
  if (!customer || typeof customer !== "object") {
    return null;
  }

  const id = (customer as { id?: unknown }).id;
  if (typeof id !== "string" && typeof id !== "number") {
    return null;
  }

  const text = String(id).trim();
  return text ? text : null;
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

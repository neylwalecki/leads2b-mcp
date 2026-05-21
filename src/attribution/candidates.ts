import type { Leads2bEntity } from "./normalize.js";

export type AttributionCandidateEntity = {
  entity: Leads2bEntity;
  conversionsCount: number;
  trackingCount: number;
};

export type AttributionCandidate = {
  customerId: string;
  name?: string;
  companyName?: string;
  entities: AttributionCandidateEntity[];
};

export type AttributionCandidateResult = {
  scannedCustomers: number;
  entities: Leads2bEntity[];
  onlyWithEvents: boolean;
  candidates: AttributionCandidate[];
};

type CustomerRecord = {
  id?: unknown;
  name?: unknown;
  company_name?: unknown;
};

export async function findAttributionCandidates(input: {
  customerResponse: unknown;
  entities: Leads2bEntity[];
  limit: number;
  onlyWithEvents?: boolean;
  ignoreLookupError?: (error: unknown) => boolean;
  getEventCounts: (input: {
    customerId: string;
    entity: Leads2bEntity;
  }) => Promise<{ conversionsCount: number; trackingCount: number }>;
}): Promise<AttributionCandidateResult> {
  const onlyWithEvents = input.onlyWithEvents ?? true;
  const customers = extractCustomers(input.customerResponse).slice(0, input.limit);
  const candidates: AttributionCandidate[] = [];

  for (const customer of customers) {
    const customerId = stringValue(customer.id);
    if (!customerId) {
      continue;
    }

    const entities: AttributionCandidateEntity[] = [];

    for (const entity of input.entities) {
      const counts = await getCountsOrEmpty({
        customerId,
        entity,
        getEventCounts: input.getEventCounts,
        ignoreLookupError: input.ignoreLookupError
      });
      const hasEvents = counts.conversionsCount > 0 || counts.trackingCount > 0;

      if (!onlyWithEvents || hasEvents) {
        entities.push({
          entity,
          conversionsCount: counts.conversionsCount,
          trackingCount: counts.trackingCount
        });
      }
    }

    if (entities.length > 0) {
      candidates.push({
        customerId,
        name: stringValue(customer.name) ?? undefined,
        companyName: stringValue(customer.company_name) ?? undefined,
        entities
      });
    }
  }

  return {
    scannedCustomers: customers.length,
    entities: input.entities,
    onlyWithEvents,
    candidates
  };
}

async function getCountsOrEmpty(input: {
  customerId: string;
  entity: Leads2bEntity;
  getEventCounts: (input: {
    customerId: string;
    entity: Leads2bEntity;
  }) => Promise<{ conversionsCount: number; trackingCount: number }>;
  ignoreLookupError?: (error: unknown) => boolean;
}): Promise<{ conversionsCount: number; trackingCount: number }> {
  try {
    return await input.getEventCounts({
      customerId: input.customerId,
      entity: input.entity
    });
  } catch (error) {
    if (input.ignoreLookupError?.(error)) {
      return {
        conversionsCount: 0,
        trackingCount: 0
      };
    }

    throw error;
  }
}

function extractCustomers(response: unknown): CustomerRecord[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    return [];
  }

  const customers = (data as { customers?: unknown }).customers;
  return Array.isArray(customers) ? (customers as CustomerRecord[]) : [];
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? text : null;
  }

  return null;
}

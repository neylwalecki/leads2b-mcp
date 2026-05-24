import { extractCustomers } from "../customers/list.js";

export type LeadOpsEntity = "CUSTOMER" | "LEAD" | "CONTACT" | "OPPORTUNITY";
export type DealEntity = "LEAD" | "OPPORTUNITY";

export type RecordSearchCriteria = {
  search?: string;
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
  company?: string;
};

export type DuplicateSignal = {
  field: "email" | "phone" | "document";
  value: string;
  recordTechnicalIds: string[];
};

export type LeadOpsRecord = {
  technicalId: string;
  entityType: LeadOpsEntity;
  leads2bId?: string;
  sourceEndpoint: string;
  basic: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  commercial: {
    operationalOrigin?: string;
    pipeline?: string;
    stage?: string;
    status?: string;
    responsible?: string;
    value?: number;
    lossReason?: string;
  };
  dates: {
    createdAt?: string;
    updatedAt?: string;
    nextActionAt?: string;
  };
  customFields?: Record<string, unknown>;
  raw?: unknown;
  warnings?: string[];
};

export type LeadOpsAttributionEvent = {
  type?: string;
  createdAt?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  host?: string | null;
  referrer?: string | null;
  normalizedSource?: string;
  normalizedChannel?: string;
  normalizedMedium?: string;
  confidence?: string;
};

export type LeadOpsAttributionSummary = {
  firstTouchObserved?: LeadOpsAttributionEvent;
  lastTouchObserved?: LeadOpsAttributionEvent;
  lastConversion?: LeadOpsAttributionEvent;
  warnings?: string[];
};

export function findRecordsFromSources(input: {
  criteria: RecordSearchCriteria;
  customersResponse?: unknown;
  dealResponses?: Array<{ entity: DealEntity; response: unknown }>;
  requestedEntities?: LeadOpsEntity[];
  limit?: number;
  offset?: number;
  includeRaw?: boolean;
}): {
  records: LeadOpsRecord[];
  totalScanned: number;
  matchedTotal: number;
  offset: number;
  limit: number;
  criteria: RecordSearchCriteria;
  requestedEntities: LeadOpsEntity[];
  duplicateSignals: DuplicateSignal[];
  warnings: string[];
} {
  const requestedEntities = input.requestedEntities ?? ["CUSTOMER", "LEAD", "CONTACT", "OPPORTUNITY"];
  const records: LeadOpsRecord[] = [];
  const warnings: string[] = [];

  if (requestedEntities.includes("CUSTOMER") && input.customersResponse !== undefined) {
    records.push(
      ...extractCustomers(input.customersResponse).map((customer) =>
        customerToRecord(customer, Boolean(input.includeRaw))
      )
    );
  }

  for (const dealResponse of input.dealResponses ?? []) {
    if (!requestedEntities.includes(dealResponse.entity)) {
      continue;
    }

    records.push(
      ...extractRows(dealResponse.response).map((deal) =>
        dealToRecord(deal, dealResponse.entity, Boolean(input.includeRaw))
      )
    );
  }

  if (requestedEntities.includes("CONTACT")) {
    warnings.push("Busca direta de CONTACT ainda não tem endpoint confiável; resultados podem ser parciais.");
  }

  const uniqueRecords = dedupeByTechnicalId(records);
  const matched = uniqueRecords.filter((record) => recordMatchesCriteria(record, input.criteria));
  const offset = input.offset ?? 0;
  const limit = input.limit ?? matched.length;
  const sliced = matched.slice(offset, offset + limit);

  return {
    records: sliced,
    totalScanned: uniqueRecords.length,
    matchedTotal: matched.length,
    offset,
    limit,
    criteria: input.criteria,
    requestedEntities,
    duplicateSignals: findDuplicateSignals(matched),
    warnings
  };
}

export function listRecentOpportunitiesFromDeals(input: {
  response: unknown;
  filters?: {
    createdFrom?: string;
    createdTo?: string;
    status?: string;
    pipeline?: string;
    stage?: string;
    responsible?: string;
    search?: string;
  };
  limit?: number;
  offset?: number;
  includeRaw?: boolean;
}): {
  opportunities: LeadOpsRecord[];
  totalAvailable?: number;
  fetchedTotal: number;
  matchedTotal: number;
  offset: number;
  limit: number;
  filters: NonNullable<typeof input.filters>;
  warnings: string[];
} {
  const opportunities = extractRows(input.response).map((deal) =>
    dealToRecord(deal, "OPPORTUNITY", Boolean(input.includeRaw))
  );
  const filters = input.filters ?? {};
  const matched = opportunities.filter((opportunity) => opportunityMatchesFilters(opportunity, filters));
  const sorted = [...matched].sort((a, b) => compareDateDesc(bestDate(a), bestDate(b)));
  const offset = input.offset ?? 0;
  const limit = input.limit ?? sorted.length;

  return {
    opportunities: sorted.slice(offset, offset + limit),
    totalAvailable: extractTotal(input.response),
    fetchedTotal: opportunities.length,
    matchedTotal: matched.length,
    offset,
    limit,
    filters,
    warnings: [
      "Filtros de oportunidade são aplicados localmente sobre a janela buscada; aumente fetchLimit se precisar ampliar cobertura."
    ]
  };
}

export function buildLeadOpsCandidates(input: {
  records: LeadOpsRecord[];
  attributionByTechnicalId?: Record<string, LeadOpsAttributionSummary | undefined>;
  duplicateSignals?: DuplicateSignal[];
}): {
  candidates: Array<{
    technicalId: string;
    primaryEntity: {
      id?: string;
      type: LeadOpsEntity;
    };
    lead: LeadOpsRecord["basic"];
    commercial: LeadOpsRecord["commercial"] & {
      dates: LeadOpsRecord["dates"];
      customFields?: Record<string, unknown>;
    };
    attribution: {
      firstTouchObserved?: LeadOpsAttributionEvent;
      lastTouchObserved?: LeadOpsAttributionEvent;
      lastConversion?: LeadOpsAttributionEvent;
      conversionPage?: string;
      utms: {
        source?: string;
        medium?: string;
        campaign?: string;
        term?: string;
        content?: string;
      };
      clickIds: {
        gclid?: string;
        fbclid?: string;
      };
    };
    duplicateSignals: DuplicateSignal[];
    missingFields: string[];
    warnings: string[];
  }>;
  summary: {
    total: number;
    withAttribution: number;
    withWarnings: number;
  };
} {
  const duplicateSignals = input.duplicateSignals ?? findDuplicateSignals(input.records);
  const candidates = input.records.map((record) => {
    const attribution = input.attributionByTechnicalId?.[record.technicalId];
    const attributionEvent = attribution?.lastConversion ?? attribution?.lastTouchObserved ?? attribution?.firstTouchObserved;
    const candidateWarnings = [...(record.warnings ?? []), ...(attribution?.warnings ?? [])];

    return {
      technicalId: record.technicalId,
      primaryEntity: {
        id: record.leads2bId,
        type: record.entityType
      },
      lead: record.basic,
      commercial: {
        ...record.commercial,
        dates: record.dates,
        customFields: record.customFields
      },
      attribution: {
        firstTouchObserved: attribution?.firstTouchObserved,
        lastTouchObserved: attribution?.lastTouchObserved,
        lastConversion: attribution?.lastConversion,
        conversionPage: attributionEvent?.host ?? attributionEvent?.referrer ?? undefined,
        utms: {
          source: attributionEvent?.utmSource ?? undefined,
          medium: attributionEvent?.utmMedium ?? undefined,
          campaign: attributionEvent?.utmCampaign ?? undefined,
          term: attributionEvent?.utmTerm ?? undefined,
          content: attributionEvent?.utmContent ?? undefined
        },
        clickIds: {
          gclid: attributionEvent?.gclid ?? undefined,
          fbclid: attributionEvent?.fbclid ?? undefined
        }
      },
      duplicateSignals: duplicateSignals.filter((signal) =>
        signal.recordTechnicalIds.includes(record.technicalId)
      ),
      missingFields: missingFields(record, attribution),
      warnings: candidateWarnings
    };
  });

  return {
    candidates,
    summary: {
      total: candidates.length,
      withAttribution: candidates.filter(
        (candidate) => candidate.attribution.firstTouchObserved || candidate.attribution.lastTouchObserved
      ).length,
      withWarnings: candidates.filter((candidate) => candidate.warnings.length > 0).length
    }
  };
}

export function recordDetailFromRaw(input: {
  entityType: LeadOpsEntity;
  raw: unknown;
  includeRaw?: boolean;
}): LeadOpsRecord {
  if (input.entityType === "CUSTOMER") {
    return customerToRecord(asRecord(input.raw), Boolean(input.includeRaw));
  }

  if (input.entityType === "LEAD" || input.entityType === "OPPORTUNITY") {
    return dealToRecord(asRecord(input.raw), input.entityType, Boolean(input.includeRaw));
  }

  const record = asRecord(input.raw);
  const id = firstString(record.id, record.id_contact);

  return {
    technicalId: `CONTACT:${id ?? "unknown"}`,
    entityType: "CONTACT",
    leads2bId: id,
    sourceEndpoint: "unknown",
    basic: basicFromRecord(record),
    commercial: commercialFromRecord(record),
    dates: datesFromRecord(record),
    customFields: customFieldsFromRecord(record),
    raw: input.includeRaw ? input.raw : undefined,
    warnings: ["Detalhe direto de CONTACT ainda não tem endpoint confiável."]
  };
}

function customerToRecord(customer: Record<string, unknown>, includeRaw: boolean): LeadOpsRecord {
  const id = firstString(customer.id);

  return {
    technicalId: `CUSTOMER:${id ?? "unknown"}`,
    entityType: "CUSTOMER",
    leads2bId: id,
    sourceEndpoint: "/customer/index",
    basic: {
      name: firstString(customer.name),
      company: firstString(customer.company_name, customer.social_reason),
      email: firstString(customer.email),
      phone: firstString(customer.phone_com, customer.cel_phone, customer.phone),
      document: firstString(customer.cnpj, customer.cpf)
    },
    commercial: {
      operationalOrigin: firstString(customer.origin_name, customer.id_origin),
      responsible: firstString(customer.user_name, customer.id_user)
    },
    dates: {
      createdAt: firstString(customer.create_date, customer.created_at),
      updatedAt: firstString(customer.update_date, customer.updated_at)
    },
    customFields: customFieldsFromRecord(customer),
    raw: includeRaw ? customer : undefined
  };
}

function dealToRecord(deal: Record<string, unknown>, entity: DealEntity, includeRaw: boolean): LeadOpsRecord {
  const id = firstString(deal.id);

  return {
    technicalId: `${entity}:${id ?? "unknown"}`,
    entityType: entity,
    leads2bId: id,
    sourceEndpoint: "/deals",
    basic: basicFromRecord(deal),
    commercial: commercialFromRecord(deal),
    dates: datesFromRecord(deal),
    customFields: customFieldsFromRecord(deal),
    raw: includeRaw ? deal : undefined
  };
}

function basicFromRecord(record: Record<string, unknown>): LeadOpsRecord["basic"] {
  return {
    name: firstString(record.mainContactName, record.main_contact, record.name),
    company: firstString(record.company_name, record.social_reason),
    email: firstString(record.mainContactEmail, record.email),
    phone: firstString(record.mainContactPhone, record.phone, record.phone_com, record.cel_phone),
    document: firstString(record.cnpj, record.cpf, record.document)
  };
}

function commercialFromRecord(record: Record<string, unknown>): LeadOpsRecord["commercial"] {
  return {
    operationalOrigin: firstString(record.origin_name, record.id_origin),
    pipeline: firstString(record.pipeline_name),
    stage: firstString(record.pipeline_item_name, record.pipeline_item_value),
    status: firstString(record.status, record.pipeline_item_value, record.temperature),
    responsible: firstString(record.user_name, record.id_user),
    value: numberValue(record.value, record.pipeline_item_value),
    lossReason: firstString(record.loss_reason_name, record.loss_reason)
  };
}

function datesFromRecord(record: Record<string, unknown>): LeadOpsRecord["dates"] {
  return {
    createdAt: firstString(record.created_at, record.create_date),
    updatedAt: firstString(record.updated_at, record.update_date),
    nextActionAt: firstString(record.next_action_date)
  };
}

function customFieldsFromRecord(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const customFields: Record<string, unknown> = {};

  for (const key of ["parameters", "contactParameters", "custom_fields", "fields"]) {
    const value = record[key];
    if (value && typeof value === "object") {
      customFields[key] = value;
    }
  }

  return Object.keys(customFields).length > 0 ? customFields : undefined;
}

function extractRows(response: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(response)) {
    return response.filter(isRecord);
  }

  if (!isRecord(response)) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data.filter(isRecord);
  }

  if (isRecord(response.data)) {
    for (const key of ["deals", "items", "results", "customers"]) {
      const value = response.data[key];
      if (Array.isArray(value)) {
        return value.filter(isRecord);
      }
    }
  }

  return [];
}

function extractTotal(response: unknown): number | undefined {
  if (!isRecord(response)) {
    return undefined;
  }

  const total = response.total;
  return typeof total === "number" ? total : undefined;
}

function dedupeByTechnicalId(records: LeadOpsRecord[]): LeadOpsRecord[] {
  const map = new Map<string, LeadOpsRecord>();

  for (const record of records) {
    if (!map.has(record.technicalId)) {
      map.set(record.technicalId, record);
    }
  }

  return [...map.values()];
}

function recordMatchesCriteria(record: LeadOpsRecord, criteria: RecordSearchCriteria): boolean {
  const checks: boolean[] = [];

  if (criteria.search) {
    checks.push(searchText(record).includes(normalizeText(criteria.search)));
  }

  if (criteria.email) {
    const needle = normalizeEmail(criteria.email);
    checks.push(splitEmails(record.basic.email).some((email) => email === needle));
  }

  if (criteria.phone) {
    const needle = onlyDigits(criteria.phone);
    const phone = onlyDigits(record.basic.phone);
    checks.push(Boolean(needle && phone) && (phone.includes(needle) || needle.includes(phone)));
  }

  if (criteria.document) {
    const needle = onlyDigits(criteria.document);
    const document = onlyDigits(record.basic.document);
    checks.push(Boolean(needle && document) && document === needle);
  }

  if (criteria.name) {
    checks.push(normalizeText(record.basic.name).includes(normalizeText(criteria.name)));
  }

  if (criteria.company) {
    checks.push(normalizeText(record.basic.company).includes(normalizeText(criteria.company)));
  }

  return checks.length === 0 || checks.every(Boolean);
}

function opportunityMatchesFilters(
  opportunity: LeadOpsRecord,
  filters: {
    createdFrom?: string;
    createdTo?: string;
    status?: string;
    pipeline?: string;
    stage?: string;
    responsible?: string;
    search?: string;
  }
): boolean {
  if (filters.createdFrom && !dateAtOrAfter(opportunity.dates.createdAt, filters.createdFrom)) {
    return false;
  }

  if (filters.createdTo && !dateAtOrBefore(opportunity.dates.createdAt, filters.createdTo)) {
    return false;
  }

  if (filters.status && !normalizeText(opportunity.commercial.status).includes(normalizeText(filters.status))) {
    return false;
  }

  if (filters.pipeline && !normalizeText(opportunity.commercial.pipeline).includes(normalizeText(filters.pipeline))) {
    return false;
  }

  if (filters.stage && !normalizeText(opportunity.commercial.stage).includes(normalizeText(filters.stage))) {
    return false;
  }

  if (
    filters.responsible &&
    !normalizeText(opportunity.commercial.responsible).includes(normalizeText(filters.responsible))
  ) {
    return false;
  }

  if (filters.search && !searchText(opportunity).includes(normalizeText(filters.search))) {
    return false;
  }

  return true;
}

function findDuplicateSignals(records: LeadOpsRecord[]): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];
  const fields: Array<DuplicateSignal["field"]> = ["email", "phone", "document"];

  for (const field of fields) {
    const grouped = new Map<string, string[]>();

    for (const record of records) {
      const value = duplicateValue(record, field);
      if (!value) {
        continue;
      }

      grouped.set(value, [...(grouped.get(value) ?? []), record.technicalId]);
    }

    for (const [value, recordTechnicalIds] of grouped.entries()) {
      if (recordTechnicalIds.length > 1) {
        signals.push({
          field,
          value,
          recordTechnicalIds
        });
      }
    }
  }

  return signals;
}

function duplicateValue(record: LeadOpsRecord, field: DuplicateSignal["field"]): string | null {
  if (field === "email") {
    return normalizeEmail(record.basic.email);
  }

  if (field === "phone") {
    return onlyDigits(record.basic.phone) || null;
  }

  return onlyDigits(record.basic.document) || null;
}

function missingFields(record: LeadOpsRecord, attribution?: LeadOpsAttributionSummary): string[] {
  const missing: string[] = [];

  if (!record.basic.name) missing.push("name");
  if (!record.basic.company) missing.push("company");
  if (!record.basic.email) missing.push("email");
  if (!record.basic.phone) missing.push("phone");
  if (!record.basic.document) missing.push("document");
  if (!record.commercial.operationalOrigin) missing.push("operationalOrigin");
  if (!attribution?.firstTouchObserved) missing.push("firstTouchObserved");
  if (!attribution?.lastTouchObserved) missing.push("lastTouchObserved");

  return missing;
}

function searchText(record: LeadOpsRecord): string {
  return [
    record.technicalId,
    record.leads2bId,
    record.entityType,
    record.basic.name,
    record.basic.company,
    record.basic.email,
    record.basic.phone,
    record.basic.document,
    record.commercial.operationalOrigin,
    record.commercial.pipeline,
    record.commercial.stage,
    record.commercial.status,
    record.commercial.responsible
  ]
    .map(normalizeText)
    .join(" ");
}

function bestDate(record: LeadOpsRecord): string | undefined {
  return record.dates.updatedAt ?? record.dates.createdAt ?? record.dates.nextActionAt;
}

function compareDateDesc(a?: string, b?: string): number {
  const aTime = parseDate(a) ?? 0;
  const bTime = parseDate(b) ?? 0;
  return bTime - aTime;
}

function dateAtOrAfter(value: string | undefined, start: string): boolean {
  const valueTime = parseDate(value);
  const startTime = parseDate(start);
  return valueTime !== undefined && startTime !== undefined && valueTime >= startTime;
}

function dateAtOrBefore(value: string | undefined, end: string): boolean {
  const valueTime = parseDate(value);
  const endTime = parseDate(end);
  return valueTime !== undefined && endTime !== undefined && valueTime <= endTime + 86_399_999;
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function splitEmails(value: unknown): string[] {
  return textValue(value)
    .split(/[;,]/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function normalizeEmail(value: unknown): string {
  return textValue(value).trim().toLowerCase();
}

function onlyDigits(value: unknown): string {
  return textValue(value).replace(/\D/g, "");
}

function normalizeText(value: unknown): string {
  return textValue(value).trim().toLowerCase();
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }

  return undefined;
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/\./g, "").replace(",", ".");
      const number = Number(normalized);
      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

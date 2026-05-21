export type Leads2bEntity = "LEAD" | "CONTACT" | "OPPORTUNITY";
export type AttributionEventType = "tracking" | "conversion";
export type AttributionChannel =
  | "paid_search"
  | "organic_search"
  | "paid_social"
  | "organic_social"
  | "ai_referral"
  | "referral"
  | "direct"
  | "unknown";
export type AttributionConfidence = "high" | "medium" | "low";

export type NormalizeAttributionInput = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  g_clid?: string | null;
  fbclid?: string | null;
  fb_clid?: string | null;
  referrer?: string | null;
  host?: string | null;
  vendorLeadOrigin?: string | null;
};

export type NormalizedAttribution = {
  normalizedSource: string;
  normalizedMedium?: string;
  channel: AttributionChannel;
  confidence: AttributionConfidence;
  evidence: string[];
  vendorDisagreement?: {
    vendorLeadOrigin?: string | null;
    reason: string;
  };
};

export type AttributionEvent = {
  id?: string;
  type: AttributionEventType;
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
  vendorLeadOrigin?: string | null;
  normalizedChannel: AttributionChannel;
  normalizedSource: string;
  normalizedMedium?: string;
  confidence: AttributionConfidence;
  evidence: string[];
  raw?: unknown;
};

export type AttributionDiagnosis = {
  entity: Leads2bEntity;
  id: string;
  firstTouchObserved?: AttributionEvent;
  lastTouchObserved?: AttributionEvent;
  conversions: AttributionEvent[];
  tracking: AttributionEvent[];
  warnings: string[];
  recommendation?: string;
};

const AI_SOURCES = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
  "perplexity.ai",
  "poe.com"
]);

const SEARCH_SOURCES = new Set(["google", "google.com", "bing", "bing.com", "yahoo", "duckduckgo"]);
const SOCIAL_SOURCES = new Set([
  "facebook",
  "facebook.com",
  "fb",
  "instagram",
  "instagram.com",
  "linkedin",
  "linkedin.com",
  "meta",
  "twitter",
  "twitter.com",
  "x",
  "x.com"
]);
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paid_search", "paid-social", "paid_social"]);
const ORGANIC_MEDIUMS = new Set(["organic", "organic_search", "seo"]);

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function lower(value: string | null | undefined): string | null {
  return clean(value)?.toLowerCase() ?? null;
}

function hostFrom(value: string | null | undefined): string | null {
  const cleaned = lower(value);
  if (!cleaned) {
    return null;
  }

  try {
    const url = cleaned.startsWith("http") ? new URL(cleaned) : new URL(`https://${cleaned}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return cleaned.replace(/^www\./, "").split("/")[0] ?? cleaned;
  }
}

function titleizeSource(value: string): string {
  return value
    .replace(/^www\./, "")
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstPresent(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function vendorLooksAligned(vendorLeadOrigin: string, result: NormalizedAttribution): boolean {
  const vendor = vendorLeadOrigin.toLowerCase();

  if (result.channel === "ai_referral") {
    return vendor.includes("ai") || vendor.includes("llm") || vendor.includes("chatgpt");
  }

  if (result.channel === "paid_search" || result.channel === "paid_social") {
    return vendor.includes("paid") || vendor.includes("pago") || vendor.includes("ads") || vendor.includes("cpc");
  }

  if (result.channel === "organic_search" || result.channel === "organic_social") {
    return vendor.includes("organic") || vendor.includes("orgânico") || vendor.includes("organico");
  }

  if (result.channel === "direct") {
    return vendor.includes("direct") || vendor.includes("direto");
  }

  return vendor.includes(result.normalizedSource.toLowerCase());
}

function withVendorCheck(
  result: Omit<NormalizedAttribution, "vendorDisagreement">,
  vendorLeadOrigin?: string | null
): NormalizedAttribution {
  const vendor = clean(vendorLeadOrigin);
  if (!vendor || result.channel === "unknown") {
    return result;
  }

  const fullResult: NormalizedAttribution = result;
  if (vendorLooksAligned(vendor, fullResult)) {
    return fullResult;
  }

  return {
    ...fullResult,
    vendorDisagreement: {
      vendorLeadOrigin: vendor,
      reason: "A classificação resumida do fornecedor diverge dos sinais brutos observados."
    }
  };
}

export function normalizeAttributionSource(input: NormalizeAttributionInput): NormalizedAttribution {
  const utmSource = lower(input.utm_source);
  const utmMedium = lower(input.utm_medium);
  const referrerHost = hostFrom(input.referrer);
  const sourceHost = hostFrom(utmSource);
  const gclid = firstPresent(input.gclid, input.g_clid);
  const fbclid = firstPresent(input.fbclid, input.fb_clid);
  const evidence: string[] = [];

  if (gclid) {
    evidence.push("gclid/g_clid present");
    if (utmMedium) {
      evidence.push(`utm_medium=${utmMedium}`);
    }

    return withVendorCheck(
      {
        normalizedSource: "Google Ads",
        normalizedMedium: "Paid Search",
        channel: "paid_search",
        confidence: "high",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (fbclid) {
    evidence.push("fbclid/fb_clid present");

    return withVendorCheck(
      {
        normalizedSource: "Meta Ads",
        normalizedMedium: "Paid Social",
        channel: "paid_social",
        confidence: "high",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (sourceHost && AI_SOURCES.has(sourceHost)) {
    evidence.push(`utm_source=${sourceHost}`);

    return withVendorCheck(
      {
        normalizedSource: "AI / LLM Referral",
        channel: "ai_referral",
        confidence: "high",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (utmMedium && PAID_MEDIUMS.has(utmMedium)) {
    evidence.push(`utm_medium=${utmMedium}`);
    if (utmSource) {
      evidence.push(`utm_source=${utmSource}`);
    }

    const isSocial = sourceHost ? SOCIAL_SOURCES.has(sourceHost) : false;

    return withVendorCheck(
      {
        normalizedSource: isSocial ? `${titleizeSource(sourceHost ?? "social")} Ads` : "Paid Search",
        normalizedMedium: isSocial ? "Paid Social" : "Paid Search",
        channel: isSocial ? "paid_social" : "paid_search",
        confidence: utmSource ? "medium" : "low",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (utmMedium && ORGANIC_MEDIUMS.has(utmMedium)) {
    evidence.push(`utm_medium=${utmMedium}`);
    if (utmSource) {
      evidence.push(`utm_source=${utmSource}`);
    }

    const isSocial = sourceHost ? SOCIAL_SOURCES.has(sourceHost) : false;

    return withVendorCheck(
      {
        normalizedSource: sourceHost ? titleizeSource(sourceHost) : "Organic Search",
        normalizedMedium: isSocial ? "Organic Social" : "Organic Search",
        channel: isSocial ? "organic_social" : "organic_search",
        confidence: utmSource ? "medium" : "low",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (utmSource) {
    evidence.push(`utm_source=${utmSource}`);

    return withVendorCheck(
      {
        normalizedSource: sourceHost ? titleizeSource(sourceHost) : utmSource,
        channel: "referral",
        confidence: "medium",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (referrerHost) {
    evidence.push(`referrer=${referrerHost}`);

    return withVendorCheck(
      {
        normalizedSource: titleizeSource(referrerHost),
        channel: "referral",
        confidence: "medium",
        evidence
      },
      input.vendorLeadOrigin
    );
  }

  if (!input.host) {
    return withVendorCheck(
      {
        normalizedSource: "Unknown",
        channel: "unknown",
        confidence: "low",
        evidence: ["no UTM, click ID, host or referrer observed"]
      },
      input.vendorLeadOrigin
    );
  }

  return withVendorCheck(
    {
      normalizedSource: "Direct",
      channel: "direct",
      confidence: "low",
      evidence: ["no UTM, click ID or external referrer observed"]
    },
    input.vendorLeadOrigin
  );
}

function valueFromRecord(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return null;
}

export function toAttributionEvent(raw: unknown, type: AttributionEventType): AttributionEvent {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const gclid = firstPresent(valueFromRecord(record, "gclid"), valueFromRecord(record, "g_clid"));
  const fbclid = firstPresent(valueFromRecord(record, "fbclid"), valueFromRecord(record, "fb_clid"));
  const vendorLeadOrigin = valueFromRecord(record, "lead_origin");
  const normalized = normalizeAttributionSource({
    utm_source: valueFromRecord(record, "utm_source"),
    utm_medium: valueFromRecord(record, "utm_medium"),
    utm_campaign: valueFromRecord(record, "utm_campaign"),
    utm_term: valueFromRecord(record, "utm_term"),
    utm_content: valueFromRecord(record, "utm_content"),
    gclid,
    fbclid,
    referrer: valueFromRecord(record, "referrer"),
    host: valueFromRecord(record, "host"),
    vendorLeadOrigin
  });

  return {
    id: valueFromRecord(record, "id") ?? undefined,
    type,
    createdAt:
      valueFromRecord(record, "created_at") ?? valueFromRecord(record, "message_date_sql") ?? undefined,
    utmSource: valueFromRecord(record, "utm_source"),
    utmMedium: valueFromRecord(record, "utm_medium"),
    utmCampaign: valueFromRecord(record, "utm_campaign"),
    utmTerm: valueFromRecord(record, "utm_term"),
    utmContent: valueFromRecord(record, "utm_content"),
    gclid,
    fbclid,
    host: valueFromRecord(record, "host"),
    referrer: valueFromRecord(record, "referrer"),
    vendorLeadOrigin,
    normalizedChannel: normalized.channel,
    normalizedSource: normalized.normalizedSource,
    normalizedMedium: normalized.normalizedMedium,
    confidence: normalized.confidence,
    evidence: normalized.evidence,
    raw
  };
}

function sortByObservedDate(events: AttributionEvent[]): AttributionEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

function hasVendorDisagreement(event: AttributionEvent): boolean {
  const normalized = normalizeAttributionSource({
    utm_source: event.utmSource,
    utm_medium: event.utmMedium,
    utm_campaign: event.utmCampaign,
    utm_term: event.utmTerm,
    utm_content: event.utmContent,
    gclid: event.gclid,
    fbclid: event.fbclid,
    host: event.host,
    referrer: event.referrer,
    vendorLeadOrigin: event.vendorLeadOrigin
  });

  return Boolean(normalized.vendorDisagreement);
}

export function diagnoseAttribution(input: {
  id: string | number;
  entity: Leads2bEntity;
  conversions: AttributionEvent[];
  tracking: AttributionEvent[];
}): AttributionDiagnosis {
  const conversions = sortByObservedDate(input.conversions);
  const tracking = sortByObservedDate(input.tracking);
  const allEvents = sortByObservedDate([...tracking, ...conversions]);
  const firstTouchObserved = allEvents[0];
  const lastTouchObserved = allEvents.at(-1);
  const warnings: string[] = [];

  if (allEvents.length === 0) {
    warnings.push("Nenhum evento de tracking ou conversão foi observado para esta entidade.");
  }

  if (allEvents.some(hasVendorDisagreement)) {
    warnings.push("A origem classificada pela Leads2b diverge da UTM bruta observada.");
    warnings.push(
      "O relatório deve tratar a origem do fornecedor como classificação resumida, não como fonte comprovada."
    );
  }

  const recommendationSource = lastTouchObserved?.utmSource ?? firstTouchObserved?.utmSource;
  const recommendation = recommendationSource
    ? `Usar utm_source=${recommendationSource} como evidência principal e classificar localmente como ${lastTouchObserved?.normalizedSource ?? firstTouchObserved?.normalizedSource}.`
    : "Usar os eventos observados pela API como diagnóstico parcial; first touch absoluto pode depender de dados não expostos pela Leads2b.";

  return {
    entity: input.entity,
    id: String(input.id),
    firstTouchObserved,
    lastTouchObserved,
    conversions,
    tracking,
    warnings,
    recommendation
  };
}

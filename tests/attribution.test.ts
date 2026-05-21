import { describe, expect, it } from "vitest";
import conversionsFixture from "./fixtures/conversions.chatgpt.json" with { type: "json" };
import trackingFixture from "./fixtures/tracking.chatgpt.json" with { type: "json" };
import {
  diagnoseAttribution,
  normalizeAttributionSource,
  toAttributionEvent
} from "../src/attribution/normalize.js";

describe("normalizeAttributionSource", () => {
  it("prioritizes Google click IDs over summarized or conflicting medium values", () => {
    const result = normalizeAttributionSource({
      utm_source: "google",
      utm_medium: "organic",
      g_clid: "example-click-id",
      vendorLeadOrigin: "organic | Google"
    });

    expect(result.channel).toBe("paid_search");
    expect(result.normalizedSource).toBe("Google Ads");
    expect(result.confidence).toBe("high");
    expect(result.evidence).toContain("gclid/g_clid present");
  });

  it("classifies known AI and LLM domains as AI referral", () => {
    const result = normalizeAttributionSource({
      utm_source: "chatgpt.com",
      host: "example.com",
      vendorLeadOrigin: "organic | Twitter"
    });

    expect(result.channel).toBe("ai_referral");
    expect(result.normalizedSource).toBe("AI / LLM Referral");
    expect(result.confidence).toBe("high");
    expect(result.vendorDisagreement?.vendorLeadOrigin).toBe("organic | Twitter");
  });
});

describe("diagnoseAttribution", () => {
  it("calculates observed first touch, observed last touch and vendor disagreements from fictional fixtures", () => {
    const tracking = trackingFixture.data.map((event) => toAttributionEvent(event, "tracking"));
    const conversions = conversionsFixture.data.map((event) => toAttributionEvent(event, "conversion"));

    const diagnosis = diagnoseAttribution({
      id: "123",
      entity: "OPPORTUNITY",
      tracking,
      conversions
    });

    expect(diagnosis.firstTouchObserved?.type).toBe("tracking");
    expect(diagnosis.firstTouchObserved?.createdAt).toBe("2026-05-19T14:16:18.000Z");
    expect(diagnosis.lastTouchObserved?.type).toBe("conversion");
    expect(diagnosis.lastTouchObserved?.createdAt).toBe("2026-05-19T14:16:58.000Z");
    expect(diagnosis.lastTouchObserved?.normalizedChannel).toBe("ai_referral");
    expect(diagnosis.warnings).toContain(
      "A origem classificada pela Leads2b diverge da UTM bruta observada."
    );
    expect(diagnosis.recommendation).toContain("utm_source=chatgpt.com");
  });

  it("keeps the raw source evidence visible without treating vendor lead_origin as truth", () => {
    const event = toAttributionEvent(conversionsFixture.data[0], "conversion");

    expect(event.utmSource).toBe("chatgpt.com");
    expect(event.vendorLeadOrigin).toBe("organic | Twitter");
    expect(event.normalizedSource).toBe("AI / LLM Referral");
  });
});

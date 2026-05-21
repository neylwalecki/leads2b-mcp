import { describe, expect, it } from "vitest";
import customerFixture from "./fixtures/customer-index.example.json" with { type: "json" };
import { diagnoseCustomerAttribution } from "../src/attribution/customer-diagnosis.js";

describe("diagnoseCustomerAttribution", () => {
  it("finds a customer locally and diagnoses v2 attribution events for matching entities", async () => {
    const result = await diagnoseCustomerAttribution({
      customerResponse: customerFixture,
      find: {
        email: "lead@example.com"
      },
      entities: ["OPPORTUNITY", "LEAD"],
      customerLimit: 5,
      getEvents: async ({ customerId, entity }) => {
        if (customerId === "100" && entity === "OPPORTUNITY") {
          return {
            conversions: [
              {
                id: "conversion-1",
                created_at: "2026-05-20T10:02:00.000Z",
                utm_source: "chatgpt.com",
                lead_origin: "organic | Twitter",
                host: "example.com/contact"
              }
            ],
            tracking: [
              {
                id: "tracking-1",
                created_at: "2026-05-20T10:00:00.000Z",
                utm_source: "chatgpt.com",
                host: "example.com"
              }
            ]
          };
        }

        return {
          conversions: [],
          tracking: []
        };
      }
    });

    expect(result.matchedCustomers).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.customerId).toBe("100");
    expect(result.results[0]?.diagnoses).toHaveLength(1);
    expect(result.results[0]?.diagnoses[0]?.entity).toBe("OPPORTUNITY");
    expect(result.results[0]?.diagnoses[0]?.lastTouchObserved?.normalizedChannel).toBe("ai_referral");
    expect(result.results[0]?.diagnoses[0]?.warnings).toContain(
      "A origem classificada pela Leads2b diverge da UTM bruta observada."
    );
    expect(result.results[0]?.entitiesWithoutEvents).toEqual(["LEAD"]);
  });
});

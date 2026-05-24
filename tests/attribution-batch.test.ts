import { describe, expect, it } from "vitest";
import { Leads2bHttpError } from "../src/client/http.js";
import { diagnoseAttributionBatch } from "../src/attribution/batch.js";

describe("diagnoseAttributionBatch", () => {
  it("returns one summarized result per record and does not fail the whole batch on empty lookup errors", async () => {
    const result = await diagnoseAttributionBatch({
      records: [
        {
          id: "200",
          entity: "OPPORTUNITY"
        },
        {
          id: "201",
          entity: "LEAD"
        },
        {
          id: "202",
          entity: "CONTACT"
        }
      ],
      getEvents: async ({ id, entity }) => {
        if (id === "200" && entity === "OPPORTUNITY") {
          return {
            conversions: [
              {
                id: "conversion-1",
                created_at: "2026-05-22T12:00:00.000Z",
                utm_source: "google",
                utm_medium: "cpc",
                gclid: "example-click-id",
                host: "example.com/contact"
              }
            ],
            tracking: []
          };
        }

        if (id === "201") {
          throw new Leads2bHttpError({
            status: 404,
            message: "Not found",
            endpoint: "/conversions"
          });
        }

        throw new Error("Unexpected API failure");
      },
      ignoreLookupError: (error) => error instanceof Leads2bHttpError && [400, 404, 422].includes(error.status ?? 0)
    });

    expect(result.summary).toEqual({
      total: 3,
      succeeded: 2,
      failed: 1,
      withEvents: 1,
      withoutEvents: 1
    });
    expect(result.results[0]).toMatchObject({
      ok: true,
      id: "200",
      entity: "OPPORTUNITY",
      events: {
        conversionsCount: 1,
        trackingCount: 0
      },
      attribution: {
        lastTouchObserved: {
          normalizedSource: "Google Ads"
        }
      }
    });
    expect(result.results[1]).toMatchObject({
      ok: true,
      id: "201",
      entity: "LEAD",
      events: {
        conversionsCount: 0,
        trackingCount: 0
      },
      warnings: ["Nenhum evento de tracking ou conversão foi observado para esta entidade."]
    });
    expect(result.results[2]).toMatchObject({
      ok: false,
      id: "202",
      entity: "CONTACT",
      error: "Unexpected API failure"
    });
  });
});

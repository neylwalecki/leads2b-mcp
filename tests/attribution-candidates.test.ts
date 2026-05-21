import { describe, expect, it } from "vitest";
import { findAttributionCandidates } from "../src/attribution/candidates.js";

describe("findAttributionCandidates", () => {
  it("uses customers from v1 and v2 counts to return only IDs with attribution events by default", async () => {
    const customerResponse = {
      data: {
        customers: [
          { id: "1", name: "Sem Eventos Ltda", company_name: "Sem Eventos" },
          { id: "8", name: "Com Eventos Ltda", company_name: "Com Eventos" }
        ]
      }
    };
    const counts = new Map([
      ["1:LEAD", { conversionsCount: 0, trackingCount: 0 }],
      ["1:OPPORTUNITY", { conversionsCount: 0, trackingCount: 0 }],
      ["8:LEAD", { conversionsCount: 0, trackingCount: 0 }],
      ["8:OPPORTUNITY", { conversionsCount: 2, trackingCount: 10 }]
    ]);

    const result = await findAttributionCandidates({
      customerResponse,
      entities: ["LEAD", "OPPORTUNITY"],
      limit: 10,
      getEventCounts: async ({ customerId, entity }) => counts.get(`${customerId}:${entity}`) ?? {
        conversionsCount: 0,
        trackingCount: 0
      }
    });

    expect(result.scannedCustomers).toBe(2);
    expect(result.candidates).toEqual([
      {
        customerId: "8",
        name: "Com Eventos Ltda",
        companyName: "Com Eventos",
        entities: [
          {
            entity: "OPPORTUNITY",
            conversionsCount: 2,
            trackingCount: 10
          }
        ]
      }
    ]);
  });

  it("treats ignored lookup errors as empty counts while scanning candidates", async () => {
    const result = await findAttributionCandidates({
      customerResponse: {
        data: {
          customers: [{ id: "6", name: "Erro Vazio Ltda" }]
        }
      },
      entities: ["OPPORTUNITY"],
      limit: 10,
      getEventCounts: async () => {
        throw new Error("HTTP 404");
      },
      ignoreLookupError: () => true
    });

    expect(result.scannedCustomers).toBe(1);
    expect(result.candidates).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildLeadOpsCandidates,
  findRecordsFromSources,
  listRecentOpportunitiesFromDeals
} from "../src/lead-ops/records.js";

const customerResponse = {
  data: {
    customers: [
      {
        id: "100",
        name: "Example Industries Ltda",
        company_name: "Example Industries",
        email: "lead@example.com",
        phone_com: "+55 41 99999-0000",
        cel_phone: "+55 41 98888-0000",
        cnpj: "00000000000100",
        origin_name: "Site",
        id_origin: "24",
        id_user: "8",
        create_date: "2026-05-14 10:15:48"
      }
    ]
  }
};

const opportunityDealsResponse = {
  data: [
    {
      id: "200",
      type: "OPPORTUNITY",
      name: "Example opportunity",
      company_name: "Example Industries",
      mainContactName: "Example Contact",
      mainContactEmail: "lead@example.com",
      mainContactPhone: "+55 41 99999-0000",
      email: "lead@example.com",
      phone: "+55 41 99999-0000",
      origin_name: "Site",
      pipeline_name: "Sales",
      pipeline_item_name: "Qualified",
      pipeline_item_value: "qualified",
      user_name: "Sales User",
      value: 12500,
      loss_reason_name: null,
      created_at: "2026-05-22T12:00:00.000Z",
      updated_at: "2026-05-23T12:00:00.000Z",
      parameters: {
        form_id: "contact"
      }
    },
    {
      id: "201",
      type: "OPPORTUNITY",
      name: "Older opportunity",
      company_name: "Another Company",
      mainContactEmail: "other@example.com",
      origin_name: "Referral",
      pipeline_name: "Sales",
      pipeline_item_name: "New",
      user_name: "Other User",
      created_at: "2026-05-18T12:00:00.000Z"
    }
  ],
  total: 2,
  entity: "OPPORTUNITY"
};

describe("findRecordsFromSources", () => {
  it("matches customers and opportunities by e-mail and reports duplicate signals", () => {
    const result = findRecordsFromSources({
      criteria: {
        email: "LEAD@example.com"
      },
      customersResponse: customerResponse,
      dealResponses: [
        {
          entity: "OPPORTUNITY",
          response: opportunityDealsResponse
        }
      ],
      requestedEntities: ["CUSTOMER", "OPPORTUNITY", "CONTACT"],
      limit: 10
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.entityType)).toEqual(["CUSTOMER", "OPPORTUNITY"]);
    expect(result.duplicateSignals).toEqual([
      {
        field: "email",
        value: "lead@example.com",
        recordTechnicalIds: ["CUSTOMER:100", "OPPORTUNITY:200"]
      },
      {
        field: "phone",
        value: "5541999990000",
        recordTechnicalIds: ["CUSTOMER:100", "OPPORTUNITY:200"]
      }
    ]);
    expect(result.warnings).toContain("Busca direta de CONTACT ainda não tem endpoint confiável; resultados podem ser parciais.");
  });
});

describe("listRecentOpportunitiesFromDeals", () => {
  it("filters locally, sorts by date and returns stable commercial fields", () => {
    const result = listRecentOpportunitiesFromDeals({
      response: opportunityDealsResponse,
      filters: {
        createdFrom: "2026-05-20",
        pipeline: "sales",
        stage: "qualified",
        responsible: "sales user",
        search: "example"
      },
      limit: 5,
      offset: 0
    });

    expect(result.opportunities).toEqual([
      expect.objectContaining({
        technicalId: "OPPORTUNITY:200",
        entityType: "OPPORTUNITY",
        leads2bId: "200",
        basic: expect.objectContaining({
          email: "lead@example.com",
          company: "Example Industries"
        }),
        commercial: expect.objectContaining({
          operationalOrigin: "Site",
          pipeline: "Sales",
          stage: "Qualified",
          responsible: "Sales User"
        })
      })
    ]);
    expect(result.totalAvailable).toBe(2);
    expect(result.matchedTotal).toBe(1);
  });
});

describe("buildLeadOpsCandidates", () => {
  it("combines record, commercial data and attribution into an automation-friendly schema", () => {
    const records = findRecordsFromSources({
      criteria: {
        email: "lead@example.com"
      },
      customersResponse: customerResponse,
      dealResponses: [
        {
          entity: "OPPORTUNITY",
          response: opportunityDealsResponse
        }
      ],
      requestedEntities: ["OPPORTUNITY"],
      limit: 10
    }).records;

    const result = buildLeadOpsCandidates({
      records,
      attributionByTechnicalId: {
        "OPPORTUNITY:200": {
          firstTouchObserved: {
            type: "tracking",
            createdAt: "2026-05-22T11:58:00.000Z",
            utmSource: "google",
            utmMedium: "cpc",
            gclid: "example-click-id",
            host: "example.com/contact",
            normalizedSource: "Google Ads",
            normalizedChannel: "paid_search"
          },
          lastTouchObserved: {
            type: "conversion",
            createdAt: "2026-05-22T12:00:00.000Z",
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "example_campaign",
            gclid: "example-click-id",
            host: "example.com/contact",
            normalizedSource: "Google Ads",
            normalizedChannel: "paid_search"
          },
          lastConversion: {
            type: "conversion",
            createdAt: "2026-05-22T12:00:00.000Z",
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "example_campaign",
            gclid: "example-click-id",
            host: "example.com/contact",
            normalizedSource: "Google Ads",
            normalizedChannel: "paid_search"
          },
          warnings: []
        }
      }
    });

    expect(result.candidates).toEqual([
      expect.objectContaining({
        technicalId: "OPPORTUNITY:200",
        primaryEntity: {
          id: "200",
          type: "OPPORTUNITY"
        },
        lead: expect.objectContaining({
          email: "lead@example.com",
          company: "Example Industries"
        }),
        commercial: expect.objectContaining({
          operationalOrigin: "Site",
          pipeline: "Sales"
        }),
        attribution: expect.objectContaining({
          firstTouchObserved: expect.objectContaining({
            normalizedSource: "Google Ads"
          }),
          lastConversion: expect.objectContaining({
            utmCampaign: "example_campaign"
          }),
          utms: {
            source: "google",
            medium: "cpc",
            campaign: "example_campaign",
            term: undefined,
            content: undefined
          },
          clickIds: {
            gclid: "example-click-id",
            fbclid: undefined
          },
          conversionPage: "example.com/contact"
        }),
        missingFields: expect.arrayContaining(["document"])
      })
    ]);
  });
});

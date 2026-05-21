import "dotenv/config";
import { describe, expect, it } from "vitest";
import { findAttributionCandidates } from "../src/attribution/candidates.js";
import { Leads2bHttpClient, Leads2bHttpError } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";
import { loadConfig } from "../src/config.js";
import { extractCustomers } from "../src/customers/list.js";

const runIntegration = process.env.RUN_LEADS2B_INTEGRATION_TESTS === "true";

describe.skipIf(!runIntegration)("Leads2b read-only integration", () => {
  const config = loadConfig();
  const v1 = new Leads2bV1Client(
    new Leads2bHttpClient({
      api: "v1",
      baseUrl: config.apiV1BaseUrl,
      token: config.apiV1Token
    })
  );
  const v2 = new Leads2bV2Client(
    new Leads2bHttpClient({
      api: "v2",
      baseUrl: config.apiV2BaseUrl,
      token: config.apiV2Token
    })
  );

  it("validates confirmed v1 and v2 read endpoints", async () => {
    expect(config.apiV1Token).toBeTruthy();
    expect(config.apiV2Token).toBeTruthy();

    await expect(v1.getLoggedUser()).resolves.toEqual(expect.any(Object));
    await expect(v1.listCustomers()).resolves.toEqual(expect.any(Object));
    await expect(v2.listUsers()).resolves.toEqual(expect.any(Object));
  });

  it("validates observed customer search, customer detail and lead detail endpoints", async () => {
    const customerResponse = await v1.listCustomers();
    const sample = extractCustomers(customerResponse).find(
      (customer) => typeof customer.email === "string" && customer.email.includes("@")
    );

    expect(sample).toBeTruthy();

    const searchResult = await v2.searchCustomers({ search: String(sample?.email) });
    const rows = Array.isArray((searchResult as { data?: unknown }).data)
      ? ((searchResult as { data: unknown[] }).data)
      : [];
    const firstRow = rows.find((row) => row && typeof row === "object") as { id?: unknown } | undefined;

    expect(rows.length).toBeGreaterThan(0);
    expect(firstRow?.id).toBeTruthy();

    await expect(v2.getCustomer({ id: String(firstRow?.id) })).resolves.toEqual(expect.any(Object));
    await expect(v1.getDefaultLead({ id: String(firstRow?.id) })).resolves.toEqual(expect.any(Object));
  });

  it("can scan attribution candidates without external mutations", async () => {
    const customerResponse = await v1.listCustomers();
    const result = await findAttributionCandidates({
      customerResponse,
      entities: ["OPPORTUNITY"],
      limit: 3,
      getEventCounts: async ({ customerId, entity }) => {
        const [conversionsResponse, trackingResponse] = await Promise.all([
          v2.getConversions({ id: customerId, entity }),
          v2.getTracking({ id: customerId, entity })
        ]);

        return {
          conversionsCount: extractEvents(conversionsResponse).length,
          trackingCount: extractEvents(trackingResponse).length
        };
      },
      ignoreLookupError: (error) =>
        error instanceof Leads2bHttpError && [400, 404, 422].includes(error.status ?? 0)
    });

    expect(result.scannedCustomers).toBeLessThanOrEqual(3);
    expect(result.entities).toEqual(["OPPORTUNITY"]);
  });
});

function extractEvents(response: unknown): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)) {
    return (response as { data: unknown[] }).data;
  }

  return [];
}

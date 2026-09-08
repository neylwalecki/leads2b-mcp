import { afterEach, expect, it } from "vitest";
import { scanLeadOps } from "../src/lead-ops/scan.js";
import { Leads2bHttpClient } from "../src/client/http.js";
import { Leads2bV1Client } from "../src/client/v1.js";
import { Leads2bV2Client } from "../src/client/v2.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const deps = {
  v1: new Leads2bV1Client(new Leads2bHttpClient({ api: "v1", baseUrl: "https://example.com/api/v1", token: "<TOKEN>", maxReadRetries: 0 })),
  v2: new Leads2bV2Client(new Leads2bHttpClient({ api: "v2", baseUrl: "https://example.com/api/v2", token: "<TOKEN>", maxReadRetries: 0 }))
};

it("includes customers without tracking and later-page opportunities while preserving technical identities", async () => {
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/customer/index')) return Response.json({ data: { customers: [{ id: 1, name: "Example", email: "lead@example.com", create_date: "2026-09-08 04:00:00", origin_name: "Manual" }] } });
    const rows = [{ id: 1, created_at: "2026-09-07T00:00:00Z" }, { id: 2, created_at: "2026-09-08T12:00:00Z", email: "lead@example.com" }];
    const offset = Number(url.searchParams.get("offset"));
    return Response.json({ data: rows.slice(offset, offset + 1), total: 2 });
  };
  const result = await scanLeadOps(deps, { entities: ["CUSTOMER", "OPPORTUNITY"], createdFrom: "2026-09-08T00:00:00-03:00", pageSize: 1, maxPages: 3, includeAttribution: false });
  expect(result.candidates.map(x => x.technicalId)).toEqual(["CUSTOMER:1", "OPPORTUNITY:2"]);
  expect(result.candidates[0].commercial.operationalOrigin).toBe("Manual");
  expect(result.candidates[0].attribution.firstTouchObserved).toBeUndefined();
  expect(result.coverage.sources.OPPORTUNITY?.status).toBe("complete");
  expect(result.coverage.sources.CUSTOMER?.status).toBe("unknown");
});

it("marks a missing source as partial instead of declaring zero new leads", async () => {
  globalThis.fetch = async input => String(input).includes("/customer/index")
    ? new Response("denied", { status: 401 }) : Response.json({ data: [], total: 0 });
  const result = await scanLeadOps(deps, { entities: ["CUSTOMER", "OPPORTUNITY"], includeAttribution: false });
  expect(result.coverage.status).toBe("partial");
  expect(result.coverage.sources.CUSTOMER).toMatchObject({ status: "partial", reason: "request_failed" });
  expect(result.warnings.length).toBeGreaterThan(0);
});

it("exposes output pagination independently from scan coverage", async () => {
  globalThis.fetch = async () => Response.json({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], total: 3 });
  const result = await scanLeadOps(deps, { entities: ["LEAD"], limit: 1, offset: 1, includeAttribution: false });
  expect(result.candidates.map(x => x.technicalId)).toEqual(["LEAD:2"]);
  expect(result.pagination).toMatchObject({ matchedTotal: 3, returned: 1, nextOffset: 2 });
  expect(result.coverage.status).toBe("complete");
});

it("reports a malformed customer envelope as partial and rejects invalid scan bounds", async () => {
  globalThis.fetch = async () => Response.json({ data: { message: "unexpected" } });
  const result = await scanLeadOps(deps, { entities: ["CUSTOMER"], includeAttribution: false });
  expect(result.coverage.status).toBe("partial");
  await expect(scanLeadOps(deps, { entities: ["LEAD"], maxPages: 0 })).rejects.toThrow("paginação");
});

it("requires an explicit correction to reinterpret mislabeled Z timestamps", async () => {
  globalThis.fetch = async () => Response.json({ data: [{ id: 1, created_at: "2026-09-08T16:30:00Z" }], total: 1 });
  const input = { entities: ["LEAD"] as const, createdFrom: "2026-09-08T16:00:00-03:00", createdTo: "2026-09-08T17:00:00-03:00", includeAttribution: false };
  const reported = await scanLeadOps(deps, { ...input, entities: [...input.entities] });
  const corrected = await scanLeadOps(deps, { ...input, entities: [...input.entities], apiTimestampOffset: "-03:00" });
  expect(reported.candidates).toHaveLength(0);
  expect(corrected.candidates).toHaveLength(1);
  expect(corrected.candidates[0].commercial.dates.createdAt).toBe("2026-09-08T16:30:00Z");
});

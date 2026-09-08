import {
  loadConfig, Leads2bHttpClient, Leads2bV1Client, Leads2bV2Client, scanLeadOps
} from "leads2b-mcp/lead-ops";

const config = loadConfig();
const v1 = new Leads2bV1Client(new Leads2bHttpClient({ api: "v1", baseUrl: config.apiV1BaseUrl, token: config.apiV1Token }));
const v2 = new Leads2bV2Client(new Leads2bHttpClient({ api: "v2", baseUrl: config.apiV2BaseUrl, token: config.apiV2Token }));
const result = await scanLeadOps({ v1, v2 }, {
  entities: ["CUSTOMER", "LEAD", "OPPORTUNITY"],
  pageSize: 100, maxPages: 5, limit: 100, offset: 0,
  includeAttribution: false
});
// Do not persist or forward account data automatically; apply your own authorized workflow.
console.log(JSON.stringify({ coverage: result.coverage, pagination: result.pagination }, null, 2));

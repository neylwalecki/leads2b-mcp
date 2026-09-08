// Supported package entry: leads2b-mcp/lead-ops. Legacy dist paths remain in the package.
export { scanLeadOps, type LeadOpsScanInput } from "./scan.js";
export { loadConfig, type Leads2bConfig } from "../config.js";
export { Leads2bHttpClient, Leads2bHttpError } from "../client/http.js";
export { Leads2bV1Client } from "../client/v1.js";
export { Leads2bV2Client } from "../client/v2.js";
export { diagnoseAttributionBatch } from "../attribution/batch.js";
export { findRecordsFromSources, buildLeadOpsCandidates } from "./records.js";
export { parseApiDate, inDateRange } from "./dates.js";

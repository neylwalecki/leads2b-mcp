#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Leads2bHttpClient } from "./client/http.js";
import { Leads2bV1Client } from "./client/v1.js";
import { Leads2bV2Client } from "./client/v2.js";
import { loadConfig } from "./config.js";
import { registerAttributionTools } from "./tools/attribution.js";
import { registerHealthTool } from "./tools/health.js";
import { registerRawApiTool } from "./tools/raw-api.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

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

const server = new McpServer({
  name: "leads2b-mcp",
  version: "0.2.0"
});

registerHealthTool(server, { config, v1, v2 });
registerReadTools(server, { v1, v2 });
registerAttributionTools(server, { v1, v2 });

if (config.writeMode !== "disabled") {
  registerWriteTools(server, { v2, writeMode: config.writeMode });
}

if (config.rawApiEnabled) {
  registerRawApiTool(server, { v1, v2, writeMode: config.writeMode });
}

try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error);
  process.exit(1);
}

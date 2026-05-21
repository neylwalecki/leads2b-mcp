import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCalendarTools } from "./read/calendar.js";
import { registerCatalogTools } from "./read/catalog.js";
import { registerCustomerTools } from "./read/customers.js";
import { registerEventTools } from "./read/events.js";
import { registerPipelineTools } from "./read/pipelines.js";
import { registerSnippetTools } from "./read/snippet.js";
import { ReadDeps } from "./read/shared.js";

export function registerReadTools(server: McpServer, deps: ReadDeps): void {
  registerCatalogTools(server, deps);
  registerPipelineTools(server, deps);
  registerCustomerTools(server, deps);
  registerSnippetTools(server, deps);
  registerCalendarTools(server, deps);
  registerEventTools(server, deps);
}

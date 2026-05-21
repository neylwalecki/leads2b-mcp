import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadDeps, registerSimpleReadTool } from "./shared.js";

export function registerSnippetTools(server: McpServer, deps: ReadDeps): void {
  registerSimpleReadTool(server, {
    name: "leads2b_list_webhooks",
    title: "List webhooks",
    description: "Lista webhooks configurados na API v2.",
    source: { api: "v2", endpoint: "/webhooks", stability: "confirmed" },
    handler: () => deps.v2.listWebhooks()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_get_snippet_config",
    title: "Get snippet config",
    description: "Consulta o token público/configuração do snippet pela API v2.",
    source: { api: "v2", endpoint: "/integrations/config/token", stability: "confirmed" },
    handler: () => deps.v2.getSnippetConfig()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_get_snippet_script",
    title: "Get snippet script",
    description: "Consulta o script oficial do snippet pela API v2.",
    source: { api: "v2", endpoint: "/integrations/config/script", stability: "confirmed" },
    handler: () => deps.v2.getSnippetScript()
  });
}

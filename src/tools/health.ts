import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bConfig, getJwtExpiration } from "../config.js";
import { Leads2bV1Client } from "../client/v1.js";
import { Leads2bV2Client } from "../client/v2.js";
import { okResult } from "./result.js";
import { RAW_API_TOOL_NAME } from "./raw-api.js";
import { WRITE_TOOL_NAMES } from "./write.js";

type HealthDeps = {
  config: Leads2bConfig;
  v1: Leads2bV1Client;
  v2: Leads2bV2Client;
};

type ApiHealth = {
  configured: boolean;
  responded: boolean;
  ok: boolean;
  status?: number;
  userContext?: boolean;
  message?: string;
};

const V1_TOOLS = [
  "leads2b_list_team_users", "leads2b_list_pipeline_stages",
  "leads2b_get_customer_v1", "leads2b_get_contact", "leads2b_list_contacts", "leads2b_get_opportunity",
  "leads2b_get_logged_user",
  "leads2b_list_origins",
  "leads2b_list_pipelines",
  "leads2b_get_dashboard_counts",
  "leads2b_list_pipelines_by_entity",
  "leads2b_list_users_by_access_level",
  "leads2b_list_forms",
  "leads2b_get_lead_columns",
  "leads2b_list_tags",
  "leads2b_list_chrome_extension_users",
  "leads2b_list_actions",
  "leads2b_search_campaigns",
  "leads2b_search_flows",
  "leads2b_count_deals",
  "leads2b_get_entity_columns",
  "leads2b_list_customer_types",
  "leads2b_get_receita_by_cnpj",
  "leads2b_list_loss_reasons",
  "leads2b_list_customers",
  "leads2b_find_customer",
  "leads2b_get_lead_detail"
];

const V2_TOOLS = [
  "leads2b_list_users",
  "leads2b_list_webhooks",
  "leads2b_list_cnaes",
  "leads2b_list_mail_accounts",
  "leads2b_list_company_feedbacks",
  "leads2b_get_company_events",
  "leads2b_list_calendar_events",
  "leads2b_list_segmentations",
  "leads2b_get_snippet_config",
  "leads2b_get_snippet_script",
  "leads2b_search_customers",
  "leads2b_get_customer",
  "leads2b_list_recent_opportunities",
  "leads2b_get_conversions",
  "leads2b_get_tracking",
  "leads2b_diagnose_attribution"
];

const LOCAL_TOOLS = ["leads2b_health_check", "leads2b_normalize_source"];
const CROSS_API_TOOLS = [
  "leads2b_find_attribution_candidates",
  "leads2b_diagnose_customer_attribution",
  "leads2b_diagnose_records_attribution",
  "leads2b_find_records",
  "leads2b_scan_lead_ops",
  "leads2b_get_record_detail",
  "leads2b_get_lead_ops_candidates"
];

export function registerHealthTool(server: McpServer, deps: HealthDeps): void {
  server.registerTool(
    "leads2b_health_check",
    {
      title: "Leads2b health check",
      description: "Valida configuração local, tokens, APIs e disponibilidade de ferramentas do MCP.",
      inputSchema: {
        includeSnippet: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ includeSnippet = false }) => {
      const [v1Health, v2Health, snippetHealth] = await Promise.all([
        checkApi(deps.v1.hasToken(), () => deps.v1.getLoggedUser(), true),
        checkApi(deps.v2.hasToken(), () => deps.v2.listUsers()),
        includeSnippet ? checkSnippet(deps.config.publicWorkerUrl) : Promise.resolve(undefined)
      ]);
      const availableWrites = deps.config.writeMode !== "disabled" && v1Health.ok
        ? WRITE_TOOL_NAMES.filter(name => v1Health.userContext || /_(customer|contact)$/.test(name)) : [];
      const availableTools = [
        ...LOCAL_TOOLS,
        ...(v1Health.ok ? V1_TOOLS : []),
        ...(v2Health.ok ? V2_TOOLS : []),
        ...(v1Health.ok && v2Health.ok ? CROSS_API_TOOLS : []),
        ...availableWrites,
        ...(deps.config.rawApiEnabled ? [RAW_API_TOOL_NAME] : [])
      ];
      const warnings: string[] = [];
      if (v1Health.ok && !v1Health.userContext) warnings.push("API v1 respondeu sem contexto de usuário; CRUD de leads/oportunidades exige token v1 de usuário autorizado.");

      if (!deps.config.apiV1Token) {
        warnings.push("LEADS2B_API_V1_TOKEN não configurado; ferramentas v1 ficam indisponíveis.");
      }

      if (!deps.config.apiV2Token) {
        warnings.push("LEADS2B_API_V2_TOKEN não configurado; ferramentas v2 ficam indisponíveis.");
      }

      return okResult({
        ok: true,
        data: {
          tokens: {
            v1Configured: Boolean(deps.config.apiV1Token),
            v2Configured: Boolean(deps.config.apiV2Token),
            v1ExpiresAt: getJwtExpiration(deps.config.apiV1Token),
            v2ExpiresAt: getJwtExpiration(deps.config.apiV2Token)
          },
          apis: {
            v1: v1Health,
            v2: v2Health,
            snippet: snippetHealth
          },
          baseUrls: {
            v1: deps.config.apiV1BaseUrl,
            v2: deps.config.apiV2BaseUrl,
            publicWorker: deps.config.publicWorkerUrl
          },
          writeTools: {
            mode: deps.config.writeMode,
            registered: deps.config.writeMode !== "disabled",
            availableTools: availableWrites,
            registeredTools: deps.config.writeMode !== "disabled" ? WRITE_TOOL_NAMES : []
          },
          rawApi: {
            enabled: deps.config.rawApiEnabled,
            availableTool: deps.config.rawApiEnabled ? RAW_API_TOOL_NAME : undefined
          },
          availabilityBasis: "Inferida por autenticação de cada API; não comprova permissão em cada endpoint nem sucesso de escrita.",
          availableTools
        },
        warnings,
        summary: `Leads2b MCP health: v1=${statusLabel(v1Health)}, v2=${statusLabel(v2Health)}.`,
        source: {
          api: "local",
          stability: "confirmed"
        }
      });
    }
  );
}

async function checkApi(configured: boolean, request: () => Promise<unknown>, inspectUser = false): Promise<ApiHealth> {
  if (!configured) {
    return {
      configured: false,
      responded: false,
      ok: false,
      message: "Token não configurado."
    };
  }

  try {
    const response = await request() as { data?: { user?: unknown } };
    const rawUser = response?.data?.user;
    const user = Array.isArray(rawUser) ? rawUser[0] : rawUser;
    return {
      configured: true,
      responded: true,
      ...(inspectUser ? { userContext: Boolean(user && typeof user === "object" && "id" in user && user.id) } : {}),
      ok: true
    };
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
    return {
      configured: true,
      responded: Boolean(status),
      ok: false,
      status,
      message: error instanceof Error ? error.message : "Falha ao validar API."
    };
  }
}

async function checkSnippet(publicWorkerUrl: string): Promise<ApiHealth> {
  try {
    const response = await fetch(`${publicWorkerUrl.replace(/\/$/, "")}/latest`, {
      method: "GET", signal: AbortSignal.timeout(30000)
    });

    return {
      configured: true,
      responded: true,
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      configured: true,
      responded: false,
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao validar snippet."
    };
  }
}

function statusLabel(health: ApiHealth): string {
  if (!health.configured) {
    return "missing-token";
  }

  return health.ok ? "ok" : "error";
}

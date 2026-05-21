import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, okResult } from "../result.js";
import { IdSchema, LossEntitySchema, PipelineEntitySchema, ReadDeps, registerSimpleReadTool } from "./shared.js";

export function registerPipelineTools(server: McpServer, deps: ReadDeps): void {
  registerSimpleReadTool(server, {
    name: "leads2b_list_pipelines",
    title: "List pipelines",
    description: "Lista pipelines ativos na API v1.",
    source: { api: "v1", endpoint: "/pipeline/active", stability: "confirmed" },
    handler: () => deps.v1.listPipelines()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_get_dashboard_counts",
    title: "Get dashboard counts",
    description: "Consulta contadores do dashboard na API v1.",
    source: { api: "v1", endpoint: "/dashboard/*_count/", stability: "observed" },
    handler: () => deps.v1.getDashboardCounts()
  });

  server.registerTool(
    "leads2b_list_pipelines_by_entity",
    {
      title: "List pipelines by entity",
      description: "Lista pipelines da API v1 por entidade.",
      inputSchema: {
        entity: PipelineEntitySchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ entity }) => {
      try {
        const data = await deps.v1.listPipelinesByEntity({ entity });
        return okResult({
          ok: true,
          data,
          summary: `Pipelines consultados para ${entity}.`,
          source: { api: "v1", endpoint: "/pipeline/byEntity/{entity}", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerSimpleReadTool(server, {
    name: "leads2b_list_users_by_access_level",
    title: "List users by access level",
    description: "Lista usuários agrupados por nível de acesso pela API v1.",
    source: { api: "v1", endpoint: "/user/users_by_access_level", stability: "observed" },
    handler: () => deps.v1.listUsersByAccessLevel()
  });

  server.registerTool(
    "leads2b_search_campaigns",
    {
      title: "Search campaigns",
      description: "Busca campanhas pela API v1 usando o endpoint DataTables simplificado.",
      inputSchema: {
        search: z.string().optional(),
        draw: z.number().int().min(1).optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ search, draw }) => {
      try {
        const data = await deps.v1.searchCampaigns({ search, draw });
        return okResult({
          ok: true,
          data,
          summary: "Campanhas consultadas.",
          source: { api: "v1", endpoint: "/campaign/search", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_search_flows",
    {
      title: "Search flows",
      description: "Busca fluxos pela API v1 usando o endpoint DataTables simplificado.",
      inputSchema: {
        search: z.string().optional(),
        draw: z.number().int().min(1).optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ search, draw }) => {
      try {
        const data = await deps.v1.searchFlows({ search, draw });
        return okResult({
          ok: true,
          data,
          summary: "Fluxos consultados.",
          source: { api: "v1", endpoint: "/flow/search", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_count_deals",
    {
      title: "Count deals",
      description: "Conta deals por pipeline e status pela API v1.",
      inputSchema: {
        pipelineId: IdSchema,
        status: z.string().min(1),
        search: z.string().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ pipelineId, status, search }) => {
      try {
        const data = await deps.v1.countDeals({ pipelineId, status, search });
        return okResult({
          ok: true,
          data,
          summary: `Deals contados para pipeline ${pipelineId} e status ${status}.`,
          source: { api: "v1", endpoint: "/deal/count_deals", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_list_loss_reasons",
    {
      title: "List loss reasons",
      description: "Lista motivos de perda para oportunidades na API v1.",
      inputSchema: {
        entity: LossEntitySchema.optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ entity = "OPPORTUNITY" }) => {
      try {
        const data = await deps.v1.listLossReasons({ entity });
        return okResult({
          ok: true,
          data,
          summary: `Motivos de perda consultados para ${entity}.`,
          source: { api: "v1", endpoint: "/loss/index/{entity}", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

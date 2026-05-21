import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, okResult } from "../result.js";
import { EntitySchema, ReadDeps, SegmentationEntitySchema, registerSimpleReadTool } from "./shared.js";

export function registerCatalogTools(server: McpServer, deps: ReadDeps): void {
  registerSimpleReadTool(server, {
    name: "leads2b_get_logged_user",
    title: "Get logged user",
    description: "Consulta o usuário autenticado do token v1.",
    source: { api: "v1", endpoint: "/user/logged/", stability: "confirmed" },
    handler: () => deps.v1.getLoggedUser()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_origins",
    title: "List origins",
    description: "Lista origens cadastrais disponíveis na API v1.",
    source: { api: "v1", endpoint: "/origin/index/", stability: "confirmed" },
    handler: () => deps.v1.listOrigins()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_forms",
    title: "List forms",
    description: "Lista formulários conhecidos pela API v1.",
    source: { api: "v1", endpoint: "/form/index", stability: "confirmed" },
    handler: () => deps.v1.listForms()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_get_lead_columns",
    title: "Get lead columns",
    description: "Lista colunas e campos de lead pela API v1.",
    source: { api: "v1", endpoint: "/lead/columns", stability: "confirmed" },
    handler: () => deps.v1.getLeadColumns()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_tags",
    title: "List tags",
    description: "Lista tags cadastradas na API v1.",
    source: { api: "v1", endpoint: "/tag/index/", stability: "observed" },
    handler: () => deps.v1.listTags()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_chrome_extension_users",
    title: "List chrome extension users",
    description: "Lista usuários disponíveis para a extensão Chrome pela API v1.",
    source: { api: "v1", endpoint: "/chrome_extension/users", stability: "observed" },
    handler: () => deps.v1.listChromeExtensionUsers()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_actions",
    title: "List actions",
    description: "Lista ações/tipos de ação disponíveis na API v1.",
    source: { api: "v1", endpoint: "/action/list/", stability: "observed" },
    handler: () => deps.v1.listActions()
  });

  server.registerTool(
    "leads2b_get_entity_columns",
    {
      title: "Get entity columns",
      description: "Consulta colunas customizadas por entidade pela API v1.",
      inputSchema: {
        entity: EntitySchema,
        withDeleted: z.boolean().optional(),
        onlyCount: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ entity, withDeleted, onlyCount }) => {
      try {
        const data = await deps.v1.getEntityColumns({ entity, withDeleted, onlyCount });
        return okResult({
          ok: true,
          data,
          summary: `Colunas consultadas para ${entity}.`,
          source: { api: "v1", endpoint: "/custom_column/entity_columns/{entity}/", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerSimpleReadTool(server, {
    name: "leads2b_list_customer_types",
    title: "List customer types",
    description: "Lista tipos de customer pela API v1.",
    source: { api: "v1", endpoint: "/customer_type", stability: "observed" },
    handler: () => deps.v1.listCustomerTypes()
  });

  server.registerTool(
    "leads2b_get_receita_by_cnpj",
    {
      title: "Get receita by CNPJ",
      description: "Consulta dados de Receita/CNPJ pela API v1.",
      inputSchema: {
        cnpj: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ cnpj }) => {
      try {
        const data = await deps.v1.getReceitaByCnpj({ cnpj });
        return okResult({
          ok: true,
          data,
          summary: "Receita/CNPJ consultado.",
          source: { api: "v1", endpoint: "/receita/index/{cnpj}", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  registerSimpleReadTool(server, {
    name: "leads2b_list_users",
    title: "List users",
    description: "Lista usuários da conta na API v2.",
    source: { api: "v2", endpoint: "/users", stability: "confirmed" },
    handler: () => deps.v2.listUsers()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_cnaes",
    title: "List CNAEs",
    description: "Lista CNAEs/mercados disponíveis na API v2.",
    source: { api: "v2", endpoint: "/markets/cnaes/all", stability: "observed" },
    handler: () => deps.v2.listCnaes()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_mail_accounts",
    title: "List mail accounts",
    description: "Lista contas de e-mail conectadas na API v2.",
    source: { api: "v2", endpoint: "/mail/accounts", stability: "observed" },
    handler: () => deps.v2.listMailAccounts()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_list_company_feedbacks",
    title: "List company feedbacks",
    description: "Lista feedbacks da empresa na API v2.",
    source: { api: "v2", endpoint: "/feedbacks/company", stability: "observed" },
    handler: () => deps.v2.listCompanyFeedbacks()
  });

  registerSimpleReadTool(server, {
    name: "leads2b_get_company_events",
    title: "Get company events",
    description: "Consulta eventos/recompensas da empresa na API v2.",
    source: { api: "v2", endpoint: "/companies/event", stability: "observed" },
    handler: () => deps.v2.getCompanyEvents()
  });

  server.registerTool(
    "leads2b_list_segmentations",
    {
      title: "List segmentations",
      description: "Lista segmentações por entidade pela API v2.",
      inputSchema: {
        entity: SegmentationEntitySchema,
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ entity, limit = 20, offset = 0 }) => {
      try {
        const data = await deps.v2.listSegmentations({ entity, limit, offset });
        return okResult({
          ok: true,
          data,
          summary: `Segmentações consultadas para ${entity}.`,
          source: { api: "v2", endpoint: "/segmentations", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bV1Client } from "../client/v1.js";
import { Leads2bV2Client } from "../client/v2.js";
import { Leads2bEntity } from "../attribution/normalize.js";
import { findCustomers, prepareCustomerListOutput } from "../customers/list.js";
import { errorResult, okResult, ToolSource } from "./result.js";

type ReadDeps = {
  v1: Leads2bV1Client;
  v2: Leads2bV2Client;
};

const EntitySchema = z.enum(["LEAD", "CONTACT", "OPPORTUNITY"]);
const IdSchema = z.union([z.string().min(1), z.number()]);
const PipelineEntitySchema = z.enum(["LEAD", "OPPORTUNITY"]);
const LossEntitySchema = z.enum(["OPPORTUNITY"]);
const SegmentationEntitySchema = z.enum(["CUSTOMER", "LEAD", "OPPORTUNITY"]);

export function registerReadTools(server: McpServer, deps: ReadDeps): void {
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

  server.registerTool(
    "leads2b_list_customers",
    {
      title: "List customers",
      description:
        "Lista clientes existentes pela API v1. Sem opções, retorna a resposta integral; com opções, aplica filtros locais.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
        search: z.string().min(1).optional(),
        summaryOnly: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ limit, offset, search, summaryOnly }) => {
      try {
        const response = await deps.v1.listCustomers();
        const data = prepareCustomerListOutput(response, {
          limit,
          offset,
          search,
          summaryOnly
        });

        return okResult({
          ok: true,
          data,
          summary: "List customers: consulta concluída.",
          source: { api: "v1", endpoint: "/customer/index", stability: "confirmed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_find_customer",
    {
      title: "Find customer",
      description:
        "Busca localmente em customer/index por e-mail, telefone, documento, nome ou texto geral. Retorna dados reais da conta autenticada.",
      inputSchema: {
        search: z.string().min(1).optional(),
        email: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        document: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
        summaryOnly: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ search, email, phone, document, name, limit, offset, summaryOnly }) => {
      try {
        if (!search && !email && !phone && !document && !name) {
          return errorResult(new Error("Informe ao menos um critério: search, email, phone, document ou name."));
        }

        const response = await deps.v1.listCustomers();
        const data = findCustomers(response, {
          search,
          email,
          phone,
          document,
          name,
          limit,
          offset,
          summaryOnly
        });

        return okResult({
          ok: true,
          data,
          summary: `Find customer: ${data.data.matchedTotal} cliente(s) encontrado(s).`,
          source: { api: "v1", endpoint: "/customer/index", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_search_customers",
    {
      title: "Search customers",
      description: "Busca customers pela API v2 usando o parâmetro search.",
      inputSchema: {
        search: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ search }) => {
      try {
        const data = await deps.v2.searchCustomers({ search });
        return okResult({
          ok: true,
          data,
          summary: "Search customers: consulta concluída.",
          source: { api: "v2", endpoint: "/customer?search={search}", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_customer",
    {
      title: "Get customer",
      description: "Consulta detalhe de customer pela API v2 usando o ID retornado em /customer.",
      inputSchema: {
        id: IdSchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id }) => {
      try {
        const data = await deps.v2.getCustomer({ id });
        return okResult({
          ok: true,
          data,
          summary: `Customer ${id}: consulta concluída.`,
          source: { api: "v2", endpoint: "/customer/{id}", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_lead_detail",
    {
      title: "Get lead detail",
      description: "Consulta detalhe de lead pela API v1 usando ID.",
      inputSchema: {
        id: IdSchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id }) => {
      try {
        const data = await deps.v1.getDefaultLead({ id });
        return okResult({
          ok: true,
          data,
          summary: `Lead ${id}: consulta concluída.`,
          source: { api: "v1", endpoint: "/lead/index/{id}/defaultLead", stability: "observed" }
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
    name: "leads2b_list_webhooks",
    title: "List webhooks",
    description: "Lista webhooks configurados na API v2.",
    source: { api: "v2", endpoint: "/webhooks", stability: "confirmed" },
    handler: () => deps.v2.listWebhooks()
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

  server.registerTool(
    "leads2b_list_calendar_events",
    {
      title: "List calendar events",
      description: "Lista eventos de calendário da Leads2b pela API v2.",
      inputSchema: {
        start: z.string().min(1),
        end: z.string().min(1),
        userIds: z.array(IdSchema).optional(),
        calendars: z.array(z.string().min(1)).optional(),
        types: z.array(z.string().min(1)).optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ start, end, userIds, calendars = ["leads2b"], types = ["action", "meet"], limit = 200, offset = 0 }) => {
      try {
        const data = await deps.v2.listCalendarEvents({
          userIds,
          calendars,
          types,
          start,
          end,
          limit,
          offset
        });
        return okResult({
          ok: true,
          data,
          summary: "Eventos de calendário consultados.",
          source: { api: "v2", endpoint: "/mail/calendars/events", stability: "observed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

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

  server.registerTool(
    "leads2b_get_conversions",
    {
      title: "Get conversions",
      description: "Consulta conversões por id e entity. Não aceita busca por e-mail no MVP.",
      inputSchema: {
        id: IdSchema,
        entity: EntitySchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, entity }) => {
      try {
        const data = sortApiEvents(await deps.v2.getConversions({ id, entity: entity as Leads2bEntity }));
        return okResult({
          ok: true,
          data,
          summary: `Conversões consultadas para ${entity} ${id}.`,
          source: { api: "v2", endpoint: "/conversions", stability: "confirmed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "leads2b_get_tracking",
    {
      title: "Get tracking",
      description: "Consulta tracking por id e entity. Não aceita busca por e-mail no MVP.",
      inputSchema: {
        id: IdSchema,
        entity: EntitySchema
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, entity }) => {
      try {
        const data = sortApiEvents(await deps.v2.getTracking({ id, entity: entity as Leads2bEntity }));
        return okResult({
          ok: true,
          data,
          summary: `Tracking consultado para ${entity} ${id}.`,
          source: { api: "v2", endpoint: "/conversions/tracking", stability: "confirmed" }
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function registerSimpleReadTool(
  server: McpServer,
  input: {
    name: string;
    title: string;
    description: string;
    source: ToolSource;
    handler: () => Promise<unknown>;
  }
): void {
  server.registerTool(
    input.name,
    {
      title: input.title,
      description: input.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => {
      try {
        const data = await input.handler();
        return okResult({
          ok: true,
          data,
          summary: `${input.title}: consulta concluída.`,
          source: input.source
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}

function sortApiEvents(response: unknown): unknown {
  if (Array.isArray(response)) {
    return sortEventsArray(response);
  }

  if (response && typeof response === "object" && Array.isArray((response as { data?: unknown }).data)) {
    return {
      ...(response as Record<string, unknown>),
      data: sortEventsArray((response as { data: unknown[] }).data)
    };
  }

  return response;
}

function sortEventsArray(events: unknown[]): unknown[] {
  return [...events].sort((a, b) => {
    const aTime = eventTimestamp(a);
    const bTime = eventTimestamp(b);
    return aTime - bTime;
  });
}

function eventTimestamp(event: unknown): number {
  if (!event || typeof event !== "object") {
    return Number.POSITIVE_INFINITY;
  }

  const record = event as Record<string, unknown>;
  const value = record.created_at ?? record.message_date_sql;

  if (typeof value !== "string" && typeof value !== "number") {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

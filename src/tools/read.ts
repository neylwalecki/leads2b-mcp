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

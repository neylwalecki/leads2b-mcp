import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findCustomers, prepareCustomerListOutput } from "../../customers/list.js";
import { errorResult, okResult } from "../result.js";
import { IdSchema, ReadDeps } from "./shared.js";

export function registerCustomerTools(server: McpServer, deps: ReadDeps): void {
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
}

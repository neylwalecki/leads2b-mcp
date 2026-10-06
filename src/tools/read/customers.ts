import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findCustomers, prepareCustomerListOutput } from "../../customers/list.js";
import { errorResult, okResult } from "../result.js";
import { EntityIdSchema } from "../../crud/schemas.js";
import { IdSchema, ReadDeps } from "./shared.js";

export function registerCustomerTools(server: McpServer, deps: ReadDeps): void {
  server.registerTool("leads2b_list_team_users", {
    description: "Lista usuários internos da equipe via v1 /user/all para identificar responsáveis por negócios. Não confunda com usuários de portal da v2.",
    annotations: { readOnlyHint: true }
  }, async () => {
    try { return okResult({ ok: true, data: await deps.v1.listTeamUsers(), source: { api: "v1", endpoint: "/user/all", stability: "observed" } }); }
    catch (error) { return errorResult(error); }
  });
  server.registerTool("leads2b_list_pipeline_stages", {
    description: "Lista etapas reais do pipeline informado para usar seus IDs na criação de negócios.",
    inputSchema: { pipelineId: EntityIdSchema }, annotations: { readOnlyHint: true }
  }, async ({ pipelineId }) => {
    try { return okResult({ ok: true, data: await deps.v1.listPipelineStages({ pipelineId }), source: { api: "v1", endpoint: "/pipeline/pipeline_items/{pipelineId}", stability: "observed" } }); }
    catch (error) { return errorResult(error); }
  });
  const detailTools = [
    { name: "leads2b_get_customer_v1", path: "/customer/index/{id}", read: (id: string | number) => deps.v1.getCustomer({ id }) },
    { name: "leads2b_get_contact", path: "/customer/contact_by_id/{id}", read: (id: string | number) => deps.v1.getContact({ id }) },
    { name: "leads2b_get_opportunity", path: "/opportunity/index/{id}", read: (id: string | number) => deps.v1.getOpportunity({ id }) }
  ];
  for (const tool of detailTools) {
    server.registerTool(tool.name, {
      description: "Lê o registro integral pela API v1. Endpoint interno observado no aplicativo, sujeito a mudanças.",
      inputSchema: { id: EntityIdSchema }, annotations: { readOnlyHint: true }
    }, async ({ id }) => {
      try { return okResult({ ok: true, data: await tool.read(id), source: { api: "v1", endpoint: tool.path, stability: "observed" } }); }
      catch (error) { return errorResult(error); }
    });
  }
  server.registerTool("leads2b_list_contacts", {
    description: "Lista contatos vinculados a um customer. Não é um catálogo global de todos os contatos.",
    inputSchema: { customerId: EntityIdSchema }, annotations: { readOnlyHint: true }
  }, async ({ customerId }) => {
    try { return okResult({ ok: true, data: await deps.v1.listContacts({ customerId }), source: { api: "v1", endpoint: "/customer/contact/{customerId}", stability: "observed" } }); }
    catch (error) { return errorResult(error); }
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
      description: "Busca customers pela API v2. Retorna até 25 registros por padrão; limit/offset recortam somente a saída local, sem limitar a transferência. returnAll devolve a resposta integral. Paginação nativa não verificada.",
      inputSchema: {
        search: z.string().min(1),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
        returnAll: z.boolean().optional()
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ search, limit, offset, returnAll = false }) => {
      try {
        if (returnAll && (offset !== undefined || limit !== undefined)) throw new Error("returnAll não pode ser combinado com recorte limit/offset.");
        const response = await deps.v2.searchCustomers({ search });
        const data = prepareCustomerSearchOutput(response, { limit: limit ?? 25, offset: offset ?? 0, returnAll });
        return okResult({
          ok: true,
          data,
          warnings: ["Recorte local limita somente a saída. A transferência original e a paginação nativa não são controladas; cobertura da coleta desconhecida."],
          summary: "Search customers: consulta concluída; confira coverage para o recorte e os limites da coleta.",
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

function prepareCustomerSearchOutput(response: unknown, input: { limit: number; offset: number; returnAll: boolean }) {
  const object = response && typeof response === "object" ? response as Record<string, unknown> : undefined;
  const data = object?.data;
  const nested = data && typeof data === "object" ? data as Record<string, unknown> : undefined;
  const rows = [response, data, nested?.customers, object?.customers].find(Array.isArray) as unknown[] | undefined;
  if (!rows && !input.returnAll) throw new Error("Formato de customers desconhecido; use returnAll=true para inspecionar a resposta integral.");
  const customers = rows?.slice(input.offset, input.offset + input.limit);
  const coverage = {
    fetched: rows?.length ?? null,
    returned: input.returnAll ? rows?.length ?? null : customers!.length,
    offset: input.returnAll ? 0 : input.offset,
    limit: input.returnAll ? null : input.limit,
    nextOffset: !input.returnAll && input.offset + customers!.length < rows!.length ? input.offset + customers!.length : null,
    outputTruncated: !input.returnAll && customers!.length < rows!.length,
    nativePagination: "unverified", collection: "unknown", transferLimited: false
  };
  return input.returnAll ? { response, coverage } : { customers, coverage };
}

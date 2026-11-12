import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Leads2bHttpError } from "../../client/http.js";
import type { Leads2bRawRequestInput } from "../../client/v1.js";
import { EntityIdSchema } from "../../crud/schemas.js";
import { errorResult, okResult } from "../result.js";
import type { ReadDeps } from "./shared.js";

type ReadTool = { name: string; register: (server: McpServer, deps: ReadDeps) => void };

function read<S extends z.ZodRawShape>(
  name: string,
  api: "v1" | "v2",
  endpoint: string,
  description: string,
  shape: S,
  request: (input: z.output<z.ZodObject<S>>) => Pick<Leads2bRawRequestInput, "path" | "query" | "body">,
  options: { page?: boolean; select?: (response: unknown) => unknown; method?: "POST" } = {}
): ReadTool {
  const schema = z.strictObject(shape);
  return {
    name,
    register(server, deps) {
      server.registerTool<z.ZodRawShape, z.ZodType>(name, {
        description: `${description} Rota interna experimental.`,
        inputSchema: schema,
        annotations: { readOnlyHint: true }
      }, async (input: unknown) => {
        try {
          const args = schema.parse(input);
          const response = await deps[api].rawRequest({ ...request(args), method: options.method ?? "GET" });
          return okResult({
            ok: true,
            data: options.page ? {
              response, coverage: { status: "unknown", reason: "native_pagination_unverified", requested: args }
            } : options.select ? options.select(response) : response,
            summary: options.page ? "Página consultada. Cobertura total desconhecida." : "Consulta concluída.",
            source: { api, endpoint, stability: "experimental" }
          });
        } catch (error) {
          if (options.select && error instanceof Leads2bHttpError) {
            return errorResult(new Leads2bHttpError({
              endpoint: error.endpoint, status: error.status, code: error.code, message: error.message
            }));
          }
          return errorResult(error);
        }
      });
    }
  };
}

const fixed = (
  name: string, api: "v1" | "v2", path: string, description: string,
  options?: { page?: boolean; select?: (response: unknown) => unknown }
) => read(name, api, path, description, {}, () => ({ path }), options);

const entity = z.enum(["LEAD", "OPPORTUNITY"]);
const id = { id: EntityIdSchema };
const deal = { ...id, entity };
const page = z.number().int().positive().default(1);
const pageSize = z.number().int().min(1).max(100).default(25);
const offset = z.number().int().nonnegative().default(0);
const pipeline = { pipelineId: EntityIdSchema };
const scheduleFilters = {
  todo: z.literal(true).optional(),
  responsible: z.array(EntityIdSchema).min(1).max(20).optional(),
  date: z.strictObject({ start: z.iso.date(), end: z.iso.date() })
    .refine(range => range.start <= range.end, "O início deve preceder ou coincidir com o fim.").optional()
};

function scheduleQuery({ todo, responsible, date }: z.output<z.ZodObject<typeof scheduleFilters>>) {
  const query: NonNullable<Leads2bRawRequestInput["query"]> = { todo };
  responsible?.forEach((value, index) => { query[`responsible[${index}]`] = value; });
  if (date) {
    query["date[startDate]"] = `${date.start} 00:00:00`;
    query["date[endDate]"] = `${date.end} 23:59:59`;
  }
  return query;
}

// This diagnostic endpoint also returns a connection URL. Select only the
// status contract so the tool cannot surface a link for authorizing an account.
function activationStatus(response: unknown) {
  const envelope = z.looseObject({
    data: z.looseObject({
      id_channel: EntityIdSchema.nullish(),
      status: z.string().nullish(),
      meta_status: z.string().nullish(),
      status_detail: z.looseObject({ status: z.string().nullish() }).nullish()
    }).nullable()
  }).parse(response);
  if (!envelope.data) return { activation: null };
  const { id_channel, status, meta_status, status_detail } = envelope.data;
  return { activation: { id_channel, status, meta_status, status_detail: status_detail?.status } };
}

function channelDirectory(response: unknown) {
  return z.object({
    channels: z.array(z.object({
      id: EntityIdSchema,
      type: z.string().nullish(),
      provider: z.string().nullish(),
      description: z.string().nullish(),
      phone: z.string().nullish()
    }))
  }).parse(response);
}

function voiceDetailsPresence(response: unknown) {
  const envelope = z.object({ data: z.record(z.string(), z.unknown()).nullable() }).parse(response);
  return { detailsReturned: envelope.data !== null };
}

const p1: ReadTool[] = [
  fixed("leads2b_list_history_users", "v1", "/history/history_users/", "Consulta usuários do catálogo de histórico."),
  read("leads2b_list_stage_activities", "v1", "/history/history_pipeline_item/", "Consulta atividades para o negócio e a etapa informados.",
    { ...deal, stageId: EntityIdSchema }, ({ entity, id, stageId }) => ({
      path: "/history/history_pipeline_item/", query: { entity, id_entity: id, id_pipeline_item: stageId }
    })),
  fixed("leads2b_list_user_chat_channels", "v2", "/messages/channels/user",
    "Consulta a identidade dos canais de comunicação disponíveis ao usuário autenticado.", { select: channelDirectory }),
  fixed("leads2b_get_chat_channel_activation_status", "v2", "/messages/channels/activations/status",
    "Consulta o estado de ativação dos canais, com retorno restrito a campos de status.", { select: activationStatus }),
  fixed("leads2b_get_chat_inbox_counts", "v2", "/messages/chats/count", "Consulta os contadores da caixa de conversas no escopo da credencial."),
  read("leads2b_list_inbox_chats", "v2", "/messages/chats", "Consulta um recorte da caixa de conversas abertas ou encerradas.",
    { situation: z.enum(["open", "closed"]).default("open"), limit: pageSize, offset }, ({ situation, limit, offset }) => ({
      path: "/messages/chats", query: { situation, order: "desc", limit, offset }
    }), { page: true }),
  read("leads2b_list_scheduled_activities", "v1", "/schedule/index/", "Consulta uma página da fila comercial. Datas seguem o horário da conta.",
    { ...scheduleFilters, page, pageSize }, ({ page, pageSize, ...filters }) => ({
      path: "/schedule/index/", query: { "pagination[page]": page, "pagination[perPage]": pageSize, ...scheduleQuery(filters) }
    }), { page: true }),
  read("leads2b_count_scheduled_activities", "v1", "/schedule/count/", "Consulta a contagem da fila comercial com os mesmos filtros da listagem.",
    scheduleFilters, filters => ({ path: "/schedule/count/", query: scheduleQuery(filters) })),
  read("leads2b_list_deal_contacts", "v1", "/deal/contacts", "Consulta os contatos vinculados ao lead ou à oportunidade.",
    deal, ({ entity, id }) => ({ path: "/deal/contacts", query: { id, type: entity.toLowerCase() } })),
  read("leads2b_get_opportunity_card_info", "v1", "/deal/cards_info_v2/{id}/OPPORTUNITY", "Consulta informações auxiliares do card da oportunidade.",
    id, ({ id }) => ({ path: `/deal/cards_info_v2/${id}/OPPORTUNITY` })),
  read("leads2b_list_opportunity_field_definitions", "v1", "/custom_column/entity_columns/OPPORTUNITY/{id}", "Consulta definições de campos para uma oportunidade específica.",
    id, ({ id }) => ({ path: `/custom_column/entity_columns/OPPORTUNITY/${id}` })),
  fixed("leads2b_list_accessible_pipelines", "v1", "/pipeline/accessible", "Consulta os funis acessíveis à credencial."),
  read("leads2b_list_kanban_columns", "v1", "/pipeline/kanbanColumns/{pipelineId}", "Consulta as colunas e seus agregados para o funil.",
    pipeline, ({ pipelineId }) => ({ path: `/pipeline/kanbanColumns/${pipelineId}` })),
  read("leads2b_list_kanban_cards", "v1", "/pipeline/kanbanData/{pipelineId}", "Consulta uma página de cards por coluna no funil.",
    { ...pipeline, page, pageSize }, ({ pipelineId, page, pageSize }) => ({
      path: `/pipeline/kanbanData/${pipelineId}`, query: { page, limitPage: pageSize }
    }), { page: true }),
  read("leads2b_list_customer_directory", "v2", "/customer/{organizations|persons}", "Consulta uma página de organizações ou pessoas no cadastro.",
    { type: z.enum(["ORGANIZATION", "PERSON"]), limit: pageSize, offset }, ({ type, limit, offset }) => ({
      path: type === "ORGANIZATION" ? "/customer/organizations" : "/customer/persons", query: { limit, offset }
    }), { page: true })
];

const p2: ReadTool[] = [
  fixed("leads2b_list_workflows", "v2", "/workflow", "Consulta o catálogo de jornadas no recorte padrão da API.", { page: true }),
  fixed("leads2b_count_active_workflows", "v2", "/workflow/activeCount", "Consulta o contador de jornadas ativas."),
  read("leads2b_list_deal_workflow_instances", "v1", "/deal/workflow_instances", "Consulta as instâncias de jornadas vinculadas ao negócio.",
    deal, ({ id, entity }) => ({ path: "/deal/workflow_instances", query: { id, type: entity.toLowerCase() } })),
  read("leads2b_get_opportunity_journey_cards", "v2", "/deals/journey-cards/OPPORTUNITY/{id}", "Consulta os cards da jornada de uma oportunidade, inclusive pós-venda quando retornado.",
    id, ({ id }) => ({ path: `/deals/journey-cards/OPPORTUNITY/${id}` })),
  fixed("leads2b_list_agents", "v2", "/agents", "Consulta o catálogo de agentes no recorte padrão da API.", { page: true }),
  read("leads2b_get_opportunity_insights", "v2", "/smarts/entities/opportunity/{id}", "Consulta os insights associados à oportunidade.",
    id, ({ id }) => ({ path: `/smarts/entities/opportunity/${id}` })),
  read("leads2b_get_pipeline_insights", "v2", "/smarts/pipelines/{pipelineId}/insights", "Consulta os insights associados ao funil.",
    pipeline, ({ pipelineId }) => ({ path: `/smarts/pipelines/${pipelineId}/insights` }))
];

const searchPage = { limit: pageSize, offset };
const p3: ReadTool[] = [
  fixed("leads2b_count_forms", "v1", "/form/count/", "Consulta o contador de formulários nativos."),
  fixed("leads2b_count_landing_pages", "v1", "/websites/count", "Consulta o contador de páginas nativas."),
  read("leads2b_search_landing_pages", "v1", "/websites/search/", "Consulta uma página de landing pages nativas no construtor atual.",
    { ...searchPage, search: z.string().trim().max(200).default("") }, ({ limit, offset, search }) => ({
      path: "/websites/search/", query: {
        draw: 1, start: offset, length: limit, "search[value]": search, "search[regex]": false, oldVersion: false
      }
    }), { page: true }),
  read("leads2b_get_landing_page", "v1", "/websites/index", "Consulta a definição de uma página nativa por ID. Contrato observado na interface.",
    id, ({ id }) => ({ path: "/websites/index", query: { id } })),
  fixed("leads2b_list_mailboxes", "v2", "/mail/mailboxes", "Consulta o catálogo de caixas de e-mail."),
  read("leads2b_list_lead_inbox", "v2", "/deals/lead-inbox", "Consulta uma página da Caixa de Leads via POST de busca. Contrato observado na interface e conferido com token em leitura.",
    { ...searchPage, search: z.string().trim().min(1).max(200).optional() },
    body => ({ path: "/deals/lead-inbox", body }), { method: "POST", page: true }),
  fixed("leads2b_count_market_companies", "v2", "/markets/companies/count", "Consulta o contador de empresas na base de prospecção."),
  read("leads2b_search_market_lists", "v2", "/markets/lists/search", "Consulta listas de prospecção via POST de busca. Contrato observado na interface e conferido com token em leitura.",
    { ...searchPage, search: z.string().trim().min(1).max(200).optional() }, ({ limit, offset, search }) => ({
      path: "/markets/lists/search",
      body: { limit, offset, filter: { search: search ?? "", entity: null, users: [] }, sort: { column: null, value: null } }
    }), { method: "POST", page: true }),
  fixed("leads2b_list_panels", "v2", "/panels", "Consulta os painéis disponíveis."),
  read("leads2b_list_panel_widgets", "v2", "/panels/{id}/widgets", "Consulta os widgets configurados para o painel.",
    id, ({ id }) => ({ path: `/panels/${id}/widgets` })),
  fixed("leads2b_list_report_tabs", "v1", "/report_tab/list", "Consulta as categorias disponíveis de relatório."),
  read("leads2b_list_reports", "v1", "/report/list/report", "Consulta o catálogo de relatórios para o ID de categoria retornado por leads2b_list_report_tabs.",
    { tabId: EntityIdSchema }, ({ tabId }) => ({ path: "/report/list/report", query: { tab: tabId } })),
  read("leads2b_list_opportunity_files", "v1", "/opportunity/uploaded_files/{id}", "Consulta o inventário de anexos da oportunidade.",
    id, ({ id }) => ({ path: `/opportunity/uploaded_files/${id}` })),
  read("leads2b_list_opportunity_quotations", "v1", "/opportunity/quotation/{id}/QUOTATION", "Consulta os orçamentos da oportunidade. Permite solicitar itens com loadItems.",
    { ...id, loadItems: z.boolean().default(false) }, ({ id, loadItems }) => ({
      path: `/opportunity/quotation/${id}/QUOTATION`, query: { loadItems }
    })),
  fixed("leads2b_get_voice_details_status", "v1", "/voice/details", "Informa se a API retornou detalhes de telefonia no escopo da credencial.", { select: voiceDetailsPresence })
];

const tools = [...p1, ...p2, ...p3];
export const operationalReadToolNames = tools.map(tool => tool.name);

export function registerOperationalReadTools(server: McpServer, deps: ReadDeps): void {
  for (const tool of tools) tool.register(server, deps);
}

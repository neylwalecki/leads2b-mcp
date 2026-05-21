# Ferramentas MCP

Lista resumida das ferramentas disponíveis no servidor.

## Retorno Padrão

As ferramentas retornam JSON estruturado:

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;
  summary?: string;
  warnings?: string[];
  source: {
    api: "v1" | "v2" | "snippet" | "local";
    endpoint?: string;
    stability: "confirmed" | "observed" | "experimental" | "unknown";
  };
};
```

## Health

| Ferramenta | Finalidade |
|---|---|
| `leads2b_health_check` | Valida tokens, APIs, bases e ferramentas disponíveis. |

## Catálogos e Operação

| Ferramenta | API | Endpoint |
|---|---|---|
| `leads2b_get_logged_user` | v1 | `/user/logged/` |
| `leads2b_list_users` | v2 | `/users` |
| `leads2b_list_users_by_access_level` | v1 | `/user/users_by_access_level` |
| `leads2b_list_origins` | v1 | `/origin/index/` |
| `leads2b_list_pipelines` | v1 | `/pipeline/active` |
| `leads2b_list_pipelines_by_entity` | v1 | `/pipeline/byEntity/{entity}` |
| `leads2b_get_dashboard_counts` | v1 | `/dashboard/*_count/` |
| `leads2b_list_forms` | v1 | `/form/index` |
| `leads2b_get_lead_columns` | v1 | `/lead/columns` |
| `leads2b_get_entity_columns` | v1 | `/custom_column/entity_columns/{entity}/` |
| `leads2b_list_tags` | v1 | `/tag/index/` |
| `leads2b_list_loss_reasons` | v1 | `/loss/index/opportunity` |
| `leads2b_list_actions` | v1 | `/action/list/` |
| `leads2b_search_campaigns` | v1 | `/campaign/search` |
| `leads2b_search_flows` | v1 | `/flow/search` |
| `leads2b_count_deals` | v1 | `/deal/count_deals` |
| `leads2b_list_customer_types` | v1 | `/customer_type` |
| `leads2b_get_receita_by_cnpj` | v1 | `/receita/index/{cnpj}` |
| `leads2b_list_cnaes` | v2 | `/markets/cnaes/all` |
| `leads2b_list_segmentations` | v2 | `/segmentations` |
| `leads2b_list_calendar_events` | v2 | `/mail/calendars/events` |
| `leads2b_list_mail_accounts` | v2 | `/mail/accounts` |
| `leads2b_list_company_feedbacks` | v2 | `/feedbacks/company` |
| `leads2b_get_company_events` | v2 | `/companies/event` |
| `leads2b_list_chrome_extension_users` | v1 | `/chrome_extension/users` |

## Customers e Leads

| Ferramenta | API | Observação |
|---|---|---|
| `leads2b_list_customers` | v1 | Lista customers via `/customer/index`; aceita `limit`, `offset`, `search` e `summaryOnly`. |
| `leads2b_find_customer` | v1/local | Filtra localmente por e-mail, telefone, documento, nome ou texto. |
| `leads2b_search_customers` | v2 | Busca server-side em `/customer?search={search}`. |
| `leads2b_get_customer` | v2 | Consulta `/customer/{id}`. |
| `leads2b_get_lead_detail` | v1 | Consulta `/lead/index/{id}/defaultLead`. |

## Atribuição

| Ferramenta | API | Observação |
|---|---|---|
| `leads2b_get_conversions` | v2 | Exige `id` e `entity`. |
| `leads2b_get_tracking` | v2 | Exige `id` e `entity`. |
| `leads2b_normalize_source` | local | Classifica origem por UTMs, click IDs, referrer e host. |
| `leads2b_find_attribution_candidates` | v1/v2/local | Cruza customers v1 com eventos v2 para descobrir IDs úteis. |
| `leads2b_diagnose_attribution` | v2/local | Calcula first touch observado, last touch observado e divergências. |
| `leads2b_diagnose_customer_attribution` | v1/v2/local | Busca customer e diagnostica atribuição em uma chamada. |

`entity` deve ser `LEAD`, `CONTACT` ou `OPPORTUNITY`.

## Snippet e Webhooks

| Ferramenta | API | Endpoint |
|---|---|---|
| `leads2b_list_webhooks` | v2 | `/webhooks` |
| `leads2b_get_snippet_config` | v2 | `/integrations/config/token` |
| `leads2b_get_snippet_script` | v2 | `/integrations/config/script` |

## Escrita

Ferramentas de escrita são registradas conforme:

```txt
LEADS2B_WRITE_MODE=disabled
LEADS2B_WRITE_MODE=preview
LEADS2B_WRITE_MODE=live
```

| Ferramenta | API | Status |
|---|---|---|
| `leads2b_create_customer` | v2 | Experimental |
| `leads2b_update_customer` | v2 | Experimental |

`disabled` não registra ferramentas de escrita. `preview` retorna plano sem alteração real. `live` executa creates e updates simples diretamente.

```ts
type CreateCustomerInput = {
  fields: Record<string, unknown>;
};

type UpdateCustomerInput = {
  id: string | number;
  fields: Record<string, unknown>;
};
```

## Raw API

Registrada somente com:

```txt
LEADS2B_ENABLE_RAW_API=true
```

| Ferramenta | API | Status |
|---|---|---|
| `leads2b_api_request` | v1/v2 | Avançada |

`GET` e `OPTIONS` executam direto. Métodos mutantes respeitam `LEADS2B_WRITE_MODE`; delete, bulk e merge exigem `confirm_destructive=true`.

## Próximas Versões

- Consolidar contratos de leads, oportunidades, contatos e atividades quando houver endpoints confiáveis.
- Adicionar ferramentas específicas para deletes apenas com confirmação explícita e plano de recuperação.

# Endpoints

Resumo dos endpoints usados ou observados pelo MCP.

Status:

- `Confirmado`: respondeu com sucesso nos testes do projeto.
- `Observado`: endpoint existe ou respondeu a probe não mutante, mas o contrato ainda não é estável.
- `Experimental`: contrato observado, mas ainda não tratado como estável.
- `Não confirmado`: visto no app, mas ainda não funcionou corretamente via token de API no MCP.

## Autenticação

```http
Authorization: Bearer <TOKEN>
Accept: application/json
```

## API v1

Base: `https://app.leads2b.com/api/v1`

| Endpoint | Método | Status | Uso |
|---|---:|---|---|
| `/user/logged/` | GET | Confirmado | Usuário autenticado. |
| `/user/users_by_access_level` | GET | Confirmado | Usuários por nível de acesso. |
| `/origin/index/` | GET | Confirmado | Origens cadastrais. |
| `/pipeline/active` | GET | Confirmado | Pipelines ativos. |
| `/pipeline/byEntity/LEAD` | GET | Confirmado | Pipelines de lead. |
| `/pipeline/byEntity/OPPORTUNITY` | GET | Confirmado | Pipelines de oportunidade. |
| `/dashboard/lead_count/` | GET | Confirmado | Contador de leads. |
| `/dashboard/opportunity_count/` | GET | Confirmado | Contador de oportunidades. |
| `/dashboard/won_opportunity_count/` | GET | Confirmado | Oportunidades ganhas. |
| `/dashboard/hot_opportunity_count/` | GET | Confirmado | Oportunidades quentes. |
| `/dashboard/after_sales_count/` | GET | Confirmado | Pós-venda. |
| `/form/index` | GET | Confirmado | Formulários. |
| `/lead/columns` | GET | Confirmado | Colunas de lead. |
| `/lead/index/{id}/defaultLead` | GET | Confirmado | Detalhe de lead. |
| `/external_resources/create_lead` | OPTIONS | Confirmado | Endpoint público de criação externa de lead; não cria dados. |
| `/external_resources/create_lead` | POST | Observado | Criação externa de lead documentada na Central de Ajuda da Leads2b; não exposto como ferramenta normal nesta versão. |
| `/customer/index` | GET | Confirmado | Customers existentes. |
| `/customer_type` | GET | Confirmado | Tipos de customer. |
| `/tag/index/` | GET | Confirmado | Tags. |
| `/loss/index/opportunity` | GET | Confirmado | Motivos de perda. |
| `/action/list/` | GET | Confirmado | Tipos de ação. |
| `/campaign/search` | GET | Confirmado | Busca de campanhas. |
| `/flow/search` | GET | Confirmado | Busca de fluxos. |
| `/deal/count_deals` | GET | Confirmado | Contagem de deals por pipeline/status. |
| `/custom_column/entity_columns/{ENTITY}/` | GET | Confirmado | Colunas customizadas. |
| `/receita/index/{cnpj}` | GET | Confirmado | Consulta Receita/CNPJ. |
| `/chrome_extension/users` | GET | Confirmado | Usuários para extensão Chrome. |
| `/dashboard/pending_action_count/` | GET | Não confirmado | Falhou com HTTP 500. |
| `/custom_table/simple_tables` | GET | Não confirmado | Falhou com HTTP 500. |
| `/schedule/index/` | GET | Não confirmado | Falhou com HTTP 500. |
| `/schedule/count/` | GET | Não confirmado | Falhou com HTTP 500. |
| `/globalSearch/searchV2/` | GET | Não confirmado | Falhou com HTTP 500/400. |
| `/pipeline/kanbanData/{id}` | GET | Não confirmado | Falhou com HTTP 500. |

## API v2

Base: `https://app.leads2b.com/api/v2`

| Endpoint | Método | Status | Uso |
|---|---:|---|---|
| `/users` | GET | Confirmado | Usuários da conta. |
| `/webhooks` | GET | Confirmado | Webhooks. |
| `/customer` | GET | Confirmado | Lista/busca de customers. |
| `/customer` | OPTIONS | Observado | Endpoint responde a probe não mutante. |
| `/customer` | POST | Experimental | Criação de customer via `leads2b_create_customer`. |
| `/customer/{id}` | GET | Confirmado | Detalhe de customer. |
| `/customer/{id}` | PATCH | Experimental | Atualização de customer. |
| `/customer/{id}` | OPTIONS | Observado | IDs inválidos podem retornar validação, mas o endpoint existe. |
| `/deals?entity=OPPORTUNITY` | GET | Observado | Lista oportunidades/deals. Usado por `leads2b_list_recent_opportunities`. |
| `/deals?entity=LEAD` | GET | Observado | Lista leads/deals quando a conta expõe essa entidade. |
| `/markets/cnaes/all` | GET | Confirmado | CNAEs/mercados. |
| `/markets/countries` | GET | Confirmado | Países/mercados. |
| `/mail/accounts` | GET | Confirmado | Contas de e-mail. |
| `/mail/calendars/events` | GET | Confirmado | Eventos de calendário. |
| `/segmentations` | GET | Confirmado | Segmentações por entidade. |
| `/feedbacks/company` | GET | Confirmado | Feedbacks da empresa. |
| `/companies/event` | GET | Confirmado | Eventos da empresa. |
| `/integrations/config/token` | GET | Confirmado | Token público do snippet. |
| `/integrations/config/script` | GET | Confirmado | Script do snippet. |
| `/conversions` | GET | Confirmado | Conversões por `id` e `entity`. |
| `/conversions/tracking` | GET | Confirmado | Tracking por `id` e `entity`. |
| `/users/filters?name=leadsColumns` | GET | Confirmado | Filtro salvo de colunas. |
| `/deals/lead-inbox` | GET | Não confirmado | Falhou com HTTP 404. |
| `/deals/{id}` | GET | Não confirmado | Falhou com HTTP 404 nos probes. |
| `/contacts` | GET/OPTIONS | Não confirmado | Falhou com HTTP 404 nos probes. |
| `/leads` | GET/OPTIONS | Não confirmado | Falhou com HTTP 404 nos probes. |

`entity` para conversões/tracking: `LEAD`, `CONTACT` ou `OPPORTUNITY`.

`/deals` respondeu com `data`, `total` e `entity`. Campos observados incluem `id`, `type`, `company_name`, `name`, `mainContactEmail`, `mainContactPhone`, `origin_name`, `pipeline_name`, `pipeline_item_name`, `pipeline_item_value`, `user_name`, `created_at` e `parameters`. Filtros além de `entity`, `limit`, `offset` e `search` ainda não são tratados como contrato estável; o MCP aplica filtros finos localmente.

Referência pública observada para criação externa de lead: [Central de Ajuda Leads2b - Integração com WordPress](https://ajuda.leads2b.com/pt-BR/articles/7036518-como-realizar-a-integracao-com-wordpress).

## CRUD Investigado

| Área | Leitura confiável | Escrita exposta | Observações |
|---|---|---|---|
| Customers | `GET /customer`, `GET /customer/{id}`, `GET /customer/index` | `POST /customer`, `PATCH /customer/{id}` | Create/update seguem como experimentais. |
| Oportunidades/deals | `GET /deals?entity=OPPORTUNITY`, `GET /deal/count_deals`, conversões/tracking por `OPPORTUNITY` | Não exposta | Listagem é observada; detalhe direto por ID ainda não foi confirmado. |
| Leads | `GET /lead/index/{id}/defaultLead`, `GET /deals?entity=LEAD` | Não exposta como CRUD normal | `POST /external_resources/create_lead` existe como integração externa, mas precisa contrato próprio. |
| Contatos | Conversões/tracking por `CONTACT` | Não exposta | Endpoints diretos de contato ainda não confiáveis. |
| Atividades | `GET /mail/calendars/events`, `GET /action/list/` | Não exposta | `schedule` ainda não virou contrato confiável. |

`leads2b_api_request` permite investigar endpoints v1/v2 atrás de `LEADS2B_ENABLE_RAW_API=true`, mas não muda o status público dos contratos.

## Snippet Público

Base: `https://js.app.leads2b.com`

| Endpoint | Método | Status | Uso |
|---|---:|---|---|
| `/latest` | GET | Confirmado | JavaScript público do snippet. |
| `/api/configs` | GET/POST | Confirmado | Configuração do snippet. |
| `/api/tracking` | POST | Confirmado | Registra tracking. |
| `/api/conversion` | POST | Confirmado | Registra conversão. |

O MCP consulta e diagnostica o snippet. Ele não dispara conversões reais por padrão.

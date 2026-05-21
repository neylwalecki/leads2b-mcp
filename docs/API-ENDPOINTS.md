# Endpoints Suportados

## Convenções

Status:

- `Confirmado`: endpoint testado e respondeu com sucesso.
- `Não confirmado`: endpoint visto no app, mas ainda não respondeu corretamente com token de API no MCP.
- `A pesquisar`: endpoint desejado, mas ainda não encontrado.

Suporte MCP:

- `MVP`: implementado no servidor atual.
- `Depois`: candidato para uma versão futura.
- `Não expor`: não será exposto como ferramenta normal.

## Autenticação

```http
Authorization: Bearer <TOKEN>
Accept: application/json
```

Os tokens v1 e v2 podem ter escopos e validade diferentes. O MCP reporta token ausente e expiração detectável em `leads2b_health_check`.

## API v1

Base:

```txt
https://app.leads2b.com/api/v1
```

| Endpoint | Método | Status | O que oferece | Observações | Suporte MCP |
|---|---:|---|---|---|---|
| `/user/logged/` | GET | Confirmado | Usuário logado/autenticado | Bom para validar token v1. | MVP |
| `/pipeline/active` | GET | Confirmado | Pipelines ativos | Útil para listar funis disponíveis. | MVP |
| `/pipeline/byEntity/LEAD` | GET | Confirmado | Pipelines de lead | Útil para escolher funil correto por tipo de entidade. | MVP |
| `/pipeline/byEntity/OPPORTUNITY` | GET | Confirmado | Pipelines de oportunidade | Útil para escolher funil correto por tipo de entidade. | MVP |
| `/dashboard/lead_count/` | GET | Confirmado | Contador de leads | Retorna objeto com `result`. | MVP |
| `/dashboard/opportunity_count/` | GET | Confirmado | Contador de oportunidades | Retorna objeto com `result`. | MVP |
| `/dashboard/won_opportunity_count/` | GET | Confirmado | Contador de oportunidades ganhas | Retorna objeto com `result`. | MVP |
| `/dashboard/hot_opportunity_count/` | GET | Confirmado | Contador de oportunidades quentes | Retorna objeto com `result`. | MVP |
| `/dashboard/after_sales_count/` | GET | Confirmado | Contador de pós-venda | Retorna objeto com `result`. | MVP |
| `/dashboard/pending_action_count/` | GET | Não confirmado | Contador de ações pendentes | Falhou com HTTP 500 em teste com token de API. | Depois |
| `/user/users_by_access_level` | GET | Confirmado | Usuários por nível de acesso | Útil para responsáveis, filtros e auditoria. | MVP |
| `/origin/index/` | GET | Confirmado | Catálogo de origens de clientes | Essencial para diagnosticar origem cadastral. | MVP |
| `/tag/index/` | GET | Confirmado | Tags cadastradas | Útil para filtros e classificação. | MVP |
| `/loss/index/opportunity` | GET | Confirmado | Motivos de perda de oportunidades | Útil para relatórios e diagnóstico comercial. | MVP |
| `/chrome_extension/users` | GET | Confirmado | Usuários disponíveis para extensão Chrome | Pode retornar lista vazia. | MVP |
| `/action/list/` | GET | Confirmado | Ações/tipos de ação | Útil para calendário e diagnóstico de atividades. | MVP |
| `/campaign/search` | GET | Confirmado | Busca de campanhas | Aceita chamada simplificada com `draw` e `search[value]`. | MVP |
| `/flow/search` | GET | Confirmado | Busca de fluxos | Aceita chamada simplificada com `draw` e `search[value]`. | MVP |
| `/deal/count_deals` | GET | Confirmado | Contagem de deals | Requer `pipelineId` e `status`. | MVP |
| `/custom_column/entity_columns/{ENTITY}/` | GET | Confirmado | Colunas customizadas por entidade | Confirmado para `LEAD`, `CONTACT` e `OPPORTUNITY`. | MVP |
| `/customer_type` | GET | Confirmado | Tipos de customer | Catálogo simples da conta. | MVP |
| `/receita/index/{cnpj}` | GET | Confirmado | Consulta Receita/CNPJ | Usa CNPJ no path. Pode retornar dados cadastrais públicos e de contato. | MVP |
| `/form/index` | GET | Confirmado | Formulários/configurações disponíveis | Pode retornar lista vazia quando não houver formulários configurados. | MVP |
| `/lead/columns` | GET | Confirmado | Colunas/campos de lead | Útil para introspecção de schema. | MVP |
| `/customer/index` | GET | Confirmado | Clientes existentes da conta | Retorna `data.customers[]` com `id` e campos cadastrais. Útil para descobrir IDs candidatos para conversões/tracking. | MVP |
| `/lead/index/{id}/defaultLead` | GET | Confirmado | Detalhe de lead | Usa ID de lead/customer aceito pela API. | MVP |
| `/custom_table/simple_tables` | GET | Não confirmado | Tabelas customizadas simples | Falhou com HTTP 500 em teste com token de API. | Depois |
| `/schedule/index/` | GET | Não confirmado | Agenda/lista de atividades | Endpoint observado no app, mas falhou com HTTP 500 em teste com token de API. | Depois |
| `/schedule/count/` | GET | Não confirmado | Contadores de atividades | Endpoint observado no app, mas falhou com HTTP 500 em teste com token de API. | Depois |
| `/globalSearch/searchV2/` | GET | Não confirmado | Busca global | Endpoint observado no app, mas falhou com HTTP 500 em teste com token de API. | Depois |
| `/pipeline/kanbanData/{id}` | GET | Não confirmado | Cards do kanban por pipeline | Endpoint observado no app, mas falhou com HTTP 500 em teste com token de API. | Depois |

## API v2

Base:

```txt
https://app.leads2b.com/api/v2
```

| Endpoint | Método | Status | O que oferece | Observações | Suporte MCP |
|---|---:|---|---|---|---|
| `/users` | GET | Confirmado | Usuários da conta | Bom para auditoria e distribuição. | MVP |
| `/webhooks` | GET | Confirmado | Webhooks configurados | Pode retornar lista vazia quando não houver webhooks configurados. | MVP |
| `/customer` | GET | Confirmado | Lista e busca server-side de customers | Aceita `search` para filtrar. | MVP |
| `/customer/{id}` | GET | Confirmado | Detalhe de customer | Usa ID retornado em `/customer`. | MVP |
| `/markets/cnaes/all` | GET | Confirmado | CNAEs/mercados | Útil para filtros e segmentação. | MVP |
| `/mail/accounts` | GET | Confirmado | Contas de e-mail conectadas | Pode retornar lista vazia. | MVP |
| `/mail/calendars/events` | GET | Confirmado | Eventos de calendário | Aceita arrays `users[]`, `calendars[]`, `types[]` e janela `start`/`end`. | MVP |
| `/segmentations` | GET | Confirmado | Segmentações por entidade | Confirmado para `CUSTOMER`, `LEAD` e `OPPORTUNITY`. | MVP |
| `/feedbacks/company` | GET | Confirmado | Feedbacks da empresa | Endpoint de conta/empresa, não de lead individual. | MVP |
| `/companies/event` | GET | Confirmado | Eventos/recompensas da empresa | Endpoint de conta/empresa. | MVP |
| `/users/filters?name=leadsColumns` | GET | Confirmado | Filtro salvo de colunas de leads | Respondeu com `data: null` no teste com token de API. | Depois |
| `/deals/lead-inbox` | GET | Não confirmado | Inbox de leads/deals | Endpoint observado no app, mas falhou com HTTP 404 em teste com token de API. | Depois |
| `/integrations/config/token` | GET | Confirmado | Token público do snippet | Não confundir com token privado de API. | MVP |
| `/integrations/config/script` | GET | Confirmado | Script completo do snippet | Útil para validar instalação. | MVP |
| `/markets/countries` | GET | Confirmado | Países/mercados | Baixa prioridade operacional. | Depois |
| `/conversions?id={id}&entity={ENTITY}` | GET | Confirmado | Conversões de uma entidade | `ENTITY` aceitou `LEAD`, `CONTACT`, `OPPORTUNITY` em maiúsculas. | MVP |
| `/conversions/tracking?id={id}&entity={ENTITY}` | GET | Confirmado | Eventos de tracking de uma entidade | Mesmo padrão de parâmetros de conversões. | MVP |

### Parâmetros de Conversões e Tracking

`entity` precisa estar em maiúsculas. Valores aceitos:

```txt
LEAD
CONTACT
OPPORTUNITY
```

Quando `id` ou `entity` não são enviados, a API retorna 422 com validação.

### Campos de Conversão/Tracking

Campos tratados pelo MCP quando aparecem em `data[]`:

| Campo | Descrição | Uso no MCP |
|---|---|---|
| `id` | ID do evento | Identificação e ordenação. |
| `utm_source` | Fonte UTM | Alta prioridade para diagnóstico. |
| `utm_medium` | Meio UTM | Alta prioridade para diagnóstico. |
| `utm_campaign` | Campanha UTM | Alta prioridade para diagnóstico. |
| `utm_term` | Termo UTM | Diagnóstico de campanha. |
| `utm_content` | Conteúdo UTM | Diagnóstico de criativo/formulário. |
| `title` | Título da página/evento | Contexto do evento. |
| `email` | E-mail informado | Deve aparecer nas respostas da conta autenticada; não publicar em fixtures ou issues. |
| `phone` | Telefone informado | Deve aparecer nas respostas da conta autenticada; não publicar em fixtures ou issues. |
| `g_clid` | Click ID do Google | Sinal forte de mídia paga Google. |
| `fb_clid` | Click ID da Meta | Sinal possível de mídia Meta. |
| `fields` | Campos do formulário | Pode conter dados pessoais; não publicar conteúdo real em fixtures ou issues. |
| `lead_origin` | Origem classificada pela Leads2b | Exibir, mas não tratar como verdade absoluta. |
| `created_at` | Data do evento | Ordenação first/last touch. |
| `message_date_sql` | Data SQL do evento | Alternativa para ordenação. |
| `timezone` | Fuso | Normalização temporal. |
| `host` | Domínio/página | Útil para origem site BR/EUA ou múltiplos domínios. |

## Worker Público do Snippet

Base:

```txt
https://js.app.leads2b.com
```

Formato típico do snippet:

```html
<script>window.l2bConfig = { token: '<TOKEN_PUBLICO_DO_SNIPPET>', workerUrl: 'https://js.app.leads2b.com' };</script>
<script name="leads2b" src="https://js.app.leads2b.com/latest" defer></script>
```

| Endpoint | Método | Status | O que oferece | Observações | Suporte MCP |
|---|---:|---|---|---|---|
| `/latest` | GET | Confirmado | JavaScript público do snippet | Pode ser baixado para inspeção. | MVP diagnóstico |
| `/api/configs` | GET/POST | Confirmado | Configuração do snippet | Usado pelo script público. | MVP diagnóstico |
| `/api/tracking` | POST | Confirmado | Registra evento de tracking | Pode gerar dados reais. | Não expor por padrão |
| `/api/conversion` | POST | Confirmado | Registra conversão | Pode gerar leads/conversões reais. | Não expor por padrão |

### Campos do Snippet

Payloads públicos podem carregar:

| Campo | Descrição |
|---|---|
| `id_form` | ID do formulário capturado. |
| `email` | E-mail do lead. |
| `phone` | Telefone. |
| `company_name` | Empresa. |
| `allow_communication` | Permissão de comunicação. |
| `utm_source` | Fonte UTM. |
| `utm_medium` | Meio UTM. |
| `utm_campaign` | Campanha UTM. |
| `utm_term` | Termo UTM. |
| `utm_content` | Conteúdo UTM. |
| `gclid` | Google click ID. |
| `fbclid` | Meta click ID. |

O MCP pode validar se o snippet está instalado e se as UTMs estão sendo preservadas, mas não deve disparar conversão real sem modo explícito de teste.

## Itens Futuros

| Necessidade | Prioridade | Comentário |
|---|---:|---|
| Buscar lead por e-mail | Alta | Melhoraria a UX do MCP para diagnósticos rápidos. |
| Buscar oportunidade por e-mail | Alta | Útil quando leads viram oportunidades automaticamente. |
| Buscar contato por e-mail | Média | Útil para enriquecimento e conferência. |
| Buscar oportunidade/contato por ID | Alta | Necessário para relatórios completos. |
| Atualizar origem de entidade | Alta | Deve ficar em fase própria, com gates e dry-run. |
| Criar/editar origem | Média | Deve ficar em fase própria, com gates e dry-run. |
| Listar configurações específicas do snippet por formulário | Média | Útil para auditoria de setup. |

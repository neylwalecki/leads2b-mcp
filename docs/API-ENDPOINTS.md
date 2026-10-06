# Endpoints

Resumo dos endpoints usados ou observados pelo MCP. Revisão: 2026-09-08.

Os status legados abaixo são registros de probes do projeto, não garantia permanente de disponibilidade. HTTP 200 e lista vazia não comprovam contexto de usuário nem escopo completo. A validação de escrita tem seu próprio quadro ao final.

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
| `/users` | GET | Confirmado | Resposta v2 de usuários; não equivale ao cadastro da equipe v1. |
| `/webhooks` | GET | Confirmado | Webhooks. |
| `/customer` | GET | Confirmado | Lista/busca de customers. |
| `/customer` | OPTIONS | Observado | Endpoint responde a probe não mutante. |
| `/customer/{id}` | GET | Confirmado | Detalhe de customer. |
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

## CRUD e evidência de execução

Rotas identificadas no [aplicativo público da Leads2b](https://app.leads2b.com/) e no bundle `common-xtdBsm3x.js`, observado em 2026-09-08. A existência no frontend não substitui validação com o tipo de token utilizado pelo MCP.

| Entidade | Criar | Ler | Editar | Excluir |
|---|---|---|---|---|
| Customer | `POST /customer/index` | `GET /customer/index/{id}` | `PUT /customer/index/{id}` | `DELETE /customer/index/{id}` |
| Contato | `POST /customer/contact` | `GET /customer/contact_by_id/{id}` | `PUT /customer/contact/{id}` | `DELETE /customer/contact/{id}` |
| Lead | `POST /lead` | `GET /lead/index/{id}/defaultLead` | `PUT /deal/index` | `DELETE /lead/index/{id}` |
| Oportunidade | `POST /opportunity/index/` | `GET /opportunity/index/{id}` | `PUT /deal/index` | `DELETE /opportunity/index/{id}` |

Listagens complementares: `GET /customer/contact/{customerId}`, `GET /user/all` e `GET /pipeline/pipeline_items/{pipelineId}`. Para editar negócio, o corpo é `{deal: {id, type: "LEAD" | "OPPORTUNITY"}, edit_data: fields}`.

### Teste controlado em 2026-09-08

Foram criados registros temporários, alterados campos básicos e conferidas as releituras. Todos os registros criados no teste foram excluídos e a exclusão foi relida. O cadastro preexistente usado como controle foi preservado. Dados e recibos reais ficam fora do repositório público.

| Operação | Evidência e limite |
|---|---|
| Customer (`PERSON`) | Criação, leitura, edição de nome e exclusão confirmadas. `ORGANIZATION` usa o mesmo endpoint, com schema próprio; não houve teste real desse tipo. |
| Contato | Criação com vínculo a customer, leitura, edição de nome sem perder e-mail e exclusão confirmadas. |
| Lead | Criação com token de usuário, leitura, edição de título/e-mail e exclusão confirmadas. O campo de criação é `email_contact`; tentativa duplicada foi rejeitada com `email_already_used`. |
| Oportunidade | Criação, leitura e exclusão confirmadas. Edição de título persistiu, mas a API retornou HTTP 500; uma resposta de erro não comprova rollback. |
| Token de empresa | Não retornou usuário em `/user/logged/`; criação de negócios falhou com HTTP 500. O mesmo cadastro foi acessível com token de usuário autorizado, que permitiu criar os negócios. |

A 0.3.0 verifica contexto de usuário antes do CRUD de negócios. Após erro de escrita com ID conhecido, tenta uma releitura e expõe o resultado sem declarar sucesso da chamada. Não faz retry de mutações.

`PUT /lead/edit_lead/{id}` foi observado no frontend, mas não persistiu o título no teste. `PUT /opportunity/edit_opportunity/{id}` retornou erro. Por isso, os tools usam o contrato observado de `PUT /deal/index` para edição. As rotas presumidas de escrita v2 da versão anterior foram removidas.

### Datas observadas

Comparando horário de envio do teste com a resposta, a v1 devolveu horário UTC-03 sem offset. O detalhe de customer v2 devolveu o mesmo horário com `Z`, três horas antes do instante real quando interpretado literalmente. É uma inconsistência do fornecedor, não do fuso do Windows. Datas brutas são preservadas; a coleta permite correção explícita de interpretação com `apiTimestampOffset` após validação da conta. Isso não prova a mesma semântica em conversões/tracking ou em todo endpoint v2.

### API pública separada

A [referência OpenAPI](https://developers.leads2b.dev/api/openapi) consultada lista pedidos, itens, endereços e imagem de produto na base `https://api.leads2b.com/v2`. Não é a base interna usada por este MCP e não prova ausência de CRUD de leads/contatos no produto. A [paginação geral](https://developers.leads2b.dev/api/pagination) não deve ser aplicada indiscriminadamente a endpoints internos.

`GET /deals` foi validado com `limit/offset` em páginas distintas. O parâmetro `search` foi ignorado no teste; o MCP aplica critérios locais sobre os registros coletados. A coleta detecta limites, páginas repetidas e mudanças de totais. Mesmo completa para a janela solicitada, não é snapshot atômico.

## Snippet Público

Base: `https://js.app.leads2b.com`

| Endpoint | Método | Status | Uso |
|---|---:|---|---|
| `/latest` | GET | Confirmado | JavaScript público do snippet. |
| `/api/configs` | GET/POST | Confirmado | Configuração do snippet. |
| `/api/tracking` | POST | Confirmado | Registra tracking. |
| `/api/conversion` | POST | Confirmado | Registra conversão. |

O MCP consulta e diagnostica o snippet. Ele não dispara conversões reais por padrão.

## Contratos experimentais observados em 05/10/2026

Fontes: [aplicativo público](https://app.leads2b.com/), [common-DbozlP4W.js](https://app.leads2b.com/common-DbozlP4W.js) e [deals-ClsvYcLi.js](https://app.leads2b.com/deals-ClsvYcLi.js). Inspeção estática de arquivos públicos, sem sessão, tokens ou chamadas autenticadas. URLs com hash podem deixar de existir; os fingerprints identificam o conteúdo observado.

| Arquivo | SHA-256 |
|---|---|
| `common-DbozlP4W.js` | `2c3d64c9a13f25a7a9c38e010e25b9a19c87b74a69e4d8f089a39c57dead125d` |
| `deals-ClsvYcLi.js` | `bbfc97b11793591f12cc2d3a95285ab83a13ee31651a87f1b6b30f933f503edc` |

O cliente `E` do frontend aponta à API interna v1. Os contratos observados são instáveis e não comprovam persistência nem permissões com tokens do MCP.

| Operação | Evidência no frontend | Implementação e limite |
|---|---|---|
| Ganho | `$We`, exportado como `cr`, chamado como `Cn` no modal; `PUT opportunity/winOpportunity/{id}`. | Payload do modal: `cloneOpportunity=NOT_CLONE`, `createAfterSale=false` como string, `afterSalePipeline/idRouter/idUser=null`. Não oferece clonagem, roteamento ou pós-venda. |
| Perda | `ST` com `type=OPPORTUNITY`; `PUT opportunity/opportunityLost`. | `id_opportunity`, `id_loss`, `exclusion_reason`; `cloning_opportunity`, `finishWorkflowInstances` e `reactivate_lead` falsos. |
| Anotação | `qb`, exportado como `dH`; `POST history/index/` com formulário no envelope `data`. Formulário/comentários usam `option=comment`, `message`, `receiver`, entidade e ID. | Receiver restrito ao usuário autenticado, sem menções, anexos ou notificações adicionais por ferramenta. Efeitos internos do fornecedor seguem suas regras. |
| Atividade | Formulário chama `qb` com `option=action`, `receiver`, `action`, `data`, `final_date`, `message`, `id_pipeline_item`. | Insere no histórico; não cria evento de calendário, convite, envio de mensagem ou marca conclusão. |
| Histórico | `ci`: `GET history/index/` com `entity`, `id_entity`, `limit`, `offset`. | Releitura de até 25 registros após as novas operações. Não é prova automática de persistência. |
| Campos personalizados | Tela de detalhe lê `deal.custom_columns` via JSON, além dos grupos já observados. | Normalizador preserva `custom_columns`; detalhes v1 existentes retornam fonte integral. Sem garantia de preenchimento na conta. |
| Busca customers | `HT` usa API v2 `customer` com `limit`, `offset`, `search`. | Indício de paginação nativa no cliente oficial. Sem execução autenticada, sua semântica e respeito ao limite permanecem não verificados pelo MCP; saída usa recorte local explícito. |

A [referência OpenAPI pública](https://developers.leads2b.dev/api/openapi) consultada nesta revisão lista pedidos, itens de pedido, endereços e imagem de produto. A [documentação de webhooks](https://developers.leads2b.dev/webhooks/) descreve eventos Won/Lost; esses eventos não fornecem o contrato de mutação. Nenhuma das duas fontes substitui validação dos contratos internos acima.

Lacunas para validação controlada: persistência real das quatro operações, permissões por endpoint, regras da conta, efeitos sobre workflows e pré-requisitos de ganho/perda. Ganho/perda de lead e conclusão de atividades continuam sem ferramenta dedicada. A ausência de exemplos de erro completos impede atribuir causas aos HTTP 400/500 relatados.

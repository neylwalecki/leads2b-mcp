# Endpoints

Referência dos endpoints utilizados pelo MCP. As tabelas de leitura refletem observações de 08/09/2026; operações experimentais foram adicionadas em 05/10/2026.

Status indica a evidência técnica disponível, não uma garantia de acesso em toda conta. HTTP 200 e lista vazia não comprovam contexto de usuário nem cobertura completa.

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

### Comportamentos de escrita

- CRUD de negócios exige token v1 com contexto de usuário; a verificação ocorre antes de enviar alterações em `live`.
- A conta pode exigir campos adicionais. Customer aceita `PERSON` ou `ORGANIZATION`; os requisitos de cada tipo continuam sujeitos à API.
- Criação de lead usa `email_contact`; duplicatas podem retornar `email_already_used`.
- Uma atualização de oportunidade pode persistir mesmo quando a API retorna HTTP 500. Após erro com ID conhecido, o servidor tenta uma releitura e não repete a mutação automaticamente.
- A edição de leads/oportunidades usa `PUT /deal/index`; as rotas antigas de edição não persistiram todos os campos nos testes.

### Datas observadas

Comparando horário de envio do teste com a resposta, a v1 devolveu horário UTC-03 sem offset. O detalhe de customer v2 devolveu o mesmo horário com `Z`, três horas antes do instante real quando interpretado literalmente. Os dois retornos têm semânticas de fuso distintas. Datas brutas são preservadas; a coleta permite correção explícita de interpretação com `apiTimestampOffset` após validação da conta. Isso não prova a mesma semântica em conversões/tracking ou em todo endpoint v2.

### API pública separada

A [referência OpenAPI](https://developers.leads2b.dev/api/openapi) consultada lista pedidos, itens, endereços e imagem de produto na base `https://api.leads2b.com/v2`. Não é a base interna usada por este MCP e não prova ausência de CRUD de leads/contatos no produto. A [paginação geral](https://developers.leads2b.dev/api/pagination) não deve ser aplicada indiscriminadamente a endpoints internos.

`GET /deals` foi validado com `limit/offset` em páginas distintas. O parâmetro `search` foi ignorado no teste; o MCP aplica critérios locais sobre os registros coletados. A coleta detecta limites, páginas repetidas e mudanças de totais. Mesmo completa para a janela solicitada, não é snapshot atômico.

## Snippet público

Base: `https://js.app.leads2b.com`

| Endpoint | Método | Status | Uso |
|---|---:|---|---|
| `/latest` | GET | Confirmado | JavaScript público do snippet. |
| `/api/configs` | GET/POST | Confirmado | Configuração do snippet. |
| `/api/tracking` | POST | Confirmado | Registra tracking. |
| `/api/conversion` | POST | Confirmado | Registra conversão. |

O MCP consulta e diagnostica o snippet. Ele não dispara conversões reais por padrão.

## Operações experimentais

Fontes: [aplicativo público](https://app.leads2b.com/), [common-DbozlP4W.js](https://app.leads2b.com/common-DbozlP4W.js) e [deals-ClsvYcLi.js](https://app.leads2b.com/deals-ClsvYcLi.js). Inspeção estática de arquivos públicos, sem sessão, tokens ou chamadas autenticadas. URLs com hash podem deixar de existir; os fingerprints identificam o conteúdo observado.

| Arquivo | SHA-256 |
|---|---|
| `common-DbozlP4W.js` | `2c3d64c9a13f25a7a9c38e010e25b9a19c87b74a69e4d8f089a39c57dead125d` |
| `deals-ClsvYcLi.js` | `bbfc97b11793591f12cc2d3a95285ab83a13ee31651a87f1b6b30f933f503edc` |

As operações abaixo usam a API interna v1. Os contratos observados são instáveis e não comprovam persistência nem permissões com tokens do MCP.

| Operação | Método e endpoint v1 | Contrato e limite |
|---|---|---|
| Ganho de oportunidade | `PUT /opportunity/winOpportunity/{id}` | `cloneOpportunity=NOT_CLONE`, `createAfterSale="false"`, `afterSalePipeline/idRouter/idUser=null`; sem clonagem ou pós-venda |
| Perda de oportunidade | `PUT /opportunity/opportunityLost` | `id_opportunity`, `id_loss`, `exclusion_reason`; `cloning_opportunity`, `finishWorkflowInstances` e `reactivate_lead` falsos |
| Anotação | `POST /history/index/` | Formulário no envelope `data`; `option=comment`, `message`, `receiver`, entidade e ID. Receiver é o usuário autenticado |
| Atividade | `POST /history/index/` | `option=action`, `receiver`, `action`, `data`, `final_date`, `message`, `id_pipeline_item`; sem convite ou conclusão |
| Leitura de histórico | `GET /history/index/` | Endpoint observado; `leads2b_list_history` envia `entity`, `id_entity`, `limit`, `offset` e preserva a resposta integral. Paginação nativa e cobertura total não verificadas. A releitura após mutações solicita até 25 entradas, sem comprovação automática de persistência |
| Campos personalizados | Detalhe de lead/oportunidade | Normalizador preserva `custom_columns`, além dos outros grupos; preenchimento depende da conta |

A busca v2 de customers usa `/customer?search=...`. O frontend também passa `limit` e `offset`, mas o servidor ainda não depende dessa paginação remota: a saída é recortada localmente, com cobertura explícita.

A [referência OpenAPI pública](https://developers.leads2b.dev/api/openapi) consultada nesta revisão lista pedidos, itens de pedido, endereços e imagem de produto. A [documentação de webhooks](https://developers.leads2b.dev/webhooks/) descreve eventos Won/Lost; esses eventos não fornecem o contrato de mutação. Nenhuma das duas fontes substitui validação dos contratos internos acima.

Permissões por endpoint, regras obrigatórias e efeitos sobre workflows dependem da conta. As quatro operações têm contratos experimentais, sem garantia de persistência. Ganho/perda de lead e conclusão de atividades não possuem ferramenta dedicada. Para investigar HTTP 400/500, registre ferramenta, parâmetros e retorno sanitizados.

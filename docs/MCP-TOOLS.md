# Ferramentas MCP

Referência das ferramentas do servidor. Schemas completos estão disponíveis em `tools/list`; o catálogo registrado não comprova permissão da conta nem cobertura dos dados.

## Formato de retorno

Os resultados MCP incluem `structuredContent` com dados estruturados e `content` com resumo ou mensagem de erro. Em falhas, `isError=true`. Campos de resultado:

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;
  summary?: string;
  warnings?: string[];
  source?: {
    api: "v1" | "v2" | "snippet" | "local";
    endpoint?: string;
    stability: "confirmed" | "observed" | "experimental" | "unknown";
  };
  error?: {
    status?: number;
    code?: string;
    message: string;
    endpoint?: string;
    details?: unknown;
  };
};
```

Erros HTTP preservam status, endpoint e detalhes quando disponíveis. Falhas de mutação podem incluir `writeState` e releitura; confira a seção da operação antes de repetir a chamada.

## Health

| Ferramenta | Finalidade |
|---|---|
| `leads2b_health_check` | Mostra catálogo registrado, resultado dos endpoints testados e pré-requisitos de escrita. |

O health testa somente `GET v1 /user/logged/` e `GET v2 /users` (mais `/latest` quando `includeSnippet=true`). `apis.*.endpoint`, `method` e `scope` delimitam a observação. `ok=false` em `/users` não comprova indisponibilidade de `/customer` ou `/deals`, nem exigência de administrador.

- Catálogo: `registeredTools` e seu alias de compatibilidade `availableTools`: ferramentas registradas, inclusive leituras sem token; não são permissões verificadas.
- Capacidade verificada: `verifiedCapabilities`: somente GETs bem-sucedidos nesta chamada; não armazena validações de consultas anteriores.
- Preview: `writeTools.previewTools`: todas as escritas em preview, mesmo sem tokens/usuário.
- Pré-requisitos live: `writeTools.livePrerequisitesMetTools`: escritas em live com pré-requisitos conhecidos; permissão e regras de negócio ainda não verificadas.
- Execução verificada: `writeTools.verifiedExecutionTools`: vazio; health não faz mutação. `writeTools.availableTools` é o alias dos previews ou pré-requisitos live, conforme o modo.


## Catálogos e operação

| Ferramenta | API | Endpoint |
|---|---|---|
| `leads2b_get_logged_user` | v1 | `/user/logged/` |
| `leads2b_list_users` | v2 | `/users` (não usar como cadastro de responsáveis sem conferir o escopo) |
| `leads2b_list_team_users` | v1 | `/user/all` (equipe interna) |
| `leads2b_list_pipeline_stages` | v1 | `/pipeline/pipeline_items/{pipelineId}` |
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

## Customers e leads

| Ferramenta | API | Observação |
|---|---|---|
| `leads2b_list_customers` | v1 | Lista customers via `/customer/index`; aceita `limit`, `offset`, `search` e `summaryOnly`. |
| `leads2b_find_customer` | v1/local | Filtra localmente por e-mail, telefone, documento, nome ou texto. |
| `leads2b_search_customers` | v2 | Busca por `search`; saída padrão de até 25 registros com cobertura, `limit`/`offset` locais e resposta integral opt-in. |
| `leads2b_get_customer` | v2 | Consulta `/customer/{id}`. |
| `leads2b_get_customer_v1` | v1 | Consulta `/customer/index/{id}`. |
| `leads2b_list_contacts` | v1 | Contatos vinculados a `customerId`. |
| `leads2b_get_contact` | v1 | Detalhe integral por ID. |
| `leads2b_get_opportunity` | v1 | Detalhe integral por ID, sem depender da janela de uma listagem. |
| `leads2b_get_lead_detail` | v1 | Consulta `/lead/index/{id}/defaultLead`. |

### Volume da busca v2

`search` é obrigatório. `limit` aceita 1..500 (padrão 25), `offset` é local (padrão 0). O retorno é `{customers, coverage}`, preservando todos os campos de cada registro selecionado. `coverage.fetched`, `returned`, `offset`, `limit`, `nextOffset` e `outputTruncated` descrevem o recorte da resposta recebida. `collection="unknown"`, `nativePagination="unverified"` e `transferLimited=false` deixam explícito que a cobertura da conta e a paginação nativa não foram verificadas. `nextOffset` navega somente pelos registros recebidos.

`returnAll=true` devolve `{response, coverage}` com o envelope original integral, inclusive formatos desconhecidos; não combine com `limit` ou `offset`. Um formato desconhecido na saída limitada gera erro explícito, nunca zero clientes. A busca transfere a resposta original inteira antes do recorte. Chamadas de páginas locais refazem a busca; alterações na conta podem mudar os resultados entre chamadas.

## Histórico

`leads2b_list_history` solicita `GET /history/index/` com `entity` (`LEAD` ou `OPPORTUNITY`), `id` inteiro positivo ou string numérica positiva, `limit` (1..100, padrão 25) e `offset` (inteiro não negativo, padrão 0). A ferramenta fica disponível em todos os modos de escrita e não exige habilitar a API avançada. Não cria anotação, atividade, convite ou mensagem.

O retorno é `{response, coverage}`. `response` preserva integralmente o envelope da API; `coverage.requested` informa o `limit` e o `offset` solicitados. `coverage.status="unknown"` e `reason="native_pagination_unverified"` indicam que o servidor não confirmou se a API respeita esses parâmetros nem se a página esgota o histórico. Não há `nextOffset` calculado nem interpretação de formatos desconhecidos como lista vazia. Para consultar outra página, informe o offset desejado e compare as entradas recebidas antes de concluir que a paginação avançou.

A leitura usa um endpoint interno observado, sujeito a mudanças. Não há bloqueio prévio por contexto de usuário; erros de acesso ou do servidor são preservados. As ferramentas de criação de anotação/atividade continuam sujeitas ao modo de escrita e aos seus pré-requisitos.

## Operação comercial de leads

Ferramentas de coleta e busca para automações, planilhas e relatórios.

| Ferramenta | API | Observação |
|---|---|---|
| `leads2b_scan_lead_ops` | v1/v2/local | Coleta paginada com `coverage`, `pagination` e candidatos sem excluir registros sem tracking. |
| `leads2b_find_records` | v1/v2/local | Busca por e-mail, telefone, documento, nome, empresa ou texto em customers e deals disponíveis. |
| `leads2b_list_recent_opportunities` | v2/local | Lista `/deals?entity=OPPORTUNITY` e aplica filtros locais por data, status, funil, etapa, responsável e texto. |
| `leads2b_get_record_detail` | v1/v2/local | Retorna detalhe normalizado de `CUSTOMER`, `LEAD`, `CONTACT` ou `OPPORTUNITY`; inclui atribuição quando disponível. |
| `leads2b_get_lead_ops_candidates` | v1/v2/local | Retorna candidatos com dados básicos, comerciais, atribuição, duplicidades, campos ausentes e warnings. |

### Limites da busca e das oportunidades recentes

`leads2b_find_records` e `leads2b_list_recent_opportunities` usam `fetchLimit` (1..500, padrão 100) como tamanho solicitado de página e `maxPages` (1..20, padrão 20) como orçamento de coleta por entidade de negócio. O padrão permite até 2.000 registros por entidade quando a API respeita o tamanho solicitado; uma coleção maior ou páginas menores podem deixar a cobertura parcial. A coleta termina antes do orçamento quando alcança o total informado ou uma página vazia válida; falhas, repetição de páginas e mudanças observadas na coleção impedem declarar cobertura completa.

`limit` (1..100, padrão 25) e `offset` (padrão 0) recortam somente os resultados após filtros e ordenação. Cada chamada refaz a coleta desde o início, sem snapshot atômico. O `nextOffset` em uma cobertura de deals descreve a coleta remota e não deve ser usado como offset da saída dessas ferramentas. Se a coleção ultrapassar o orçamento, a busca por texto não substitui um detalhe direto por ID nem garante encontrar o registro.

Na busca, `coverage.sources` é uma lista por entidade, com `status` e `reason`; fontes de deals também incluem `pagesFetched`, `recordsFetched`, `startOffset`, `nextOffset` quando parcial e `totalAvailable` quando informado. `coverage.status` é `partial` se qualquer fonte estiver parcial, `unknown` se houver fonte desconhecida e nenhuma parcial, ou `complete` se todas as fontes solicitadas estiverem completas. Customers sem metadados de completude ficam `unknown`; CONTACT fica `partial` por falta de busca global. Resposta de customers fora do envelope observado `data.customers` gera falha da fonte. Os demais resultados válidos são preservados.

Nas oportunidades recentes, `coverage` descreve o scan de OPPORTUNITY. Filtros por criação não alteram a ordenação: cada registro usa primeiro atualização, depois criação, depois próxima ação, em ordem decrescente. Com cobertura parcial, a ordenação vale somente entre os registros coletados. Zero correspondências com cobertura `partial` ou `unknown` não comprova ausência na conta.

Schema resumido de candidato:

```ts
type LeadOpsCandidate = {
  technicalId: string;
  primaryEntity: { id?: string; type: "CUSTOMER" | "LEAD" | "CONTACT" | "OPPORTUNITY" };
  lead: { name?: string; company?: string; email?: string; phone?: string; document?: string };
  commercial: {
    operationalOrigin?: string;
    pipeline?: string;
    stage?: string;
    status?: string;
    responsible?: string;
    value?: number;
    lossReason?: string;
    dates: Record<string, string | undefined>;
    customFields?: Record<string, unknown>;
  };
  attribution: {
    firstTouchObserved?: unknown;
    lastTouchObserved?: unknown;
    lastConversion?: unknown;
    conversionPage?: string;
    utms: Record<string, string | undefined>;
    clickIds: Record<string, string | undefined>;
  };
  duplicateSignals: Array<{ field: string; value: string; recordTechnicalIds: string[] }>;
  missingFields: string[];
  warnings: string[];
};
```

Observações:

- Contatos possuem detalhe direto e listagem por customer; a busca global de contatos ainda não foi implementada.
- Filtros de oportunidade são locais sobre a janela buscada por `fetchLimit` e `maxPages`. O parâmetro remoto `search` foi ignorado pela API nos testes; confirme os filtros locais.
- `Origem`/`origin_name` é tratada como origem operacional/cadastral. Atribuição de marketing vem de conversões/tracking, UTMs, click IDs, host e referrer.

## Atribuição

| Ferramenta | API | Observação |
|---|---|---|
| `leads2b_get_conversions` | v2 | Exige `id` e `entity`. |
| `leads2b_get_tracking` | v2 | Exige `id` e `entity`. |
| `leads2b_normalize_source` | local | Classifica origem por UTMs, click IDs, referrer e host. |
| `leads2b_find_attribution_candidates` | v1/v2/local | Cruza customers v1 com eventos v2 para descobrir IDs úteis. |
| `leads2b_diagnose_attribution` | v2/local | Calcula first touch observado, last touch observado e divergências. |
| `leads2b_diagnose_customer_attribution` | v1/v2/local | Busca customer e diagnostica atribuição em uma chamada. |
| `leads2b_diagnose_records_attribution` | v1/v2/local | Diagnóstico em lote por `records`, `ids` + `entity`, ou `searches`; falhas ficam por registro. |

`entity` deve ser `LEAD`, `CONTACT` ou `OPPORTUNITY`.

## Snippet e webhooks

| Ferramenta | API | Endpoint |
|---|---|---|
| `leads2b_list_webhooks` | v2 | `/webhooks` |
| `leads2b_get_snippet_config` | v2 | `/integrations/config/token` |
| `leads2b_get_snippet_script` | v2 | `/integrations/config/script` |

## Coleta para automações

`leads2b_scan_lead_ops` recebe `entities`, `createdFrom`, `createdTo`, `pageSize` (1–500), `maxPages` (1–20; padrão 5), `limit` (1–500; padrão 100), `offset` e `includeAttribution`.

- `coverage.sources`: limite de páginas, falhas, repetição de páginas, mudanças na coleção e totais observados. Customers v1 não comprovam completude e ficam como `unknown`.
- `pagination`: janela da saída, `matchedTotal`, `returned` e `nextOffset`. Paginar a saída refaz a coleta; não é snapshot atômico.
- `createdFrom`/`createdTo`: timestamps ISO respeitam o fuso explícito. Timestamp da API sem fuso é interpretado como UTC-03, observado em testes controlados, independentemente do computador. Data isolada usa início/fim do dia UTC; para um dia local, informe ambos os limites com o offset desejado.
- A v2 também foi observada rotulando horário local com `Z`. O padrão respeita offsets explícitos recebidos; quando a conta comprovar essa rotulagem incorreta, `apiTimestampOffset="-03:00"` corrige a interpretação no filtro sem modificar dados brutos. A opção não altera eventos de atribuição.
- Atribuição ausente não elimina o candidato. Erro de uma fonte produz cobertura parcial, não a conclusão “nenhum lead”.

## Escrita

`disabled` não registra ferramentas; `preview` retorna plano; `live` envia a operação. Exclusão requer `confirm_destructive=true`. Todas as ferramentas abaixo usam a API interna v1 e schemas explícitos, sem aceitar campos desconhecidos fora de `parameters` e `custom_fields`.

| Entidade | Criar | Editar | Excluir |
|---|---|---|---|
| Empresa/pessoa | `leads2b_create_customer` | `leads2b_update_customer` | `leads2b_delete_customer` |
| Contato | `leads2b_create_contact` | `leads2b_update_contact` | `leads2b_delete_contact` |
| Lead | `leads2b_create_lead` | `leads2b_update_lead` | `leads2b_delete_lead` |
| Oportunidade | `leads2b_create_opportunity` | `leads2b_update_opportunity` | `leads2b_delete_opportunity` |

Entrada de criação: `{fields: {...}}`. Edição: `{id, fields: {...}}`. Exclusão: `{id, confirm_destructive: true}`. IDs devem ser inteiros positivos ou strings numéricas positivas.

| Criação | Campos obrigatórios |
|---|---|
| Customer | `name`, `type` (`PERSON` ou `ORGANIZATION`) |
| Contato | `name`, `id_customer` |
| Lead/oportunidade | `name_contact`, `id_pipeline`, `id_pipeline_item`, `id_user` |

A conta pode exigir campos customizados adicionais. Consulte equipe, pipelines, etapas e colunas antes de criar. Não invente IDs. O esquema completo aparece em `tools/list` e em `src/crud/schemas.ts`.

Em leads, `email`/`phone` são copiados para `email_contact`/`phone_contact` quando estes não forem fornecidos, pois a criação usa os campos de contato. Para nome do negócio, use `parameters.deal_name` em lead ou `parameters.op_name` em oportunidade. Na edição de lead, `name` refere-se ao contato; na oportunidade, `description` edita a descrição. Para adicionar uma anotação ao histórico, use `leads2b_create_note`. O envio de objetos deve preservar chaves existentes quando a intenção for alterar somente uma delas.

A edição de leads/oportunidades usa `PUT /deal/index` com `{deal: {id, type}, edit_data: fields}`. As antigas rotas de edição não persistiram todos os campos nos testes. Criações/edições de customers v2 presumidas na 0.2.0 foram substituídas pelas rotas v1 observadas.

CRUD de negócios exige token v1 com contexto de usuário; uma chave de empresa pode consultar dados e editar customers sem atender a esse requisito. A verificação ocorre antes da mutação em `live` e não troca credenciais automaticamente.

Em sucesso, `data.result` preserva a resposta da API e `readback.status=not_performed`: releia o registro para confirmar persistência. Em erro após envio, `writeState.outcome=unknown`; havendo ID conhecido, o MCP tenta uma releitura e informa `requestedFieldsMatch`. Isso não converte uma resposta HTTP 500 em sucesso da chamada. Falha na criação sem ID requer busca antes de uma nova tentativa. Não há retry de escrita.

## Raw API

`leads2b_api_request` exige `LEADS2B_ENABLE_RAW_API=true`. Aceita `api` (`v1`/`v2`), `method`, `path`, `query`, `body` e `confirm_destructive`.

GET/OPTIONS executam diretamente. Métodos mutantes respeitam write-mode. Exclusões, bulk, merge, ganho/perda e conversões reconhecidos pelo caminho exigem confirmação extra. A classificação por caminho é uma proteção limitada, não um analisador universal da semântica de endpoints desconhecidos.

## Fora da cobertura específica

Importações em massa, merges, ganho/perda de lead, pedidos, produtos e conversões artificiais não possuem ferramentas específicas nesta versão. A ausência no MCP não significa ausência na Leads2b. A API pública tem contratos próprios, separados das APIs internas.

## Encerramento e histórico experimentais

As quatro ferramentas abaixo respeitam `disabled` (não registradas), `preview` (sem chamadas, inclusive autenticação) e `live` (uma mutação, sem retry automático). Exigem usuário v1 para execução. Seus contratos foram observados no frontend público; não foram validados em conta conectada. Consulte [proveniência e limites](API-ENDPOINTS.md#operações-experimentais).

| Ferramenta | Schema | Comportamento |
|---|---|---|
| `leads2b_win_opportunity` | `id`, `confirm_destructive?` | Ganho com confirmação extra em live, sem clonar nem criar pós-venda. |
| `leads2b_lose_opportunity` | `id`, `id_loss`, `loss_reason`, `confirm_destructive?` | Perda com motivo e confirmação extra, sem clonar, reativar lead ou terminar workflows. Consulte `leads2b_list_loss_reasons` para IDs. |
| `leads2b_create_note` | `entity: LEAD\|OPPORTUNITY`, `id`, `message`, `id_pipeline_item?` | Anotação `comment` no histórico; receiver é o usuário autenticado. |
| `leads2b_create_activity` | `entity: LEAD\|OPPORTUNITY`, `id`, `message`, `receiver`, `action`, `data`, `final_date?`, `id_pipeline_item?` | Registro `action` no histórico. Consulte `leads2b_list_actions` e equipe para os IDs. |

Datas devem ser válidas em `YYYY-MM-DD HH:mm:ss`, no horário da conta, com término igual ou posterior ao início. Não são convertidas silenciosamente. Restrições de agenda, campos obrigatórios, tipo de atividade, pipeline e permissões continuam sujeitas à API. Registrar atividade não equivale a enviar convite ou mensagem nem a declarar uma atividade concluída; estes contratos adicionais não foram implementados.

Após a chamada, `outcome=request_accepted` significa somente resposta aceita; `outcome=rejected` representa rejeição de negócio. `readback.status=fetched` acompanha dados observados, sem afirmar ganho/perda confirmado. Releitura de histórico consulta até 25 entradas da entidade; não comprova unicidade nem cobertura integral. Se houver erro da mutação, o retorno permanece erro e inclui `writeState.outcome=unknown`, `automaticRetry=false` e a releitura. Se a releitura falhar após resposta aceita, a aceitação permanece registrada com `readback.status=failed`. Confira o estado antes de repetir.

### Valores de campos personalizados

Use `leads2b_get_record_detail` por ID, com `includeAttribution=false` para uma leitura isolada e `includeRaw=true` para preservar a fonte. Lead usa `/lead/index/{id}/defaultLead`; oportunidade usa `/opportunity/index/{id}`. `customFields` preserva os grupos `parameters`, `contactParameters`, `custom_fields`, `custom_columns` e `fields` quando retornados como objetos/arrays ou JSON válido. Zero e null dentro dos grupos não são descartados. Strings opacas permanecem em raw quando solicitado. O catálogo `leads2b_get_entity_columns` descreve definições, não comprova valores preenchidos. Ausência na listagem `/deals` não comprova ausência no detalhe nem na conta.

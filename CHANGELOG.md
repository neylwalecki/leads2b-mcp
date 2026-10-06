# Changelog

Mudanças ainda não distribuídas ficam em `Unreleased`. Versões publicadas estão em [Releases](https://github.com/neylwalecki/leads2b-mcp/releases).

## [Unreleased]

### Adicionado

- Ferramentas experimentais para marcar oportunidades como ganhas ou perdidas com motivo, criar anotações e registrar atividades no histórico.
- Releitura após as novas mutações, com solicitação aceita, rejeição e resultado incerto distinguidos. Ganho/perda exigem confirmação extra.
- Preservação de `custom_columns` nos detalhes normalizados, incluindo JSON, arrays, zero e null.
- Validação do manifesto MCPB 0.3 por schema oficial e geração ZIP com `fflate`.
- Testes de manifesto, filtros, permissões, links e preservação de arquivos existentes.

### Alterado

- Health check separa catálogo registrado, endpoints testados, pré-visualização e requisitos de execução. Falha em `/users` não omite outras ferramentas v2.
- Busca de customers retorna até 25 registros por padrão, com `limit`/`offset` locais e cobertura explícita. `returnAll=true` preserva a resposta integral.
- CI verifica o audit completo, incluindo dependências de desenvolvimento.
- Guias de instalação, configuração, ferramentas e contribuição atualizados; cobertura e empacotamento documentados separadamente.
- Pacote MCPB inclui o guia de contribuição referenciado pela documentação.

### Segurança

- Atualizado `@modelcontextprotocol/sdk` para 1.31.0, com correção de [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h).
- Atualizados `fast-uri`, `ip-address`, `proxy-addr` e `source-map-js` no lockfile.
- Removida a cadeia de desenvolvimento `@anthropic-ai/mcpb`/`node-forge` e o override de `tmp`.

### Migração

`availableTools` do health check representa o catálogo registrado. Use `verifiedCapabilities` para os GETs testados e `writeTools.livePrerequisitesMetTools` para requisitos conhecidos, sem inferir permissão de escrita. `writeTools.previewTools` independe de tokens ou contexto de usuário.

`leads2b_search_customers` retorna `{customers, coverage}`. Para a resposta original, use `returnAll=true`, que retorna `{response, coverage}`; não combine com `limit`/`offset`. O recorte local não reduz a transferência original e chamadas de páginas refazem a consulta, sem snapshot atômico.

## 0.3.0 (pré-release) - 2026-09-08

- Pacote `.mcpb` com tokens sensíveis, leitura por padrão e dependências de produção; instruções de Claude Desktop e PowerShell.
- Node >=22, lockfile atualizado e matriz CI Linux/Windows com Node 22/24. Override de `tmp` para versão corrigida usada pelo empacotador de desenvolvimento.
- HTTP com timeout, cancelamento e retries limitados somente de leitura; mutações nunca são repetidas automaticamente.
- Coleta `/deals` com paginação e cobertura explícita, interpretação explícita de fuso e limite final ISO respeitado.
- Entrada pública `leads2b-mcp/lead-ops`, tipos e `leads2b_scan_lead_ops`, preservando registros sem tracking.
- CRUD básico de customers, contatos, leads e oportunidades com schemas, preview e confirmação de exclusão.
- Autenticação com contexto de usuário para negócios; erro de escrita acompanhado de releitura quando há ID conhecido.
- Detalhes diretos de contato/oportunidade, equipe interna e etapas de pipeline; correção de envelopes de lead, parâmetros JSON e valores decimais da API.
- Documentação consolidada e exclusão de pesquisa privada do Git/pacote.

### Migração

Customer create/update agora usa a API v1 observada. Criação exige `fields.type` (`PERSON` ou `ORGANIZATION`); campos arbitrários de escrita não são mais aceitos. Métodos experimentais `Leads2bV2Client.createCustomer/updateCustomer` foram removidos. Caminhos legados de leitura em `dist/*` continuam disponíveis; a migração de automações instaladas é manual.

Tokens v1 de empresa podem continuar válidos para leitura/customers sem permitir CRUD de negócios. Configure token v1 com contexto de usuário somente no ambiente que for operar esses negócios.


## 0.2.0

- Replaced per-call dry-run write gating with `LEADS2B_WRITE_MODE=disabled|preview|live`.
- Added experimental `leads2b_create_customer`.
- Simplified `leads2b_update_customer` for direct live updates when write mode is `live`.
- Added advanced `leads2b_api_request` behind `LEADS2B_ENABLE_RAW_API=true`.
- Documented current CRUD confidence for customers, leads, opportunities, contacts, and activities.

## 0.1.0

- Added MCP `stdio` server for Leads2b.
- Added separate HTTP clients for API v1 and API v2.
- Added read-only tools for users, origins, pipelines, forms, columns, customers, webhooks, snippet config, conversions, tracking, dashboard counts, tags, actions, campaigns, flows, segmentations, calendar events, CNAEs, and Receita/CNPJ lookup.
- Added local customer search, attribution candidate discovery, source normalization, and attribution diagnosis.
- Added opt-in experimental write tool `leads2b_update_customer` with dry-run default, live confirmation, and required reason.
- Added unit tests, MCP stdio smoke tests, and opt-in live integration tests.

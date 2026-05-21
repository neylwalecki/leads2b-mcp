# Leads2b MCP

Servidor MCP comunitário e não oficial para consultar e diagnosticar dados da Leads2b por API.

O MVP é read-only e ajuda a investigar origens, conversões, tracking, pipelines, usuários, formulários, customers e configuração do snippet sem depender da interface web.

> Status: MVP read-only implementado. A API da Leads2b tem partes documentadas e partes descobertas empiricamente. Este projeto trata contratos não documentados como instáveis.

Este projeto não é afiliado, endossado ou mantido pela Leads2b.

## Recursos

- Ferramentas MCP read-only para uso em clientes compatíveis.
- Clientes HTTP separados para API v1 e API v2.
- Consulta de usuários, origens, pipelines, formulários, colunas, customers, webhooks e snippet.
- Consulta de conversões e tracking por `id` e `entity`.
- Busca local de customers para descobrir IDs candidatos.
- Diagnóstico de atribuição com first touch observado, last touch observado e divergências.
- Normalização local de origem com UTMs, click IDs, referrer e host.
- Testes unitários com fixtures fictícias/de exemplo.

## Documentação Principal

- [Roadmap](docs/ROADMAP.md)
- [Endpoints da API](docs/API-ENDPOINTS.md)
- [Ferramentas MCP](docs/MCP-TOOLS.md)
- [Atribuição e origem](docs/ATRIBUICAO-E-ORIGEM.md)

## Bases

```txt
API v1: https://app.leads2b.com/api/v1
API v2: https://app.leads2b.com/api/v2
Snippet worker: https://js.app.leads2b.com
```

Autenticação para as APIs privadas:

```http
Authorization: Bearer <LEADS2B_TOKEN>
Accept: application/json
```

## Instalação Local

```bash
npm install
cp .env.example .env
npm run build
```

Preencha `.env` com os tokens da sua conta:

```txt
LEADS2B_API_V1_TOKEN=
LEADS2B_API_V2_TOKEN=
LEADS2B_API_V1_BASE_URL=https://app.leads2b.com/api/v1
LEADS2B_API_V2_BASE_URL=https://app.leads2b.com/api/v2
LEADS2B_PUBLIC_WORKER_URL=https://js.app.leads2b.com
```

## Uso

Desenvolvimento:

```bash
npm run dev
```

Build:

```bash
npm run build
npm start
```

Configuração MCP `stdio` usando o build local:

```json
{
  "mcpServers": {
    "leads2b": {
      "command": "node",
      "args": ["/caminho/para/leads2b-mcp/dist/index.js"],
      "cwd": "/caminho/para/leads2b-mcp"
    }
  }
}
```

Também é possível passar os tokens diretamente na configuração do cliente MCP, sem depender de `.env`:

```json
{
  "mcpServers": {
    "leads2b": {
      "command": "node",
      "args": ["/caminho/para/leads2b-mcp/dist/index.js"],
      "env": {
        "LEADS2B_API_V1_TOKEN": "<SEU_TOKEN_V1>",
        "LEADS2B_API_V2_TOKEN": "<SEU_TOKEN_V2>"
      }
    }
  }
}
```

Exemplos prontos:

- [Configuração MCP genérica](examples/mcp-config.local.json)
- [Configuração para Codex](examples/codex-config.toml)

## Ferramentas do MVP

| Ferramenta | API | Finalidade |
|---|---|---|
| `leads2b_health_check` | v1/v2/snippet | Validar tokens, bases e disponibilidade. |
| `leads2b_get_logged_user` | v1 | Consultar usuário autenticado. |
| `leads2b_list_origins` | v1 | Listar origens cadastrais. |
| `leads2b_list_pipelines` | v1 | Listar pipelines ativos. |
| `leads2b_list_forms` | v1 | Listar formulários. |
| `leads2b_get_lead_columns` | v1 | Listar colunas/campos de lead. |
| `leads2b_list_customers` | v1 | Listar clientes e obter IDs candidatos. |
| `leads2b_find_customer` | v1/local | Buscar customer por e-mail, telefone, documento, nome ou texto. |
| `leads2b_search_customers` | v2 | Buscar customers com filtro server-side. |
| `leads2b_get_customer` | v2 | Consultar detalhe de customer por ID. |
| `leads2b_get_lead_detail` | v1 | Consultar detalhe de lead por ID. |
| `leads2b_list_users` | v2 | Listar usuários. |
| `leads2b_list_webhooks` | v2 | Listar webhooks. |
| `leads2b_get_snippet_config` | v2 | Consultar configuração/token público do snippet. |
| `leads2b_get_snippet_script` | v2 | Consultar script oficial do snippet. |
| `leads2b_get_conversions` | v2 | Consultar conversões por `id` e `entity`. |
| `leads2b_get_tracking` | v2 | Consultar tracking por `id` e `entity`. |
| `leads2b_find_attribution_candidates` | v1/v2 | Cruzar customers v1 com eventos v2 para achar IDs úteis. |
| `leads2b_normalize_source` | local | Normalizar origem com UTMs/click IDs/referrer. |
| `leads2b_diagnose_attribution` | v2/local | Calcular first touch observado, last touch observado e divergências. |
| `leads2b_diagnose_customer_attribution` | v1/v2/local | Buscar customer e diagnosticar eventos v2 em um só passo. |

`leads2b_list_customers` sem opções retorna a resposta integral da API. Para reduzir volume no uso interativo, a ferramenta aceita filtros locais:

```ts
{
  limit?: number;
  offset?: number;
  search?: string;
  summaryOnly?: boolean;
}
```

`leads2b_find_customer` usa o mesmo endpoint v1 e filtra localmente:

```ts
{
  search?: string;
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
  limit?: number;
  offset?: number;
  summaryOnly?: boolean;
}
```

Depois de encontrar um `customerId`, use `leads2b_get_conversions`, `leads2b_get_tracking`, `leads2b_find_attribution_candidates` ou `leads2b_diagnose_attribution` com a entidade adequada.

Para busca server-side, use `leads2b_search_customers`:

```ts
{
  search: string;
}
```

Para detalhe por ID, use `leads2b_get_customer` ou `leads2b_get_lead_detail`:

```ts
{
  id: string | number;
}
```

Para ir direto de um dado do lead/customer para o diagnóstico, use `leads2b_diagnose_customer_attribution`:

```ts
{
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
  search?: string;
  entities?: Array<"LEAD" | "CONTACT" | "OPPORTUNITY">;
  customerLimit?: number;
  includeRaw?: boolean;
}
```

## Testes

Testes unitários, sem chamadas externas:

```bash
npm test
```

Smoke MCP via `stdio`, sem chamadas externas:

```bash
npm run test:mcp
```

Typecheck:

```bash
npm run typecheck
```

Testes de integração read-only são opt-in e exigem `.env` configurado:

```bash
RUN_LEADS2B_INTEGRATION_TESTS=true npm run test:integration
```

## Stack

- TypeScript + Node.js.
- MCP SDK oficial.
- Transporte `stdio` no MVP.
- `zod` para schemas de entrada e saída.
- Clientes HTTP separados para API v1 e API v2.
- Testes unitários com fixtures fictícias/de exemplo.

Estrutura atual:

```txt
src/
  index.ts
  config.ts
  client/
    http.ts
    v1.ts
    v2.ts
  customers/
    list.ts
  tools/
    health.ts
    read.ts
    attribution.ts
  attribution/
    normalize.ts
    candidates.ts
```

## Aviso

Este projeto não é oficial da Leads2b. Os endpoints listados podem mudar sem aviso. Sempre valide em conta de teste ou em modo somente leitura antes de usar em produção.

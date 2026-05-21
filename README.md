# Leads2b MCP

Servidor MCP comunitário e não oficial para acessar dados da Leads2b por API.

O projeto usa o SDK oficial do MCP, transporte `stdio`, TypeScript, `zod` e clientes HTTP separados para as APIs v1 e v2 da Leads2b.

> Status: `v0.2.0`. A versão atual mantém leitura/diagnóstico como base e adiciona escrita opt-in por modo operacional.

Este projeto não é afiliado, endossado ou mantido pela Leads2b.

## Recursos

- Ferramentas MCP para consultar dados da conta autenticada.
- Suporte a APIs v1 e v2.
- Health check de tokens, bases e APIs.
- Consulta de usuários, origens, pipelines, formulários, customers, webhooks, snippet, conversões e tracking.
- Busca local e server-side de customers.
- Diagnóstico de atribuição com first touch observado, last touch observado e divergências.
- Normalização local de origem por UTMs, click IDs, referrer e host.
- Escrita por modo: `disabled`, `preview` ou `live`.
- Criação e atualização experimental de customers.
- Ferramenta avançada `leads2b_api_request` atrás de opt-in explícito.
- Testes unitários sem chamadas externas.

## Instalação

```bash
npm install
cp .env.example .env
npm run build
```

Configure os tokens da sua conta:

```txt
LEADS2B_API_V1_TOKEN=
LEADS2B_API_V2_TOKEN=
LEADS2B_API_V1_BASE_URL=https://app.leads2b.com/api/v1
LEADS2B_API_V2_BASE_URL=https://app.leads2b.com/api/v2
LEADS2B_PUBLIC_WORKER_URL=https://js.app.leads2b.com
LEADS2B_WRITE_MODE=disabled
LEADS2B_ENABLE_RAW_API=false
```

## Uso Com MCP

Configuração local usando o build:

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

Também é possível passar os tokens no cliente MCP:

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

## Ferramentas

Principais grupos:

- `leads2b_health_check`: valida configuração e disponibilidade.
- Catálogo e operação: usuários, origens, pipelines, tags, formulários, campos, campanhas, fluxos, ações, motivos de perda e contadores.
- Customers/leads: listar, buscar, obter detalhe e descobrir IDs úteis.
- Atribuição: conversões, tracking, normalização local e diagnóstico.
- Snippet/webhooks: configuração do snippet, script e webhooks.
- Escrita opt-in: `leads2b_create_customer` e `leads2b_update_customer`.
- Raw API opt-in: `leads2b_api_request`.

Veja a lista completa em [docs/MCP-TOOLS.md](docs/MCP-TOOLS.md).

## Escrita

As ferramentas de escrita ficam desabilitadas por padrão:

```txt
LEADS2B_WRITE_MODE=disabled
LEADS2B_WRITE_MODE=preview
LEADS2B_WRITE_MODE=live
```

- `disabled`: não registra ferramentas de escrita.
- `preview`: registra ferramentas e retorna o plano sem alterar dados.
- `live`: executa creates e updates simples diretamente.

Deletes e operações em lote continuam exigindo confirmação explícita quando usados via raw API.

Detalhes em [docs/WRITE-TOOLS.md](docs/WRITE-TOOLS.md).

## Testes

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run --json
```

Testes live são opt-in e exigem tokens locais:

```bash
RUN_LEADS2B_INTEGRATION_TESTS=true npm run test:integration
RUN_LEADS2B_INTEGRATION_TESTS=true npm run test:live-smoke
```

## Documentação

- [Ferramentas MCP](docs/MCP-TOOLS.md)
- [Endpoints](docs/API-ENDPOINTS.md)
- [Atribuição e origem](docs/ATRIBUICAO-E-ORIGEM.md)
- [Ferramentas de escrita](docs/WRITE-TOOLS.md)
- [Roadmap](docs/ROADMAP.md)

## Exemplos

- [Configuração MCP](examples/mcp-config.local.json)
- [Configuração com escrita opt-in](examples/mcp-config.write-tools.local.json)
- [Configuração para Codex](examples/codex-config.toml)
- [Exemplo de preview de escrita](examples/write-tools-preview.example.json)
- [Prompts de uso](examples/usage-prompts.md)

## Aviso

A API da Leads2b tem endpoints documentados e endpoints observados empiricamente. Contratos não documentados podem mudar sem aviso.

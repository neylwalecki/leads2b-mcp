# Roadmap

Este projeto começa com um servidor MCP read-only para diagnóstico de dados da Leads2b.

## Implementado no MVP

- Transporte MCP via `stdio`.
- Configuração por `.env` ou variáveis de ambiente do cliente MCP.
- Clientes HTTP separados para API v1 e API v2.
- `health_check` com status de tokens, APIs e ferramentas disponíveis.
- Ferramentas read-only para usuários, origens, pipelines, formulários, colunas, clientes, webhooks, snippet, conversões e tracking.
- Busca local de customers via `customer/index`.
- Busca server-side e detalhe de customers via API v2.
- Detalhe de lead por ID via API v1.
- Diagnóstico de atribuição com first touch observado, last touch observado e divergências.
- Normalização local de origem baseada em UTMs, click IDs, referrer e host.
- Testes unitários com fixtures fictícias/de exemplo.
- Smoke test do servidor MCP via `stdio`.

## Próximos Passos

- Descobrir endpoints confiáveis para oportunidade e contato por e-mail/ID.
- Melhorar tipagem das respostas observadas sem perder compatibilidade com campos desconhecidos.
- Expandir exemplos de uso com clientes MCP diferentes.
- Adicionar relatórios exportáveis em JSON/Markdown.

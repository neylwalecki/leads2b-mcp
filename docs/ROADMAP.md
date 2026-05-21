# Roadmap

Este projeto começa com um servidor MCP read-only para diagnóstico de dados da Leads2b.

## Implementado no MVP

- Transporte MCP via `stdio`.
- Configuração por `.env` ou variáveis de ambiente do cliente MCP.
- Clientes HTTP separados para API v1 e API v2.
- `health_check` com status de tokens, APIs e ferramentas disponíveis.
- Ferramentas read-only para usuários, origens, pipelines, formulários, colunas, clientes, webhooks, snippet, conversões e tracking.
- Ferramentas read-only para contadores de dashboard, pipelines por entidade, usuários por nível de acesso, tags, motivos de perda, ações, campanhas, fluxos, contagem de deals, tipos de customer, Receita/CNPJ, CNAEs, segmentações, contas de e-mail, feedbacks, eventos da empresa e calendário.
- Primeira ferramenta de escrita opt-in para customer, com dry-run padrão, confirmação explícita e motivo obrigatório.
- Busca local de customers via `customer/index`.
- Busca server-side e detalhe de customers via API v2.
- Detalhe de lead por ID via API v1.
- Diagnóstico de atribuição com first touch observado, last touch observado e divergências.
- Normalização local de origem baseada em UTMs, click IDs, referrer e host.
- Testes unitários com fixtures fictícias/de exemplo.
- Smoke test do servidor MCP via `stdio`.

## Próximos Passos

- Descobrir endpoints confiáveis para oportunidade e contato por e-mail/ID.
- Confirmar contrato dos endpoints de agenda v1, kanban, busca global e lead inbox com token de API.
- Validar em conta de teste o contrato live de `PATCH /api/v2/customer/{id}` antes de tratar a escrita como estável.
- Melhorar tipagem das respostas observadas sem perder compatibilidade com campos desconhecidos.
- Expandir exemplos de uso com clientes MCP diferentes.
- Adicionar relatórios exportáveis em JSON/Markdown.
- Expandir escrita somente após validar contratos em conta de teste.

# Roadmap

## Implementado

- Servidor MCP via `stdio`.
- Configuração por `.env` ou variáveis do cliente MCP.
- Clientes separados para APIs v1 e v2.
- Health check.
- Ferramentas de leitura para catálogos, customers, leads, snippet, webhooks, conversões e tracking.
- Diagnóstico de atribuição e normalização local de origem.
- Busca comercial genérica com `leads2b_find_records`.
- Listagem observada de oportunidades recentes via `/deals?entity=OPPORTUNITY`.
- Detalhe normalizado de registro e candidatos estáveis para operação diária de leads.
- Diagnóstico de atribuição em lote por IDs ou buscas.
- Escrita por modo com `LEADS2B_WRITE_MODE=disabled|preview|live`.
- Create/update experimental de customers.
- `leads2b_api_request` atrás de `LEADS2B_ENABLE_RAW_API=true`.
- Testes unitários, typecheck, build e smoke tests MCP.

## Próxima Versão

- Validar campos obrigatórios e respostas reais de `POST /customer` em ambiente controlado.
- Consolidar filtros server-side confiáveis para `/deals`.
- Encontrar endpoint direto confiável para contatos e detalhe de oportunidade.
- Consolidar CRUD de leads, oportunidades, contatos e atividades quando endpoints confiáveis forem encontrados.
- Criar ferramentas específicas para deletes somente com confirmação explícita e plano de recuperação.
- Adicionar exemplos de payloads sanitizados para create/update de customers.

## Pesquisa

- Busca direta de contatos.
- Contratos de agenda v1, kanban, busca global e lead inbox.
- Campos obrigatórios de criação/edição por entidade.
- Estratégia de snapshot/export para operações em massa.

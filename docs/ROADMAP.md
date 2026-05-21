# Roadmap

## Implementado

- Servidor MCP via `stdio`.
- Configuração por `.env` ou variáveis do cliente MCP.
- Clientes separados para APIs v1 e v2.
- Health check.
- Ferramentas read-only para catálogos, customers, leads, snippet, webhooks, conversões e tracking.
- Diagnóstico de atribuição e normalização local de origem.
- Escrita por modo com `LEADS2B_WRITE_MODE=disabled|preview|live`.
- Create/update experimental de customers.
- `leads2b_api_request` atrás de `LEADS2B_ENABLE_RAW_API=true`.
- Testes unitários, typecheck, build e smoke tests MCP.

## Próxima Versão

- Validar campos obrigatórios e respostas reais de `POST /customer` em ambiente controlado.
- Consolidar CRUD de leads, oportunidades, contatos e atividades quando endpoints confiáveis forem encontrados.
- Criar ferramentas específicas para deletes somente com confirmação explícita e plano de recuperação.
- Adicionar exemplos de payloads sanitizados para create/update de customers.

## Pesquisa

- Busca confiável por e-mail para lead, contato e oportunidade.
- Contratos de agenda v1, kanban, busca global e lead inbox.
- Campos obrigatórios de criação/edição por entidade.
- Estratégia de snapshot/export para operações em massa.

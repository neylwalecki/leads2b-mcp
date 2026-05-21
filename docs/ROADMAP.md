# Roadmap

## Implementado

- Servidor MCP via `stdio`.
- Configuração por `.env` ou variáveis do cliente MCP.
- Clientes separados para APIs v1 e v2.
- Health check.
- Ferramentas read-only para catálogos, customers, leads, snippet, webhooks, conversões e tracking.
- Diagnóstico de atribuição e normalização local de origem.
- Primeira ferramenta experimental de atualização de customer.
- Testes unitários, typecheck, build e smoke tests MCP.

## Próxima Versão

- Substituir `LEADS2B_ENABLE_WRITE_TOOLS` por `LEADS2B_WRITE_MODE=disabled|preview|live`.
- Simplificar `update_customer` para uso direto em modo `live`.
- Implementar CRUD de customers.
- Mapear e validar CRUD de leads, oportunidades, contatos e atividades.
- Adicionar `leads2b_api_request` para usuários avançados.
- Manter confirmações fortes apenas para delete, bulk e operações destrutivas.

## Pesquisa

- Busca confiável por e-mail para lead, contato e oportunidade.
- Contratos de agenda v1, kanban, busca global e lead inbox.
- Campos obrigatórios de criação/edição por entidade.
- Estratégia de snapshot/export para operações em massa.

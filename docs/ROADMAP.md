# Cobertura e evolução

O servidor concentra-se em consultas, atribuição e operações de CRM com schemas explícitos. A [referência de ferramentas](MCP-TOOLS.md) descreve o comportamento implementado; o [changelog](../CHANGELOG.md) registra mudanças e migrações.

## Cobertura atual

- Consultas e CRUD de customers, contatos, leads e oportunidades.
- Coleta paginada de negócios, filtros locais e cobertura da saída.
- Normalização de origem e diagnóstico de atribuição.
- Health check com catálogo, endpoints testados e requisitos de escrita separados.
- Ganho/perda de oportunidades, anotações e atividades com contratos experimentais.
- Campos personalizados preservados nos detalhes quando retornados pela API.
- Distribuição por MCPB e instalação manual em clientes STDIO.

## Áreas para contribuição

| Área | Limite atual |
|---|---|
| Paginação remota de customers | A saída usa recorte local; a semântica remota precisa de validação |
| Contatos | Há detalhe e listagem por customer; não há busca global dedicada |
| Histórico | Há criação de anotações/atividades e releitura limitada; não há conclusão de atividade ou envio de convite |
| Encerramento de leads | Ganho/perda estão implementados somente para oportunidades |
| Operações em lote e merges | Não há ferramentas dedicadas |
| Transporte remoto | O servidor oferece somente STDIO |

Essas áreas não representam compromisso de prazo ou implementação. Propostas devem incluir o contrato da API, exemplos sanitizados e testes sem alterações em contas reais. Consulte o [guia de contribuição](../CONTRIBUTING.md).

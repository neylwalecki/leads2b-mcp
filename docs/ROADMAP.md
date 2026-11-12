# Cobertura e evolução

O servidor concentra-se em consultas, atribuição e operações de CRM com schemas explícitos. A [referência de ferramentas](MCP-TOOLS.md) descreve o comportamento implementado; o [changelog](../CHANGELOG.md) registra mudanças e migrações.

## Cobertura atual

- Consultas e CRUD de customers, contatos, leads e oportunidades.
- Coleta paginada de negócios, filtros locais e cobertura da saída.
- Busca de registros com cobertura por fonte e leitura de páginas do histórico com parâmetros enviados à API.
- Leitura de chats por oportunidade, detalhe de chat, mensagens paginadas, histórico filtrável e atividades por entidade, com vínculo e cobertura explícitos.
- Normalização de origem e diagnóstico de atribuição.
- Health check com catálogo, endpoints testados e requisitos de escrita separados.
- Ganho/perda de oportunidades, anotações e atividades com contratos experimentais.
- Campos personalizados preservados nos detalhes quando retornados pela API.
- Distribuição por MCPB e instalação manual em clientes STDIO.

[Matriz por prioridade, ferramenta e evidência](COVERAGE-MATRIX.md).

## Áreas para contribuição

| Área | Limite atual |
|---|---|
| Paginação remota de customers | A saída usa recorte local; a semântica remota precisa de validação |
| Contatos | Há detalhe e listagem por customer; não há busca global dedicada |
| Histórico e resumo comercial | Piloto de gravação em conta de teste. Cobertura total do histórico V1 e unicidade global ainda precisam de verificação |
| Mídia e transcrição | A leitura preserva os metadados existentes e sinaliza áudio identificado sem texto. Download e transcrição nova exigem escopo próprio |
| Atividades e conversas | Reagendamento, conclusão e remoção de atividade, envio, reação, atribuição, exclusão e agendamento de chat aguardam evidência por transição |
| Caixas, relatórios e prospecção | Confirmar paginação e filtros dos POSTs de consulta em recortes maiores, filtros de relatórios dinâmicos e permissões e consumo de leituras de prospecção |
| Encerramento de leads | Ganho/perda estão implementados somente para oportunidades |
| Operações em lote e merges | Não há ferramentas dedicadas |
| Transporte remoto | O servidor oferece somente STDIO |

Essas áreas não representam compromisso de prazo ou implementação. Propostas devem incluir o contrato da API, exemplos sanitizados e testes sem alterações em contas reais. Consulte o [guia de contribuição](../CONTRIBUTING.md).

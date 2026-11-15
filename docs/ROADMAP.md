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
| Histórico e resumo comercial | Gravação de nota e atividade confirmada em pilotos sintéticos. Cobertura total do histórico V1 e unicidade global ainda precisam de verificação |
| Mídia e transcrição | A leitura por ID encontra o áudio e indica a presença de transcrição. Download e geração de transcrição permanecem pendentes |
| Atividades e conversas | Tentativa, encerramento sem objetivo e exclusão confirmados em atividades sintéticas. Operações de chat têm testes locais e aguardam canal e destinatário de teste. Leitura positiva de participantes depende de permissão |
| Caixas, relatórios e prospecção | O Relatório de ações aceita intervalo. Filtros adicionais, paginação com amostras preenchidas e permissões de prospecção precisam de validação |
| Encerramento de leads | Ganho/perda estão implementados somente para oportunidades |
| Operações em lote e merges | Não há ferramentas dedicadas |
| Transporte remoto | O servidor oferece somente STDIO |

Essas áreas não representam compromisso de prazo ou implementação. Propostas devem incluir o contrato da API, exemplos sanitizados e testes sem alterações em contas reais. Consulte o [guia de contribuição](../CONTRIBUTING.md).

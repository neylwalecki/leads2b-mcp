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

## Áreas para contribuição

| Área | Limite atual |
|---|---|
| Paginação remota de customers | A saída usa recorte local; a semântica remota precisa de validação |
| Contatos | Há detalhe e listagem por customer; não há busca global dedicada |
| Histórico e resumo comercial | Há leitura de histórico com filtros, atividades por entidade, chats por oportunidade e mensagens paginadas. Paginação nativa e cobertura total continuam não verificadas. A escolha entre nota e atividade é explícita; não há conclusão de atividade, convite, envio de WhatsApp, mudança de etapa ou ganho/perda no fluxo |
| Mídia e transcrição | Metadados, payloads e transcrições já retornados pelas mensagens são preservados no P0. Download de arquivo e transcrição nova não fazem parte desta fatia; validação de histórico entre sessões fica no backlog P1 |
| Conversas e canais | Envio, reação, atribuição, exclusão, upload e agendamento de chat não fazem parte da cobertura. Diagnóstico de canais e fila de conversas é P1 |
| Jornadas e agentes | Leitura contextual de jornadas, agentes e insights é P2, condicionada a caso de uso e vínculo verificável |
| Relatórios e módulos nativos | Painéis, relatórios, formulários, landing pages, prospecção, e-mail, arquivos e orçamentos ficam em P3 até existir decisão operacional concreta |
| Encerramento de leads | Ganho/perda estão implementados somente para oportunidades |
| Operações em lote e merges | Não há ferramentas dedicadas |
| Transporte remoto | O servidor oferece somente STDIO |

Essas áreas não representam compromisso de prazo ou implementação. Propostas devem incluir o contrato da API, exemplos sanitizados e testes sem alterações em contas reais. Consulte o [guia de contribuição](../CONTRIBUTING.md).

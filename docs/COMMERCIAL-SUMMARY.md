# Fluxo de resumo comercial

Este fluxo reúne contexto de uma oportunidade para que um cliente MCP prepare um resumo comercial verificável. Ele usa somente leituras na primeira etapa e separa a escolha de registrar uma nota da escolha de planejar uma atividade.

## Sequência de leitura

1. Consulte as conversas vinculadas à oportunidade com a ferramenta de listagem de chats. Informe a entidade e o ID da oportunidade. A consulta deve permanecer limitada a esse par, sem agrupar conversas por telefone ou por outro dado de contato.
2. Para cada chat candidato, consulte o detalhe com `chatId` e `entityId` obrigatórios e confirme o vínculo com a mesma entidade e oportunidade. Descarte um chat cujo detalhe não confirme o contexto. Quando houver mais de um chat, mantenha cada conversa separada.
3. Consulte as mensagens do chat com `chatId` e `entityId`. A ferramenta relê e valida o detalhe antes da primeira página, preserva cada envelope, remove duplicidades técnicas, detecta repetição e verifica a ordem dos timestamps. Preserve os campos brutos, incluindo ID, timestamp, direção, texto, mídia, payload, transcrição e texto de transcrição quando retornados. `coverage.status="complete"` exige offset inicial zero, ordem verificável e página vazia; uma coleta `partial` não comprova o fim da lista.
4. Consulte `leads2b_list_history` para a mesma entidade e oportunidade. Use filtros de tipo quando precisar distinguir comentários, ações ou tracking e use `unfinished` para procurar pendências. `pinned` pode ser usado para contexto marcado. Preserve a resposta integral e a cobertura informada.
5. Consulte a ferramenta de atividades da oportunidade para conferir ações planejadas. Para escolher um responsável, consulte o catálogo de responsáveis ativos do funil e valide o usuário no contexto do negócio. Não trate um ID de usuário disponível em outro funil como elegível.

O cliente pode então redigir uma prévia com fontes, datas, lacunas e próximos passos. A prévia não cria registro, agenda evento, envia WhatsApp, altera etapa e não marca ganho ou perda.

O fluxo completo com dados sintéticos está em [`examples/commercial-summary-preview.mjs`](../examples/commercial-summary-preview.mjs). Execute `npm run build && node examples/commercial-summary-preview.mjs`; o exemplo usa transporte em memória, bloqueia métodos diferentes de `GET`, não carrega `.env` e demonstra `preview` sem enviar mutações.

Se o checkout também atender um MCP ativo, preserve o `dist/` habitual e execute a demonstração com um build isolado:

```sh
npm run build -- --outDir .internal/p0-validation/dist
mkdir -p .internal/p0-validation/examples
cp examples/commercial-summary-preview.mjs .internal/p0-validation/examples/commercial-summary-preview.mjs
node .internal/p0-validation/examples/commercial-summary-preview.mjs
```

## Escolha de gravação

Apresente ao operador uma escolha explícita:

- `leads2b_create_note`: registra o resumo como comentário no histórico. O texto deve ser enviado integralmente, sem reescrita silenciosa. O usuário autenticado em v1 é o responsável pela nota.
- `leads2b_create_activity`: registra uma ação planejada com mensagem, responsável, tipo e data. O texto também deve ser preservado integralmente. Consulte primeiro os catálogos de usuário e ação. O contrato de criação não inclui um campo de assunto comprovado; `action_type_label` foi observado em atualização e não deve ser enviado por esta ferramenta sem evidência própria.

As duas operações respeitam `LEADS2B_WRITE_MODE`. Em `disabled`, as ferramentas não são registradas. Em `preview`, retornam apenas o plano, sem consulta ao usuário ou ao histórico. Em `live`, o MCP primeiro lê até 100 entradas do histórico, e também as atividades quando a operação é uma ação. Envelope ilegível ou possível duplicidade por texto e campos bloqueia o POST com `outcome=not_sent`. Se a pré-leitura for válida, uma única chamada pode ser enviada, sem retry automático. A resposta HTTP aceita não comprova persistência.

Depois de uma gravação em `live`, releia até 100 entradas do histórico e, para atividade, a lista de atividades. `verification.status="observed"` só é emitido quando o ID retornado corresponde a uma ocorrência única no recorte, entidade, ID da oportunidade, texto integral e campos pertinentes conferem e a atividade aparece como pendente. A unicidade global permanece `unverified`, pois a paginação v1 não foi validada. Envelopes desconhecidos ficam `unconfirmed`. Uma releitura ausente ou ambígua exige conciliação antes de qualquer nova chamada. Não repita automaticamente uma mutação que possa ter sido aceita.

## Piloto separado

Uma gravação real exige autorização anterior para uma conta de teste, uma oportunidade descartável, a operação única, o usuário, o tipo e a data. Use um marcador sintético, execute uma única nota ou uma única atividade e confira a ocorrência no GET e na UI. O piloto não deve criar convite ou evento de agenda, enviar mensagem, alterar etapa ou fechar a oportunidade.

A conta de produção permanece somente leitura durante a implementação e os testes locais. A leitura da fila ou de um histórico não autoriza nem comprova criação.

## Lacunas e backlog

### P0 entregue neste fluxo

- Chats por entidade e oportunidade, detalhe do chat e mensagens paginadas, com vínculo explícito e preservação de metadados.
- Campos de mídia, payload e transcrição que já vierem nas mensagens são preservados no retorno, sem download ou transcrição nova.
- Histórico filtrável por tipo e estado de pendência, além da leitura de atividades por oportunidade.
- Catálogos de ações e responsáveis ativos para conferência antes de uma atividade.
- Escolha explícita entre nota e atividade, com write-mode e releitura conservadora.

### P1

- Validar histórico entre sessões de um chat quando houver caso não vazio e vínculo inequívoco.
- Investigar canais e fila de conversas somente leitura, sem expor links de autenticação.
- Validar fila de atividades e agenda com filtros e cobertura próprios, mantendo atividade do CRM separada de evento de calendário.
- Isolar reagendamento, conclusão e remoção de atividades em contratos próprios, sem generalizar edição para todo histórico.

### P2

- Diagnosticar jornadas, agentes e insights por oportunidade após o piloto de resumo.

### P3

- Relatórios, painéis, formulários, landing pages, prospecção, segmentações, e-mail e módulos de arquivos somente quando houver uma decisão operacional concreta.
- Qualquer ação de envio, reação, atribuição, exclusão ou agendamento de chat exige escopo e validação separados.

Rotas internas observadas são experimentais. O fluxo não replica o aplicativo e não cria um orquestrador de IA.

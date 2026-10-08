# Exemplos de uso

Use estes prompts em um cliente MCP com o servidor configurado. IDs, nomes e datas dos exemplos são fictícios; substitua-os pelos valores do registro desejado. Os exemplos de escrita exigem `LEADS2B_WRITE_MODE=preview` e não enviam alterações.

## Conferir a conexão

```text
Execute leads2b_health_check. Resuma os endpoints testados, o contexto de usuário
v1 e o modo de escrita. Distinga ferramentas registradas de permissões verificadas.
Não exiba tokens.
```

## Buscar clientes

```text
Use leads2b_search_customers com search="lead@example.com" e limit=25.
Informe os resultados e a cobertura retornada. Se não houver resultado,
consulte leads2b_find_customer com search="lead@example.com" e summaryOnly=true.
```

## Buscar negócios além da primeira página

```text
Busque o ID 123 com leads2b_find_records, search="123", entities=["OPPORTUNITY"],
maxPages=20 e limit=5. Informe matchedTotal, totalScanned e coverage.
Se a cobertura estiver partial ou unknown, não conclua que o registro inexiste.
Para o detalhe por ID, use leads2b_get_record_detail com entity="OPPORTUNITY",
id=123 e includeAttribution=false. Preserve eventuais erros sem presumir sua causa.
```

## Ler o histórico

```text
Use leads2b_list_history com entity="OPPORTUNITY", id=123, limit=25 e offset=0.
Preserve o envelope retornado e informe coverage. Se precisar de outra página,
solicite offset=25 e compare os IDs das entradas. Pare se a resposta repetir
a página anterior. Não presuma cobertura completa nem crie anotação ou atividade.
```

## Ler campos personalizados

```text
Use leads2b_get_record_detail com entity="OPPORTUNITY", id=123,
includeAttribution=false e includeRaw=true. Mostre os campos personalizados
retornados, distinguindo valores ausentes de zero e null.
```

## Diagnosticar atribuição

```text
Busque lead@example.com com leads2b_find_records. Identifique o ID e a entidade
corretos antes de chamar leads2b_diagnose_attribution. Explique first touch,
last touch e divergências usando somente os eventos retornados.
```

## Consultar agenda

```text
Use leads2b_list_calendar_events para a semana desejada, com início e fim
explícitos, calendars=["leads2b"] e types=["action", "meet"]. Agrupe os eventos
por tipo e responsável.
```

## Contar negócios

```text
Use leads2b_list_pipelines_by_entity com entity="OPPORTUNITY". Identifique
o pipeline desejado e chame leads2b_count_deals com pipelineId e status="lost".
Informe eventuais erros sem atribuir causas que o retorno não demonstre.
```

## Planejar atualização de customer

Ferramenta `leads2b_update_customer`:

```json
{"id":123,"fields":{"name":"Example"}}
```

## Planejar ganho de oportunidade

Ferramenta `leads2b_win_opportunity`:

```json
{"id":123}
```

Em `live`, ganho e perda exigem `confirm_destructive=true`.

## Planejar perda com motivo

Consulte `leads2b_list_loss_reasons` para identificar o motivo. Ferramenta `leads2b_lose_opportunity`:

```json
{"id":123,"id_loss":2,"loss_reason":"Example reason"}
```

## Planejar anotação

Ferramenta `leads2b_create_note`:

```json
{"entity":"OPPORTUNITY","id":123,"message":"Example note"}
```

O responsável pela anotação é o usuário autenticado na execução.

## Planejar atividade

Consulte `leads2b_list_team_users` e `leads2b_list_actions` para os IDs. Datas usam o horário da conta, no formato `YYYY-MM-DD HH:mm:ss`. Ferramenta `leads2b_create_activity`:

```json
{"entity":"OPPORTUNITY","id":123,"message":"Example activity","receiver":7,"action":2,"data":"2026-10-06 14:00:00","final_date":"2026-10-06 14:30:00"}
```

Registrar atividade no histórico não envia convite ou mensagem nem marca a atividade como concluída.

## Consultar a API avançada

Exige `LEADS2B_ENABLE_RAW_API=true`. Não é necessário habilitar esse recurso para usar as ferramentas dedicadas.

```text
Chame leads2b_api_request com api="v2", method="OPTIONS" e path="/customer".
Resuma o status sem exibir tokens.
```

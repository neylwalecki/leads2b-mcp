# Diagnóstico de acesso comercial

As APIs internas não têm contrato estável de permissões. Uma chave de empresa pode consultar `/deals` ou alguns históricos sem conseguir ler outros históricos e detalhes de oportunidade. HTTP 400 `invalid parameters` e HTTP 500 `internal_server_error` não comprovam ID inválido, registro inexistente, histórico vazio ou falha global da API.

Uma comparação somente leitura no projeto isolou o contexto da credencial: mantendo base v1, entidade, ID e parâmetros, chamadas que falhavam com chave de empresa responderam com credencial de usuário da mesma conta. Isso demonstra dependência da credencial nos casos comparados. Não identifica a regra interna de autorização, não comprova que todo 400/500 tem essa causa e não valida todos os registros da conta.

## Conferência sem alterar a conta

1. Registre versão/commit do checkout, caminho e data do build, comando do processo ativo e configuração efetiva, sem copiar tokens. Código local e processo carregado podem divergir.
2. Confirme a conta e o par entidade/ID na origem. IDs de `CUSTOMER` e `OPPORTUNITY` não são intercambiáveis. Use um registro conhecido como controle positivo.
3. Execute `leads2b_health_check`. `GET /user/logged/` com `userContext=false` confirma ausência de usuário naquele retorno; HTTP 200 sozinho não confirma contexto. Falha em v2 `/users` não determina o acesso a `/deals`.
4. Compare a requisição efetiva com o contrato observado: histórico v1 usa `entity`, `id_entity`, `limit` e `offset`; detalhe usa `/opportunity/index/{id}`. Não transfira regras da API pública para a interna.
5. Preserve o erro e `readState`. Um 400/500 apenas sugere conferir contexto de usuário, permissões e contrato. Com usuário confirmado e falha persistente, a causa continua a confirmar; encaminhe versão, requisição e resposta sanitizadas ao suporte.

Não altere entidades, IDs ou filtros para obter um sucesso que corresponda a outro objeto. Não substitua detalhe por linha de listagem, não deduza ganho/perda ou motivo de perda e não trate resposta ausente como valor zero.

## Configuração a validar pelo operador

Se o diagnóstico indicar contexto de usuário, valide uma credencial autorizada da **mesma conta** na API interna v1. A aceitação pela v2, por si só, não prova compatibilidade com a v1. O servidor mantém os campos de token separados e não tenta a outra credencial automaticamente.

Mantenha `LEADS2B_WRITE_MODE=disabled` e `LEADS2B_ENABLE_RAW_API=false`. Ter contexto de usuário amplia o acesso que a credencial pode permitir, mesmo que este MCP continue registrando somente leitura. Não gere ou renove chaves para diagnosticar um erro de leitura. Mudanças na configuração do runtime e sua reinicialização pertencem ao procedimento de publicação aprovado pelo operador.

## Paginação e limites da evidência

Cada sucesso de `leads2b_list_history` mantém `{response, coverage}` com cobertura `unknown`. O servidor não ordena, deduplica, descarta eventos ou calcula `nextOffset`. Mesmo uma resposta vazia, repetida, fora de ordem ou maior que o limite solicitado permanece bruta e não comprova completude.

Para validar uma coleta específica, confira entidade/ID de cada evento, IDs únicos, ordem e formato dos timestamps, avanço real do offset e página final vazia. Preserve os timestamps brutos. Pare com cobertura incompleta se houver erro, repetição, formato inesperado ou orçamento de páginas esgotado. Uma validação pontual não homologa toda a conta nem uma coleta futura.

## Publicação e rollback

1. Revise o diff e execute `npm test`, `npm run typecheck` e build em diretório isolado quando o runtime ativo apontar para `dist/`. Preserve os hashes do build ativo antes de substituí-lo.
2. Com autorização específica para o ambiente e a conta, preserve a configuração anterior em armazenamento protegido, publique o build validado e, se aprovado, configure a credencial v1 com usuário. Não inclua tokens no relatório.
3. Reinicie somente o upstream alvo na janela aprovada. Confira modo de escrita, API bruta, conta, contexto, um controle positivo e casos antes falhos, incluindo detalhe e paginação. Uma chamada aceita ou health positivo não encerra esse gate.
4. Se o aceite falhar, restaure o build e a configuração anteriores e reinicie somente esse upstream. Releia a configuração e os controles. Não execute mutações, reimportações ou replay como teste ou rollback.

## Referência do contrato

O [aplicativo público](https://app.leads2b.com/) e o [bundle common-7skxmiPS.js](https://app.leads2b.com/common-7skxmiPS.js), inspecionados em 15/10/2026, enviam histórico para a v1 com `entity` e `id_entity`; o detalhe usa `/opportunity/index/{id}`. O histórico aceita filtros adicionais no frontend, mas sua ausência não foi comprovada como causa dessas falhas. SHA-256 do bundle: `83c6631448313dc03eff34ac54bcc00bca64c23e7460f2314630d0a87259269b`. A URL com hash pode mudar. Essa inspeção confirma o formato observado, não o acesso com um token de API.

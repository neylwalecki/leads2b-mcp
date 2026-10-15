# Diagnóstico de acesso comercial

As APIs internas não têm contrato estável de permissões. Uma chave de empresa pode consultar `/deals` ou alguns históricos sem conseguir ler outros históricos e detalhes de oportunidade. HTTP 400 `invalid parameters` e HTTP 500 `internal_server_error` não comprovam ID inválido, registro inexistente, histórico vazio ou falha global da API.

O acesso pode exigir uma credencial v1 com contexto de usuário, dependendo do endpoint e do registro. O health check permite conferir esse contexto, mas não valida permissões para toda a conta. Um erro HTTP isolado não identifica a causa.

## Conferência sem alterar a conta

1. Registre versão/commit do checkout, caminho e data do build, comando do processo ativo e configuração efetiva, sem copiar tokens. Código local e processo carregado podem divergir.
2. Confirme a conta e o par entidade/ID na origem. IDs de `CUSTOMER` e `OPPORTUNITY` não são intercambiáveis. Use um registro conhecido como controle positivo.
3. Execute `leads2b_health_check`. `GET /user/logged/` com `userContext=false` confirma ausência de usuário naquele retorno; HTTP 200 sozinho não confirma contexto. Falha em v2 `/users` não determina o acesso a `/deals`.
4. Compare a requisição efetiva com o contrato observado: histórico v1 usa `entity`, `id_entity`, `limit` e `offset`; detalhe usa `/opportunity/index/{id}`. Não transfira regras da API pública para a interna.
5. Preserve o erro e `readState`. Um 400/500 apenas sugere conferir contexto de usuário, permissões e contrato. Com usuário confirmado e falha persistente, a causa continua a confirmar; encaminhe versão, requisição e resposta sanitizadas ao suporte.

Não altere entidades, IDs ou filtros para obter um sucesso que corresponda a outro objeto. Não substitua detalhe por linha de listagem, não deduza ganho/perda ou motivo de perda e não trate resposta ausente como valor zero.

## Configuração a validar pelo operador

Se o diagnóstico indicar contexto de usuário, valide uma credencial autorizada da **mesma conta** na API interna v1. A aceitação pela v2, por si só, não prova compatibilidade com a v1. O servidor mantém os campos de token separados e não tenta a outra credencial automaticamente.

Para operar somente leitura, mantenha `LEADS2B_WRITE_MODE=disabled` e `LEADS2B_ENABLE_RAW_API=false`. O contexto de usuário pode ampliar as permissões da credencial na plataforma; o modo `disabled` impede o registro de ferramentas de escrita neste MCP. Confira a credencial existente antes de gerar ou renovar uma chave, pois a substituição pode afetar outras integrações.

## Paginação e limites da evidência

Cada sucesso de `leads2b_list_history` mantém `{response, coverage}` com cobertura `unknown`. O servidor não ordena, deduplica, descarta eventos ou calcula `nextOffset`. Mesmo uma resposta vazia, repetida, fora de ordem ou maior que o limite solicitado permanece bruta e não comprova completude.

Eventos de e-mail podem trazer `entity="opportunity"`, enquanto outros eventos usam `OPPORTUNITY`. O MCP preserva esses valores. Consumidores que reconheçam os dois aliases devem validar também `id_entity`; não use o alias para aceitar eventos de outra entidade ou de outro registro.

Para validar uma coleta específica, confira entidade/ID de cada evento, IDs únicos, ordem e formato dos timestamps, avanço real do offset e página final vazia. Preserve os timestamps brutos. Pare com cobertura incompleta se houver erro, repetição, formato inesperado ou orçamento de páginas esgotado. Uma validação pontual não homologa toda a conta nem uma coleta futura.

## Atualizar a instalação

1. Execute `npm test`, `npm run typecheck` e `npm run build`. Se o cliente ativo usar o mesmo `dist/`, compile primeiro em outro diretório com `npm run build -- --outDir <diretorio>`.
2. Preserve a versão e a configuração anteriores, mantendo credenciais em armazenamento protegido. Instale o build validado e configure os tokens conforme o [guia de autenticação](API-TOKENS.md).
3. Reinicie o servidor no cliente MCP. Confira modo de escrita, API bruta e contexto de usuário, depois consulte registros conhecidos, incluindo detalhe e histórico paginado.
4. Se a nova instalação não responder como esperado, restaure o build e a configuração anteriores e reinicie o servidor. Valide com consultas de leitura; não use mutações, reimportações ou replay para testar a instalação.

## Contrato das APIs internas

Histórico e detalhe usam endpoints internos observados, sujeitos a mudanças: `GET /history/index/` recebe `entity`, `id_entity`, `limit` e `offset`; o detalhe usa `GET /opportunity/index/{id}`. A [referência de endpoints](API-ENDPOINTS.md) distingue essas rotas da API pública. Não acrescente filtros nem transfira parâmetros entre as duas APIs sem confirmar o contrato.

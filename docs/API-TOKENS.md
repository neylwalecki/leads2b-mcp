# Como obter e configurar os tokens da Leads2b

## Abrir as integrações

Entre na conta Leads2b que será conectada ao MCP e acesse **Configurações > Integrações**. Para gerar a chave por usuário, use um perfil de administrador com acesso ao módulo de API. Se a seção não aparecer, peça ao administrador ou ao suporte da Leads2b para verificar as permissões e o plano.

## Copiar a chave de empresa

1. Localize **Integração da Leads2b (via API)**.
2. No campo **Chave de integração (API)**, clique em **Copiar chave**.
3. Cole somente o valor copiado em **Token API v1** nas configurações da extensão. Na instalação manual, o campo correspondente é `LEADS2B_API_V1_TOKEN`.

Essa chave pode atender às consultas v1 e às operações de empresas/pessoas e contatos permitidas pela conta. Ela pode não identificar um usuário e, nesse caso, não permite criar ou editar leads e oportunidades pelo MCP.

## Gerar ou copiar a chave por usuário

1. Na mesma tela, encontre a seção **Integração da Leads2b (via API V2) - Chave por usuário**.
2. Se já houver uma chave válida, use o ícone de copiar ao lado do campo.
3. Se o campo estiver vazio, clique em **Gerar chave** e copie o valor gerado.
4. Cole somente o token em **Token API v2** na extensão. Na instalação manual, use `LEADS2B_API_V2_TOKEN`.
5. Observe a data de expiração exibida pela plataforma, quando disponível.

**Gerar uma nova chave substitui a anterior.** A plataforma pede confirmação quando já existe uma chave. Faça isso apenas ao criar a primeira chave ou ao renovar o acesso e atualize as integrações que usam o valor anterior.

Os campos do MCP recebem o token sem aspas, espaços extras ou o prefixo `Bearer`. O servidor acrescenta o cabeçalho de autenticação.

## Habilitar operações de leads e oportunidades

Essas operações usam a API interna v1 e exigem um token que identifique um usuário autorizado. A chave de empresa e a chave por usuário têm escopos diferentes.

Para verificar a chave por usuário também na API interna v1, configure-a explicitamente em **Token API v1**, mantenha a escrita em `disabled` e execute o health check descrito abaixo. O rótulo “API V2” da plataforma não comprova, por si só, acesso aos endpoints internos v1; prossiga somente se o MCP confirmar autenticação e contexto de usuário. Se não confirmar, solicite ao suporte da Leads2b uma credencial compatível com a API interna v1 para o usuário responsável.

O MCP não copia nem troca os tokens entre os dois campos automaticamente. Mesmo com contexto de usuário válido, as permissões e os campos obrigatórios da conta continuam valendo.

## Conferir a conexão

1. Salve as configurações com `write_mode=disabled`.
2. No cliente MCP, peça: “Execute `leads2b_health_check` e informe autenticação, contexto de usuário e restrições, sem exibir tokens”.
3. Confira separadamente o acesso às APIs v1 e v2. Para operações de negócios, confira também `apis.v1.userContext`.
4. Faça uma consulta conhecida da conta. Autenticação válida não garante permissão em todos os endpoints.
5. Use `preview` para conferir uma operação de escrita sem alterar registros. Ative `live` somente quando quiser executar alterações reais.

## Renovar ou corrigir o acesso

| Situação | O que verificar |
|---|---|
| Seção de chave por usuário ausente | Perfil de administrador, permissões e acesso ao módulo de API |
| Resposta 401 | Token incorreto, expirado ou substituído; confira o campo e copie novamente a chave válida |
| Resposta 403 | Permissões do usuário, conta e acesso ao recurso |
| API v1 sem contexto de usuário | Use uma credencial de usuário aceita pela API interna v1; a chave de empresa pode continuar válida para consultas |
| API v2 funciona, mas v1 falha | Valide as credenciais de cada campo; os escopos não são intercambiáveis por garantia |

A renovação não é automática. Após gerar outra chave, atualize o campo correspondente na extensão e repita o health check. Guarde os tokens nas configurações protegidas do cliente MCP; não os publique em issues, conversas, capturas de tela ou no repositório.

## Referências

- [Autenticação: documentação oficial Leads2b](https://developers.leads2b.dev/api/authentication).
- [Plataforma Leads2b: Configurações > Integrações](https://app.leads2b.com/).
- [Endpoints e autenticação usados pelo MCP](API-ENDPOINTS.md).

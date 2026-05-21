# AGENTS.md

Instruções para agentes trabalhando neste repositório.

## Postura

Trate este projeto como open source desde o primeiro commit. Não inclua tokens, credenciais ou dados reais de contas Leads2b em arquivos versionáveis.

Se precisar documentar um caso real, sanitize antes:

- Troque domínios reais por `example.com`.
- Troque e-mails por `lead@example.com`.
- Troque telefones por números fictícios.
- Troque tokens por `<TOKEN>`.
- Remova nomes de clientes e contatos.

## Princípios

- Leitura e diagnóstico continuam sendo a base do projeto.
- Escrita existe de forma opt-in por configuração e deve ser prática quando o usuário ativou modo `live`.
- Contratos não documentados devem ser marcados como instáveis.
- Campos resumidos de origem não devem sobrescrever UTMs brutas sem regra clara.
- O MCP deve ajudar a investigar first touch, last touch e eventos intermediários quando a API permitir.
- O MCP deve retornar dados integrais da conta autenticada. Não adicione redaction em runtime sem pedido explícito.

## Escrita

Modelo atual:

- `LEADS2B_WRITE_MODE=disabled`: não registrar ferramentas de escrita.
- `LEADS2B_WRITE_MODE=preview`: registrar ferramentas, mas retornar apenas o plano da operação.
- `LEADS2B_WRITE_MODE=live`: permitir criação e atualização simples sem confirmação repetitiva por chamada.

`LEADS2B_ENABLE_RAW_API=true` registra `leads2b_api_request` para usuários avançados. Métodos mutantes dessa ferramenta devem respeitar `LEADS2B_WRITE_MODE`.

Use confirmação extra para operações destrutivas, como delete, bulk update, bulk delete, merge, conversões artificiais ou alterações difíceis de desfazer.

Não registre tokens em logs. Não publique dados reais em fixtures, exemplos, issues ou documentação.

## Qualidade

- Prefira soluções simples e pequenas.
- Use TypeScript com schemas explícitos.
- Crie testes unitários para normalização de atribuição.
- Crie testes unitários para comportamento de escrita, write-mode e raw API quando mexer nessa superfície.
- Crie fixtures sanitizadas para respostas de API.
- Testes padrão não devem fazer chamadas externas nem mutação real.

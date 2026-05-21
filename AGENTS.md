# AGENTS.md

Instruções para agentes trabalhando neste repositório.

## Postura

Trate este projeto como open source desde o primeiro commit. Não inclua tokens reais, dados pessoais de leads, nomes de clientes, screenshots privadas, dumps crus de API ou credenciais em arquivos versionáveis.

Se precisar documentar um caso real, sanitize antes:

- Troque domínios reais por `example.com`.
- Troque e-mails por `lead@example.com`.
- Troque telefones por números fictícios.
- Troque tokens por `<TOKEN>`.
- Remova nomes de clientes e contatos.

## Princípios

- O MVP é read-only e focado em leitura e diagnóstico.
- Contratos não documentados devem ser marcados como instáveis.
- Campos resumidos de origem não devem sobrescrever UTMs brutas sem regra clara.
- O MCP deve ajudar a investigar first touch, last touch e eventos intermediários quando a API permitir.

## Qualidade

- Prefira soluções simples e pequenas.
- Use TypeScript com schemas explícitos.
- Crie testes unitários para normalização de atribuição.
- Crie fixtures sanitizadas para respostas de API.
- Não faça chamadas reais em testes padrão.

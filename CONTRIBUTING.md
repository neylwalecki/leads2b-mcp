# Contribuição

Relatos de problemas, melhorias de documentação e pull requests são bem-vindos.

## Ambiente de desenvolvimento

Requer Node.js 22 ou superior e npm.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Testes padrão usam mocks e fixtures sanitizadas. Não exigem tokens nem acesso a uma conta Leads2b. Testes de integração somente leitura são opt-in; não adicione testes padrão que alterem contas reais.

## Relatar um problema

Abra uma [issue](https://github.com/neylwalecki/leads2b-mcp/issues) com versão ou commit, versão do Node, cliente MCP, sistema operacional, passos de reprodução, ferramenta chamada e entrada/saída sanitizadas. Descreva o resultado esperado e o observado.

Não inclua tokens, cabeçalhos de autorização, nomes de clientes, e-mails, telefones, capturas ou dumps reais de API. Use `<TOKEN>`, `lead@example.com`, `example.com`, IDs e telefones fictícios.

## Alterar ferramentas ou endpoints

- Mantenha os clientes das APIs v1 e v2 separados.
- Documente métodos, endpoints, campos obrigatórios e estabilidade do contrato.
- Marque contratos internos não documentados como `observed` ou `experimental`.
- Adicione testes com fixtures sanitizadas e sem chamadas externas.
- Preserve campos brutos de atribuição e informe cobertura parcial explicitamente.
- Atualize a referência de ferramentas, os exemplos e a seção `Unreleased` do changelog quando o comportamento mudar.

## Ferramentas de escrita

Toda mutação deve respeitar `LEADS2B_WRITE_MODE`:

- `disabled`: não registrar ferramentas de escrita.
- `preview`: retornar o plano, sem chamadas de escrita ou autenticação para executar a operação.
- `live`: permitir criação e atualização simples conforme permissões da conta.

Exclusões e ganho/perda exigem confirmação extra. Operações em lote, merges ou novas operações destrutivas precisam de proteção explícita. Não faça retry automático de mutações. Distingua solicitação aceita, persistência observada e resultado incerto; preserve evidências de releitura após falhas ambíguas.

## Verificar uma contribuição

Execute testes relevantes e `npm run typecheck`. Para mudanças de runtime, rode também `npm run build`. Mudanças de dependências, manifesto ou empacotamento exigem `npm audit`, `npm run package:mcpb` e `npm run verify:mcpb`. O empacotador não sobrescreve arquivos existentes em `artifacts/`.

Documentação deve usar exemplos executáveis, links válidos e descrições do comportamento do produto. Compartilhe somente material sanitizado.

## Licença

Contribuições são disponibilizadas sob a [licença MIT](LICENSE) do projeto. Preserve os avisos de licença de arquivos de terceiros.

# Dependências e empacotamento

## Auditoria de dependências

O projeto usa `package-lock.json` para instalações reproduzíveis. A CI executa `npm audit` em toda a árvore, incluindo dependências de desenvolvimento.

```sh
npm ci
npm audit
npm audit --omit=dev
```

O resultado depende do lockfile e do banco de avisos no momento da consulta. Um audit sem avisos não garante ausência de vulnerabilidades. Atualizações de dependências devem passar por testes, typecheck, build e verificação do pacote.

O empacotador usa `fflate` para criar o arquivo ZIP e AJV com `ajv-formats` para validar o manifesto. `@anthropic-ai/mcpb`, `node-forge` e o override de `tmp` não fazem parte da árvore atual. O arquivo final inclui somente dependências de produção; ferramentas de desenvolvimento não são distribuídas.

### Aviso conhecido no SDK

O lockfile usa `@modelcontextprotocol/sdk` 1.29.0. O [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h), incluído no banco de avisos em 06/10/2026, faz `npm audit` reportar severidade alta para versões de 1.12.0 até 1.30.1. A correção está na 1.31.0.

O aviso afeta o cliente OAuth HTTP do SDK. A referência oficial exclui servidores MCP e clientes STDIO; este projeto usa essas interfaces, sem cliente OAuth HTTP. O aviso continua presente no audit enquanto o lockfile não for atualizado. Não suprima a verificação; atualizações do SDK devem passar pelos testes e pela verificação do pacote.

## Gerar e verificar um pacote

```sh
npm run package:mcpb
npm run verify:mcpb
```

O arquivo fica em `artifacts/leads2b-mcp-VERSAO.mcpb`. A gravação é atômica e não substitui arquivos existentes. Para repetir a geração de uma versão, preserve ou mova o arquivo anterior. A criação usa um hard link no mesmo diretório; sistemas de arquivos sem esse recurso retornam erro.

O verificador extrai o pacote, confere o conteúdo e executa o servidor STDIO em `disabled` e `preview`, sem credenciais. Também gera um arquivo `.sha256`. Essa verificação cobre o pacote e o protocolo; não instala extensões nem testa operações em contas reais.

## Manifesto MCPB

O manifesto segue a versão 0.3 do [formato MCPB](https://github.com/modelcontextprotocol/mcpb). O schema é uma cópia versionada, validada em modo estrito, sem coerção de tipos nem aplicação de valores padrão.

| Item | Origem |
|---|---|
| Schema | `scripts/vendor/mcpb-manifest-v0.3.schema.json` no repositório |
| Pacote de origem | `@anthropic-ai/mcpb` 2.1.2 |
| Tarball | [Registro npm](https://registry.npmjs.org/@anthropic-ai/mcpb/-/mcpb-2.1.2.tgz) |
| SHA-256 do schema | `3a0ac9d845711a1b9b17dfa5a52f8b60628239d6a86a9db417206a9efc78592d` |
| Licença | MIT; aviso original em `scripts/vendor/MCPB-LICENSE` no repositório |

Além do schema, a validação exige versões coerentes entre pacote e manifesto, entrada relativa existente, servidor Node, runtime `>=22`, tokens sensíveis, escrita desativada por padrão e referências válidas a `user_config`. A API avançada fica desativada no pacote.

## Conteúdo e limites do formato

O pacote inclui servidor compilado, documentação, exemplos, licença, manifesto e dependências de produção. O staging usa uma lista explícita de arquivos. `.env`, credenciais, pesquisa privada e histórico Git ficam fora do pacote.

Os filtros de `scripts/mcpb-support.mjs` excluem arquivos de desenvolvimento e rejeitam links simbólicos incluíveis e caminhos inseguros. Nomes no ZIP usam separadores POSIX; permissões Unix são preservadas quando aplicáveis.

O empacotador suporta o manifesto 0.3, sem assinatura, verificação criptográfica ou suporte a `.mcpbignore`. Ele não implementa todos os recursos do CLI MCPB. Atualizações do schema ou dos filtros devem incluir testes de conteúdo e execução do servidor extraído.

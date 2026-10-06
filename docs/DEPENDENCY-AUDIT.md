# Audit de dependências do candidato 0.4.2

O empacotamento usa fflate diretamente. `@anthropic-ai/mcpb` e node-forge foram removidos da árvore de desenvolvimento. O override de tmp foi removido após confirmar ausência de consumidores restantes. AJV e ajv-formats foram declarados também como dependências diretas de desenvolvimento para validar o pacote. Ambos já eram dependências transitivas de produção do SDK e continuam no runtime por essa razão; a mudança não acrescenta arquivos ou versões à árvore de produção.

A CI verifica `npm audit` completo. A ausência de avisos deve ser reconfirmada em cada execução, pois o banco de vulnerabilidades pode mudar.

## Schema congelado

O arquivo `scripts/vendor/mcpb-manifest-v0.3.schema.json` foi copiado de `@anthropic-ai/mcpb` 2.1.2, publicado em `https://registry.npmjs.org/@anthropic-ai/mcpb/-/mcpb-2.1.2.tgz`.

- Integridade npm: `sha512-goRbBC8ySo7SWb7tRzr+tL6FxDc4JPTRCdgfD2omba7freofvjq5rom1lBnYHZHo6Mizs1jAHJeN53aZbDoy8A==`.
- SHA-256 do schema: `3a0ac9d845711a1b9b17dfa5a52f8b60628239d6a86a9db417206a9efc78592d`.
- Licença MIT com aviso integral em `scripts/vendor/MCPB-LICENSE`.
- JSON Schema draft-07; AJV com strict/allErrors e ajv-formats, sem coerção nem defaults.

A versão suportada continua 0.3. O projeto exige `manifest_version` explicitamente, verifica entrada existente no staging, referências de configuração e defaults seguros. Não se oferece equivalência a todos os recursos ou schemas do CLI, assinatura, verificação criptográfica ou suporte genérico a `.mcpbignore`. Atualizações do schema exigem revisão deliberada.

O contêiner continua ZIP, com compressão 9, nomes POSIX e permissões Unix quando aplicáveis. Os filtros atuais são finitos e estão em `scripts/mcpb-support.mjs`. Arquivos de conta e desenvolvimento são excluídos; links incluíveis são rejeitados. Um candidato existente nunca é sobrescrito. A publicação local usa hard link para o arquivo temporário completo, no mesmo diretório; sistemas de arquivos sem essa capacidade falham explicitamente.

## Histórico: candidato 0.4.1

Verificação: 05/10/2026. Atualização local a partir do lockfile, sem alteração de CRM, instalação no cliente ou publicação. `npm audit fix --ignore-scripts` atualizou quatro dependências transitivas dentro das faixas aceitas, sem `--force` nem novos overrides.

| Pacote | Antes | Depois | Caminho |
|---|---|---|---|
| `fast-uri` | 3.1.7 | 3.1.8 | SDK MCP, via ajv |
| `ip-address` | 10.7.0 | 10.7.3 | SDK MCP, via express-rate-limit |
| `proxy-addr` | 2.0.7 | 2.0.8 | SDK MCP, via express |
| `source-map-js` | 1.2.1 | 1.2.2 | Vitest, via Vite/PostCSS; desenvolvimento |

## Pendência sem patch

O [aviso GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) afeta verificação de assinatura RSA do `node-forge` até 1.4.0. O aviso e o registro npm não apresentam versão corrigida nesta verificação. O registro npm mantém `@anthropic-ai/mcpb` 2.1.2 como versão mais recente, dependente de `node-forge`.

O audit completo retorna duas entradas de severidade alta: `node-forge` e o pacote dependente `@anthropic-ai/mcpb`. Não são duas falhas independentes. Ambos são dependências de desenvolvimento; o empacotamento usa `npm ci --omit=dev`, e o verificador exclui dependências do empacotador do arquivo final. O código instalado do empacotador usa node-forge em seu módulo de assinatura. O projeto chama somente `pack`, sem assinatura; isso delimita o uso observado e não equivale a declarar a vulnerabilidade corrigida ou impossível de explorar.

Não foi aplicada troca de biblioteca criptográfica, remoção do empacotador ou patch local em código de terceiros. Substituir a cadeia de empacotamento seria uma mudança estrutural separada, com novo contrato de validação do manifesto e compatibilidade do formato.

## Gates

- `npm audit --omit=dev`: deve retornar zero vulnerabilidades conhecidas para este lockfile na data da verificação.
- `npm audit`: continua com duas entradas altas de desenvolvimento; não é um gate aprovado.
- Testes, typecheck, build e verificação do arquivo extraído avaliam funcionamento, conteúdo e modos de operação. Não equivalem a uma aprovação de segurança ou validação live.
- Audit é uma consulta temporal, não uma garantia futura. O recibo local do candidato preserva as respostas JSON e o SHA-256 do arquivo gerado.

Antes de publicar, reavalie o aviso pendente e execute a matriz suportada de Windows e Node 22/24. Uma correção upstream compatível pode ser aplicada e revalidada; a ausência de patch não justifica suprimir o aviso.

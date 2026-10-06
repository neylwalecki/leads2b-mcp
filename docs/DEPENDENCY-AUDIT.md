# Audit de dependências do candidato 0.4.1

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

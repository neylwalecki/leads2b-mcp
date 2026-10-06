# Substituição do empacotador MCPB: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Execução recomendada nesta mesma sessão, pelo agente principal. Delegação não faz parte da opção proposta.

**Goal:** Remover a cadeia de desenvolvimento `@anthropic-ai/mcpb -> node-forge`, preservando o formato, a validação e o funcionamento do pacote local.

**Architecture:** Manter o staging e a instalação isolada das dependências de produção. Criar o ZIP com `fflate`, já utilizado pelo CLI atual e pelo verificador do projeto. Validar o manifesto com uma cópia congelada do JSON Schema oficial 0.3, AJV e regras explícitas do projeto.

**Tech Stack:** Node.js >=22, JavaScript ESM, fflate, AJV 8, ajv-formats, Vitest e SDK MCP existente.

**Spec:** `AGENTS.md`, `manifest.json`, `scripts/package-mcpb.mjs`, `scripts/verify-mcpb.mjs` e `docs/DEPENDENCY-AUDIT.md`. Este documento registra a proposta técnica derivada desses contratos e da investigação abaixo.

**Estado:** Implementação aprovada e validada localmente; este documento registra o estado imediatamente antes do commit. A confirmação posterior do commit consta do recibo em `artifacts/leads2b-mcp-0.4.2-validation.md` (não versionado). Base local: commit `5cadd7166d9442321b4f96042cfae8e64de856c0`, versão 0.4.1.

## Restrições globais

- Preservar `manifest_version: "0.3"`, servidor Node, `dist/index.js` e runtime `>=22`.
- Preservar ferramentas, contratos HTTP, atribuição e gates `disabled`, `preview` e `live`.
- Preservar escrita desativada por padrão, tokens sensíveis e raw API desativada no pacote.
- Gerar somente candidato local não assinado; assinatura e verificação criptográfica não entram no escopo.
- Não acessar contas, carregar tokens reais, executar testes live, instalar no Claude Desktop, publicar, fazer push, PR ou deploy.
- Permitir downloads públicos de dependências para validação local; não usar `npm audit fix --force` nem suprimir avisos.
- Preservar os candidatos 0.4.0 e 0.4.1. Gerar 0.4.2 somente depois da aprovação da implementação.
- Não criar commit desta proposta em revisão. Após implementação aprovada e validada, permitir um commit local apenas dos arquivos da tarefa.

## Evidências e decisão

O [formato oficial MCPB](https://github.com/modelcontextprotocol/mcpb) define um ZIP com manifesto e servidor. O código instalado de `@anthropic-ai/mcpb` 2.1.2 confirma que `dist/cli/pack.js` usa `zipSync` de fflate, compressão 9, caminhos POSIX e atributos Unix quando aplicáveis. Portanto, a extensão `.mcpb` não exige o CLI para gerar o contêiner.

O [aviso GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), consultado nesta investigação, informa que node-forge <=1.4.0 é afetado e não apresenta versão corrigida. O pacote final 0.4.1 já exclui essa cadeia; a mudança proposta remove sua presença nas dependências de desenvolvimento. Não se afirma que o caminho vulnerável seja inalcançável.

O schema publicado em `node_modules/@anthropic-ai/mcpb/schemas/mcpb-manifest-v0.3.schema.json` é draft-07, tem formatos `email` e `uri` e rejeita propriedades desconhecidas. Foi compilado em memória com AJV 8.20.0 e ajv-formats 3.0.1, já instalados transitivamente pelo SDK: o manifesto atual passou. A remoção de `manifest_version` também passou, demonstrando uma diferença em relação ao resolver/refinamento do CLI. Será exigido explicitamente `manifest_version === "0.3"`.

Proveniência para a cópia futura do schema:

- Pacote publicado: `@anthropic-ai/mcpb` 2.1.2.
- Tarball: `https://registry.npmjs.org/@anthropic-ai/mcpb/-/mcpb-2.1.2.tgz`.
- Integridade do lock: `sha512-goRbBC8ySo7SWb7tRzr+tL6FxDc4JPTRCdgfD2omba7freofvjq5rom1lBnYHZHo6Mizs1jAHJeN53aZbDoy8A==`.
- SHA-256 do schema: `3a0ac9d845711a1b9b17dfa5a52f8b60628239d6a86a9db417206a9efc78592d`.
- Licença MIT, copyright Anthropic 2025; copiar o aviso integral junto ao schema.

| Alternativa | Benefício | Custo ou limite | Decisão |
| --- | --- | --- | --- |
| Manter CLI e aguardar correção | Nenhuma manutenção nova | Mantém a cadeia vulnerável sem correção disponível nesta consulta | Não recomendada |
| ZIP com fflate + schema oficial congelado | Usa o mesmo escritor ZIP, sem módulos de assinatura | Projeto assume filtros e atualização deliberada do schema; adiciona AJV e formatos como devDependencies diretas | Recomendada |
| Copiar schemas Zod do CLI | Aproxima validação em código do upstream | Código de terceiros maior, integração Zod 3/4 e manutenção adicional | Não recomendada |

A recomendação atende este projeto Node com manifesto 0.3. Não pretende substituir todos os recursos do CLI, aceitar qualquer versão de manifesto ou implementar `.mcpbignore` genérico. O staging atual não copia esse arquivo. Caso ele seja introduzido, falhar com mensagem explícita até haver uma decisão de suporte.

## Foco da revisão

- Manifesto estruturalmente válido, mas sem versão ou com entrada fora do pacote: rejeitar antes de criar o candidato.
- Dependências necessárias omitidas pelos filtros: comparar inventário e bytes com o candidato anterior e executar o servidor extraído.
- Arquivos privados, de desenvolvimento ou links escapando do staging: rejeitar ou excluir por regra documentada, sem seguir links silenciosamente.
- Caminhos Windows e permissões Unix: usar nomes POSIX no ZIP e preservar permissões aplicáveis; não afirmar QA em Windows a partir de macOS.
- Falha no npm ou na gravação: limpar staging e arquivo temporário; não substituir um candidato existente por saída incompleta.

## Mapa de execução proposto

| ID | Etapa | Estado | Evidência exigida |
| --- | --- | --- | --- |
| P1 | Validador e schema congelado | ✅ Concluída | Testes de manifesto e políticas |
| P2 | Escritor ZIP e filtros | ✅ Concluída | Testes de arquivos, caminhos e falhas |
| P3 | Dependências, CI e candidato | ✅ Concluída | Audit completo, pacote e comparação |
| P4 | Revisão e commit local | 🔄 Em andamento | Diff revisado e recibo de validação |

### P1: Validar manifesto sem importar o CLI

**Arquivos:** Criar `scripts/mcpb-support.mjs`, `scripts/vendor/mcpb-manifest-v0.3.schema.json`, `scripts/vendor/MCPB-LICENSE` e `tests/package-mcpb.test.mjs`; modificar `package.json` e `package-lock.json`.

**Interfaces:** `validateBundleManifest(manifest: object, packageVersion: string, stageDir: string): Promise<void>`, com erro explícito em caso inválido. Adicionar AJV `^8.20.0` e ajv-formats `^3.0.1` como devDependencies diretas; não depender de importações transitivas.

- [x] Adicionar testes inicialmente falhando: manifesto atual válido; campo obrigatório ausente; tipo inválido; propriedade desconhecida; URI/e-mail inválidos; versão do manifesto ausente ou diferente de 0.3; divergência package/manifest.
- [x] Executar `npx vitest run tests/package-mcpb.test.mjs` e confirmar falhas pelas interfaces ainda ausentes.
- [x] Copiar schema e licença, conferir SHA-256 e registrar proveniência em `docs/DEPENDENCY-AUDIT.md`.
- [x] Implementar AJV com `strict: true`, `allErrors: true`, formatos ativos e sem coerção, remoção de campos ou aplicação de defaults.
- [x] Implementar políticas separadas do schema: entrada relativa existente dentro do staging, servidor Node, runtime >=22, tokens sensíveis, escrita default disabled, raw false e referências `user_config` existentes. Rejeitar versões/entradas divergentes e caminhos absolutos, `..`, backslash ou drive Windows no entry point. Rejeitar `dxt_version` conflitante.
- [x] Adicionar testes das políticas, incluindo arquivo de entrada ausente e referência de configuração inexistente; executar o teste focado até passar.

### P2: Gerar o contêiner e preservar o staging

**Arquivos:** Modificar `scripts/mcpb-support.mjs`, `scripts/package-mcpb.mjs`, `scripts/verify-mcpb.mjs` e `tests/package-mcpb.test.mjs`.

**Interfaces:** `createBundleArchive(stageDir: string): Promise<Uint8Array>` retorna ZIP; consome apenas staging validado. O script mantém `npm run package:mcpb` e o nome `artifacts/leads2b-mcp-${version}.mcpb`. O verificador usa o mesmo validador de manifesto e conserva seus testes stdio independentes.

- [x] Adicionar testes inicialmente falhando usando diretórios temporários: raiz sem pasta externa; nomes POSIX; bytes preservados; ordem estável; atributos Unix; arquivo `.env`, `.npmrc`, log, source map, declaration e `.bin` excluídos; symlink incluível rejeitado; `.mcpbignore` rejeitado explicitamente.
- [x] Executar o teste focado e confirmar falhas antes da implementação.
- [x] Preservar allowlist superior, `npm ci --omit=dev --ignore-scripts`, package.json reduzido e cleanup em `finally`.
- [x] Implementar filtros finitos equivalentes aos padrões atuais de `dist/node/files.js`, documentados no helper. Excluir também artefatos e diretórios privados já vetados pelo verificador. Não remover arquivos de produção por extensão genérica além dos filtros comprovados atuais.
- [x] Percorrer com `lstat`, ordenar nomes de forma estável e usar fflate `zipSync` com compressão 9 e atributos Unix equivalentes ao CLI. Manter timestamp válido do momento da geração; reprodutibilidade byte a byte não é requisito.
- [x] Validar manifesto antes do ZIP, gravar em arquivo temporário no destino e publicar somente após sucesso. Recusar sobrescrever um candidato existente para preservar sua evidência.
- [x] Adicionar teste de staging removido após falha do subprocesso e teste de saída preexistente preservada; usar subprocesso simulado, sem downloads nos testes padrão. Executar testes focados até passar.

### P3: Remover cadeia vulnerável e gerar candidato 0.4.2

**Arquivos:** Modificar `package.json`, `package-lock.json`, `manifest.json`, `src/index.ts`, referências de versão nos testes e documentação, `README.md`, `CHANGELOG.md`, `docs/DEPENDENCY-AUDIT.md` e `.github/workflows/ci.yml`. Não alterar contratos de ferramentas.

**Interfaces:** Comandos atuais de build, testes, package e verify permanecem; CI passa a executar `npm audit` completo. Candidato anterior é referência de comparação, não requisito para executar CI.

- [x] Remover `@anthropic-ai/mcpb` e regenerar lock. Remover override de `tmp` somente após comprovar que nenhuma dependência restante o usa.
- [x] Atualizar versão para 0.4.2 nos locais canônicos e descrever o escopo do candidato. Trocar audit de CI para completo, mantendo matriz Ubuntu/Windows e Node 22/24. Não disparar workflow remoto.
- [x] Executar `npm ci --ignore-scripts`, teste focado, `npm test`, `npm run typecheck`, `npm run build`, `npm audit`, `npm audit --omit=dev` e `npm pack --dry-run --json`. Audit só passa com resultado real; nova vulnerabilidade exige diagnóstico, não exceção automática.
- [x] Confirmar ausência de `@anthropic-ai/mcpb` e `node-forge` no lock e na árvore instalada. Usar `npm ls --all` e inspecionar o resultado; `npm ls` direcionado a pacote removido pode retornar código não zero por árvore vazia.
- [x] Executar `npm run package:mcpb` e `npm run verify:mcpb`, sem tokens e com testes live desativados.
- [x] Comparar arquivos descompactados de 0.4.1 e 0.4.2 por nome e SHA-256. Explicar individualmente alterações de versão, documentação, metadados e árvore de dependências decorrentes do lock; runtime e arquivos de produção sem mudança intencional devem preservar bytes. Não usar somente contagem nem hash do ZIP como equivalência.
- [x] Confirmar que o ZIP exclui devDependencies e dados privados, e que o servidor extraído mantém 52 ferramentas em disabled e 68 em preview, incluindo health e planos de escrita sem mutação. Investigar qualquer divergência antes de concluir.

### P4: Revisar e registrar resultado local

**Arquivos:** Criar recibo ignorado `artifacts/leads2b-mcp-0.4.2-validation.md`, snapshots de audit e comparação; atualizar este plano com evidências somente se aprovado e executado.

**Interfaces:** Recibo registra versão, commit, SHA-256, ambiente realmente testado, gates, diferenças de inventário e pendências. Não substitui instalação ou resultado live.

- [x] Revisar diff e arquivos staged, checar ausência de dados reais e executar `git diff --check`.
- [x] Registrar resultados e limitações. Testes locais macOS comprovam formato, conteúdo e protocolo stdio. Windows/Node 22/24 ficam pendentes até a matriz realmente executar; instalação em Claude Desktop exige autorização separada e não é gate desta entrega local.
- [ ] Criar um commit local apenas depois de todos os gates aprovados; preservar arquivos alheios e artefatos anteriores. Sem push, PR, tag ou publicação.

## Critério de aceite e reversão

A implementação estará pronta localmente quando a cadeia node-forge desaparecer, os audits completo e de produção passarem, os testes passarem, o candidato 0.4.2 validar e as diferenças de conteúdo forem explicadas. Nenhuma conclusão de instalação em cliente deriva desses gates.

Se houver incompatibilidade, conservar 0.4.1 e suas evidências, corrigir a proposta local e repetir somente os gates afetados. Não reinstalar ou substituir pacotes em ambientes conectados. Um resultado de audit sem correção disponível ou regressão não resolvida impede marcar a implementação concluída.

## Aprovação proposta

Opção 1 aprovada: Implementar P1 a P4 nesta mesma sessão pelo agente principal, atualizar apenas dependências e estrutura locais descritas, preparar CI sem executá-lo remotamente, validar e gerar candidato 0.4.2 com recibo e commit local. Não inclui instalação, acesso live, publicação, push, PR, deploy ou delegação.

## Decisões da execução

- Mantida a branch de trabalho existente e um único commit local ao final, conforme autorização.
- Revisão final pelo agente principal; o escopo aprovado exclui delegação. Isso não oferece revisão independente.
- `npm ci --ignore-scripts` encontrou EACCES no cache global e descartou o binário opcional de esbuild. A reinstalação com `--cache .npm-cache` resolveu a falha sem alterar permissões globais ou dependências.
- AJV e ajv-formats já pertenciam à árvore de produção via SDK. A declaração direta de desenvolvimento não altera esse conteúdo.
- Padrões stdio e conteúdo foram validados em macOS ARM64, Node 26.10.0. Windows, Node 22/24 e instalação em Claude Desktop continuam sem validação nesta execução local.

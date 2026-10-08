# Leads2b MCP

Servidor [Model Context Protocol](https://modelcontextprotocol.io/) para consultar dados, investigar atribuição e executar operações na Leads2b. Implementado em TypeScript, com o SDK oficial do MCP e transporte `stdio`.

Projeto independente, sem afiliação à Leads2b. Licença [MIT](LICENSE).

## Funcionalidades

| Área | Recursos |
|---|---|
| Empresas e pessoas | Listagem, busca, detalhe e CRUD de `CUSTOMER` |
| Contatos | Listagem por customer, detalhe e CRUD |
| Leads e oportunidades | Busca, detalhe, CRUD e alteração de funil, etapa e responsável |
| Oportunidades e histórico | Leitura de páginas do histórico; ganho, perda com motivo, anotações e atividades com contratos experimentais |
| Operação de leads | Coleta paginada, filtros, candidatos e cobertura explícita |
| Atribuição | Conversões, tracking, UTMs, first/last touch observados e divergências |
| Catálogos | Equipe, pipelines, etapas, origens, campos, tags e motivos de perda |
| Agenda e integrações | Consulta de calendário, snippet e webhooks |

Escritas são desativadas por padrão. Consulte a [referência de ferramentas](docs/MCP-TOOLS.md) para schemas, requisitos e limites de cada operação.

## Instalação

### Claude Desktop

1. Baixe um arquivo `.mcpb` na página de [releases](https://github.com/neylwalecki/leads2b-mcp/releases). Para uma versão ainda não distribuída, [compile o pacote](#desenvolvimento).
2. Em **Settings > Extensions > Advanced settings > Install Extension…**, selecione o arquivo.
3. Preencha **Token API v1** e **Token API v2** com credenciais da mesma conta. O [guia de tokens](docs/API-TOKENS.md) explica como obtê-las.
4. Mantenha o modo de escrita em `disabled` para começar.

O pacote inclui o servidor e as dependências de produção. O Claude Desktop fornece o runtime Node; a instalação da extensão dispensa Git e npm. Tokens são marcados como sensíveis no manifesto. Disponibilidade de extensões e armazenamento das credenciais dependem do cliente e das políticas da organização. Consulte as [instruções oficiais do Claude](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

### Clientes com suporte a STDIO

Requer Git e Node.js 22 ou superior. Use uma versão LTS compatível.

```sh
git clone https://github.com/neylwalecki/leads2b-mcp.git
cd leads2b-mcp
npm ci
npm run build
```

Para uma versão específica, selecione a tag ou branch desejada antes de executar `npm ci`. A documentação de cada checkout acompanha seu código; versões distribuídas estão em [Releases](https://github.com/neylwalecki/leads2b-mcp/releases).

Configure o cliente para iniciar `node` com o caminho absoluto de `dist/index.js`. Exemplo no formato usado pelo Claude Desktop:

```json
{
  "mcpServers": {
    "leads2b": {
      "command": "node",
      "args": ["/caminho/absoluto/leads2b-mcp/dist/index.js"],
      "env": {
        "LEADS2B_API_V1_TOKEN": "<TOKEN_V1>",
        "LEADS2B_API_V2_TOKEN": "<TOKEN_V2>",
        "LEADS2B_WRITE_MODE": "disabled",
        "LEADS2B_ENABLE_RAW_API": "false"
      }
    }
  }
}
```

Substitua os caminhos e tokens. Se o cliente não encontrar Node, use o caminho absoluto do executável. No Windows, escape barras invertidas em JSON, por exemplo `C:\\Tools\\leads2b-mcp\\dist\\index.js`. O cliente inicia e encerra o processo; não é necessário manter `npm start` aberto.

Para o Codex, veja o [guia de configuração](docs/CHATGPT-CODEX.md). Este servidor fornece somente STDIO; não inclui endpoint HTTP ou SSE para clientes que exigem conexão remota.

## Configuração

Passe as variáveis pelo cliente MCP ou copie `.env.example` para `.env` na pasta do projeto. Arquivos de configuração com tokens devem permanecer fora do Git.

| Variável | Finalidade | Padrão |
|---|---|---|
| `LEADS2B_API_V1_TOKEN` | Credencial da API interna v1 | Não configurado |
| `LEADS2B_API_V2_TOKEN` | Credencial da API interna v2 | Não configurado |
| `LEADS2B_WRITE_MODE` | `disabled`, `preview` ou `live` | `disabled` |
| `LEADS2B_ENABLE_RAW_API` | Habilitar `leads2b_api_request` | `false` |
| `LEADS2B_API_V1_BASE_URL` | Base da API interna v1 | `https://app.leads2b.com/api/v1` |
| `LEADS2B_API_V2_BASE_URL` | Base da API interna v2 | `https://app.leads2b.com/api/v2` |
| `LEADS2B_PUBLIC_WORKER_URL` | Base do snippet público | `https://js.app.leads2b.com` |

Escritas em leads/oportunidades e no histórico exigem uma credencial v1 com contexto de usuário. Uma chave de empresa pode permitir consultas e operações de customers/contatos sem atender a esse requisito. A leitura de histórico não faz essa verificação prévia; a API decide o acesso. Confira `apis.v1.userContext` no health check. O servidor não troca tokens entre APIs automaticamente.

### Modos de escrita

| Modo | Comportamento |
|---|---|
| `disabled` | Somente leitura; ferramentas de escrita não são registradas |
| `preview` | Retorna método, endpoint e payload, sem enviar alterações |
| `live` | Executa alterações; exclusão e ganho/perda exigem `confirm_destructive=true` |

O cliente MCP pode solicitar aprovações próprias. Escritas não recebem retry automático. Se a API retornar erro depois do envio, confira a releitura antes de repetir: uma resposta HTTP 500 não comprova rollback.

## Primeira consulta

```text
Execute leads2b_health_check. Informe os endpoints testados, o contexto de usuário
e o modo de escrita, sem exibir tokens. Distinga ferramentas registradas de
permissões verificadas.
```

O health check testa endpoints específicos. Um 403 em `/users` não comprova falha de toda a API v2. Em seguida, consulte um registro conhecido usando `leads2b_search_customers` ou `leads2b_find_records`. A busca v2 retorna até 25 registros por padrão; `returnAll=true` preserva a resposta integral. Veja outros [exemplos de uso](examples/usage-prompts.md).

## Desenvolvimento

Depois da instalação das dependências:

```sh
npm test
npm run typecheck
npm run build
npm audit
npm run package:mcpb
npm run verify:mcpb
```

O pacote é gerado em `artifacts/leads2b-mcp-VERSAO.mcpb`. O empacotador recusa sobrescrever um arquivo existente; mova o pacote anterior se precisar gerar novamente a mesma versão. O verificador confere o manifesto e executa o servidor extraído em `disabled` e `preview`, sem tokens. Detalhes do formato estão em [dependências e empacotamento](docs/DEPENDENCY-AUDIT.md).

Testes padrão usam mocks e fixtures sanitizadas. Integração somente leitura é opt-in com `RUN_LEADS2B_INTEGRATION_TESTS=true`. A CI está configurada para Linux e Windows com Node 22 e 24; os resultados das execuções estão em [Actions](https://github.com/neylwalecki/leads2b-mcp/actions).

### Interface para automações

Importe `leads2b-mcp/lead-ops` após instalar o pacote local. Essa entrada exporta `scanLeadOps`, configuração, clientes e normalizadores com tipos. Caminhos legados `dist/*` continuam disponíveis. Veja o [exemplo executável](examples/lead-ops.mjs).

`scanLeadOps` distingue cobertura da coleta e paginação da saída. Registros sem tracking permanecem nos resultados, com IDs técnicos e origem cadastral preservados.

## Limites

- O servidor usa as APIs internas `app.leads2b.com/api/v1` e `/api/v2`. Elas diferem da API pública `api.leads2b.com/v2` e podem mudar sem aviso.
- Ganho/perda de oportunidade, anotação e atividade são experimentais. Permissões e persistência dependem da API e das regras da conta. Registrar atividade não envia convite nem marca conclusão.
- A paginação da busca de customers é local: limita a saída, mas não reduz a transferência da resposta original.
- Merges, importações em lote, ganho/perda de lead e conversões artificiais não têm ferramentas dedicadas. Consulte a [cobertura](docs/ROADMAP.md).
- Consultas brutas preservam os dados da conta autenticada. Restrinja o acesso ao cliente MCP e compartilhe somente exemplos sanitizados.
- O pacote MCPB não é assinado. Não há verificação automática da identidade do distribuidor.

## Documentação

- [Ferramentas, schemas e resultados](docs/MCP-TOOLS.md)
- [Tokens e autenticação](docs/API-TOKENS.md)
- [Configuração no Codex e transporte no ChatGPT](docs/CHATGPT-CODEX.md)
- [Endpoints e estabilidade](docs/API-ENDPOINTS.md)
- [Atribuição e origem](docs/ATRIBUICAO-E-ORIGEM.md)
- [Dependências e empacotamento](docs/DEPENDENCY-AUDIT.md)
- [Cobertura e evolução](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)

## Contribuição

Sugestões e relatos de problemas são bem-vindos em [Issues](https://github.com/neylwalecki/leads2b-mcp/issues). Para alterações de código, leia [CONTRIBUTING.md](CONTRIBUTING.md). Nunca inclua tokens ou dados reais de clientes em exemplos, logs ou pull requests.

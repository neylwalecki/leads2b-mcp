# Leads2b MCP

Servidor MCP independente para consultar dados, investigar atribuição e operar o CRUD básico da Leads2b. Usa `stdio`, TypeScript e o SDK oficial do MCP. Não é afiliado à Leads2b.

## O que faz

| Área | Ações |
|---|---|
| Empresas e pessoas (`CUSTOMER`) | Listar, buscar, detalhar, criar, editar e excluir |
| Contatos | Listar por customer, detalhar, criar, editar e excluir |
| Leads e oportunidades | Buscar, detalhar, criar, editar e excluir |
| Operação diária | Coleta paginada, candidatos, datas, campos comerciais e avisos de cobertura |
| Atribuição | Conversões, tracking, first/last touch observados, UTMs e divergências |
| Catálogos | Equipe, pipelines, etapas, origens, campos, tags, campanhas e fluxos |
| Agenda, snippet e webhooks | Consultar; sem ferramentas de envio ou publicação |

As escritas são opt-in. Os contratos internos são instáveis e dependem de permissões e regras da conta. Consulte [ferramentas e limites](docs/MCP-TOOLS.md) e [evidência dos endpoints](docs/API-ENDPOINTS.md).

## Escolha seu cliente

| Cliente | Instalação |
|---|---|
| Claude Desktop | Pacote `.mcpb`; instruções abaixo |
| Codex app | [Configuração local com Node e `config.toml`](docs/CHATGPT-CODEX.md) |
| ChatGPT desktop com MCP local | [Adicionar um servidor STDIO](docs/CHATGPT-CODEX.md#chatgpt-desktop-interface-de-mcp-local) |

## Claude Desktop no Windows ou macOS

O arquivo `leads2b-mcp-0.3.0.mcpb` inclui o servidor e suas dependências de produção. O Claude Desktop fornece o runtime Node; quem instala a extensão não precisa de Git, terminal ou npm.

1. Obtenha o arquivo `leads2b-mcp-0.3.0.mcpb`. Para gerar o pacote a partir do código-fonte, veja a seção de desenvolvimento abaixo.
2. No Claude Desktop, abra **Settings > Extensions > Advanced settings > Install Extension…** e selecione o arquivo.
3. [Obtenha os tokens na Leads2b](docs/API-TOKENS.md) e preencha os campos **Token API v1** e **Token API v2** com credenciais da mesma conta. Comece com `write_mode=disabled`.
4. Peça: “Execute `leads2b_health_check` e informe autenticação, contexto de usuário e restrições, sem exibir tokens”.
5. Teste uma consulta conhecida. Um health check positivo não comprova permissão em todos os endpoints.

Os campos dos tokens são sensíveis no manifesto e usam o armazenamento protegido do sistema oferecido pelo Claude. Extensões privadas precisam ser atualizadas instalando o novo arquivo. A instalação pode depender da política da organização. [Instruções oficiais do Claude](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

## Como obter os tokens

Na Leads2b, abra **Configurações > Integrações**. A seção **Integração da Leads2b (via API)** permite copiar a chave de empresa; a seção de **API V2, chave por usuário** permite gerar ou copiar a chave do usuário. O [guia de tokens](docs/API-TOKENS.md) mostra o passo a passo, os campos correspondentes no MCP e como validar o acesso.

## Modos de escrita

Uma chave v1 de empresa pode permitir consultas e CRUD de customers/contatos, mas não fornecer contexto de usuário para negócios. Para CRUD de leads/oportunidades, `LEADS2B_API_V1_TOKEN` deve autenticar um usuário autorizado. Confira `apis.v1.userContext` no health check. O MCP não troca tokens entre APIs automaticamente.

Use credenciais obtidas pelo responsável da conta, respeitando seu escopo. Tokens de usuário podem expirar; renove-os nas configurações da extensão. Não envie tokens em chats, issues ou arquivos públicos.

| Modo | Comportamento |
|---|---|
| `disabled` | Somente leitura; ferramentas de escrita não são registradas |
| `preview` | Mostra o método, endpoint e payload, sem enviar alterações |
| `live` | Envia criação/edição; exclusão exige `confirm_destructive=true` |

O cliente MCP pode solicitar suas próprias aprovações. Escritas nunca recebem retry automático. Uma resposta HTTP 500 pode ocorrer **depois de a alteração persistir**; confira a releitura antes de repetir.

## Desenvolvimento e instalação manual

Requer Node.js 22 ou superior; use uma versão LTS compatível. Na pasta do checkout:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run package:mcpb
```

O arquivo gerado fica em `artifacts/`. A CI executa testes, build, auditoria de dependências e verificação do pacote em Linux e Windows com Node 22 e 24.

Para desenvolver com `.env`, copie `.env.example` para `.env` (`Copy-Item .env.example .env` no PowerShell). Alternativamente, passe os tokens pelo campo `env` do cliente MCP. Não dependa de `cwd` no arquivo do Claude:

```json
{
  "mcpServers": {
    "leads2b": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Tools\\leads2b-mcp\\dist\\index.js"],
      "env": {
        "LEADS2B_API_V1_TOKEN": "<TOKEN>",
        "LEADS2B_API_V2_TOKEN": "<TOKEN>",
        "LEADS2B_WRITE_MODE": "disabled",
        "LEADS2B_ENABLE_RAW_API": "false"
      }
    }
  }
}
```

Adapte os caminhos reais e preserve outras entradas de `mcpServers`. Configuração manual guarda os valores no arquivo local; prefira a extensão para credenciais sensíveis.

Testes padrão usam mocks e fixtures sanitizadas. Testes de integração **somente leitura** são opt-in com `RUN_LEADS2B_INTEGRATION_TESTS=true`. Testes de escrita real não fazem parte da suíte padrão.

## Interface para automações

Após instalar o pacote local, importe `leads2b-mcp/lead-ops`. Essa entrada exporta `scanLeadOps`, configuração, clientes e normalizadores com tipos; os caminhos legados `dist/*` continuam disponíveis. Veja [exemplo executável](examples/lead-ops.mjs). Nenhuma automação instalada é migrada automaticamente.

`scanLeadOps` separa cobertura de coleta e paginação da saída. Preserva candidatos sem tracking, IDs técnicos e origem cadastral; não confunde ausência de tracking com ausência de lead nem cobertura parcial com zero resultados.

## Documentação

- [Ferramentas, schemas e CRUD](docs/MCP-TOOLS.md)
- [Instalação no Codex app e no ChatGPT desktop](docs/CHATGPT-CODEX.md)
- [Como obter e configurar os tokens](docs/API-TOKENS.md)
- [Endpoints, autenticação e validação](docs/API-ENDPOINTS.md)
- [Atribuição e origem](docs/ATRIBUICAO-E-ORIGEM.md)
- [Prompts de uso](examples/usage-prompts.md)
- [Changelog](CHANGELOG.md)

## Limites conhecidos

Os endpoints internos `app.leads2b.com/api/v1` e `/api/v2` são diferentes da API pública `api.leads2b.com/v2`. O MCP não promete cobrir toda a plataforma. Atividades mutantes, vendas/ganhos/perdas, merges, operações em lote e conversões artificiais não possuem ferramentas específicas. A API avançada é opt-in e não torna um contrato desconhecido confiável.

O servidor retorna os dados da conta autenticada integralmente nas consultas brutas. Restrinja o acesso ao cliente MCP e compartilhe somente exemplos sanitizados. O pacote é construído por lista explícita de arquivos, sem `.env`, pesquisas privadas ou histórico Git.

# Configuração no Codex e no ChatGPT

O servidor usa transporte STDIO. O Codex pode iniciar o processo local; o pacote `.mcpb` destina-se ao Claude Desktop.

## Preparar o servidor local

Instale Git e Node.js 22 ou superior. Em uma pasta de sua escolha, execute:

```sh
git clone https://github.com/neylwalecki/leads2b-mcp.git
cd leads2b-mcp
npm ci
npm run build
```

Para uma versão distribuída específica, selecione a tag desejada antes de instalar as dependências; consulte [Releases](https://github.com/neylwalecki/leads2b-mcp/releases).

Mantenha essa pasta no computador que executará o MCP. O ponto de entrada é `dist/index.js`. Não é necessário manter `npm start` aberto: o cliente inicia o processo.

[Obtenha os tokens na Leads2b](API-TOKENS.md) antes de configurar a conexão.

## Codex app: configuração local

Abra o arquivo de configuração do usuário, preservando as entradas existentes:

- macOS/Linux: `~/.codex/config.toml`.
- Windows: `%USERPROFILE%\.codex\config.toml`.
- Se você definiu `CODEX_HOME`, use o `config.toml` desse diretório.

Adicione uma única entrada `leads2b`. Substitua os caminhos e os dois valores `<TOKEN>` pelos dados locais.

Exemplo para Windows nativo:

```toml
[mcp_servers.leads2b]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\Tools\leads2b-mcp\dist\index.js']
enabled = true

[mcp_servers.leads2b.env]
LEADS2B_API_V1_TOKEN = '<TOKEN>'
LEADS2B_API_V2_TOKEN = '<TOKEN>'
LEADS2B_WRITE_MODE = 'disabled'
LEADS2B_ENABLE_RAW_API = 'false'
```

No macOS/Linux, use o mesmo bloco com os caminhos locais, por exemplo:

```toml
[mcp_servers.leads2b]
command = '/opt/homebrew/bin/node'
args = ['/Users/seu-usuario/Tools/leads2b-mcp/dist/index.js']
enabled = true

[mcp_servers.leads2b.env]
LEADS2B_API_V1_TOKEN = '<TOKEN>'
LEADS2B_API_V2_TOKEN = '<TOKEN>'
LEADS2B_WRITE_MODE = 'disabled'
LEADS2B_ENABLE_RAW_API = 'false'
```

Use `command -v node` no macOS/Linux ou `(Get-Command node).Source` no PowerShell para encontrar o executável. Em WSL, use Node e caminhos Linux dentro do WSL; não misture o exemplo Windows nativo com esse ambiente.

Reinicie o servidor MCP pela interface, quando disponível, ou reabra o Codex app. No CLI, `codex mcp list` confirma o cadastro e `/mcp` mostra as conexões da sessão.

Os tokens ficam no arquivo local de configuração. Não grave esse bloco com credenciais em um repositório nem o compartilhe. Se já existir uma conexão Leads2b direta ou por proxy, atualize a entrada existente para evitar duplicatas.

## ChatGPT

O ChatGPT conecta-se a servidores MCP remotos, não diretamente a processos STDIO locais. Este projeto não fornece endpoint HTTP/SSE nem adaptador remoto. A configuração `config.toml` acima pertence ao Codex e não instala um conector no ChatGPT. Consulte os [requisitos oficiais de MCP no ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt) para integrações remotas.

## Conferir a conexão

Peça ao assistente:

> Execute `leads2b_health_check` e informe autenticação, contexto de usuário e restrições, sem exibir tokens. Depois execute `leads2b_normalize_source` com `utm_source` igual a `chatgpt.com` e `host` igual a `example.com`.

A normalização é local. O health check informa os resultados dos endpoints testados; não comprova permissão em toda a API. Depois faça uma consulta conhecida da sua conta. Comece em `disabled`; `preview` permite inspecionar operações sem alterar registros. `live` habilita alterações reais, respeitando as aprovações do cliente.

Se o servidor não iniciar, confira o caminho do Node, a existência de `dist/index.js`, as dependências instaladas e os logs de inicialização. Um cadastro visível no CLI não prova que o processo conectou no app.

## Referências oficiais

- [MCP no Codex e no aplicativo desktop](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

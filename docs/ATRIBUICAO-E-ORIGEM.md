# Atribuição e Origem

Este documento descreve o modelo público usado pelo MCP para interpretar origem e atribuição. Ele não substitui a regra oficial da Leads2b nem promete compatibilidade com todos os cenários da plataforma.

## Conceitos

## Modelo de Atribuição do MCP

O MCP separa três camadas:

### 1. Origem Cadastral

Campo de CRM. Exemplo:

```txt
Origem: Site
```

Uso:

- Distribuição comercial.
- Relatórios operacionais.
- Regras internas.
- Filtros de CRM.

### 2. Evidência Bruta

Dados observados em eventos de conversão/tracking:

```txt
utm_source
utm_medium
utm_campaign
utm_term
utm_content
gclid / g_clid
fbclid / fb_clid
host
referrer
created_at
```

Uso:

- Diagnóstico real de marketing.
- First touch e last touch.
- Auditoria de campanhas.
- Identificação de fontes novas, como ChatGPT e outros LLMs.

### 3. Classificação do Fornecedor

Campo calculado ou resumido pela Leads2b:

```txt
lead_origin
```

Uso:

- Comparação.
- Alerta de divergência.
- Entendimento de como a Leads2b está classificando.

No diagnóstico local do MCP, esse campo é exibido como sinal, mas não sobrescreve UTMs, click IDs ou referrer.

## Regras de Normalização

Ordem de prioridade:

1. Se `gclid` ou `g_clid` existir, classificar como `paid_search`, normalmente Google Ads.
2. Se `fbclid` ou `fb_clid` existir e houver evidência social, classificar como Meta/Social.
3. Se `utm_source` for um domínio de LLM ou IA, classificar como `ai_referral`.
4. Se `utm_medium` indicar pago (`cpc`, `ppc`, `paid`, `paid_search`), classificar como mídia paga.
5. Se `utm_medium` indicar orgânico (`organic`, `organic_search`), classificar como orgânico.
6. Se houver `utm_source` ou referrer externo, classificar como referral.
7. Se não houver fonte, referrer, UTM ou click ID, classificar como direto.
8. Se os sinais forem conflitantes, retornar baixa confiança e listar evidências.

## Fontes de IA

Mapeamento inicial:

| Domínio/Fonte | Classificação sugerida |
|---|---|
| `chatgpt.com` | `AI / LLM Referral` |
| `chat.openai.com` | `AI / LLM Referral` |
| `perplexity.ai` | `AI / LLM Referral` |
| `claude.ai` | `AI / LLM Referral` |
| `gemini.google.com` | `AI / LLM Referral` |
| `copilot.microsoft.com` | `AI / LLM Referral` |
| `poe.com` | `AI / LLM Referral` |

## First Touch e Last Touch

Com eventos retornados por entidade, o MCP calcula:

- First touch observado: primeiro evento retornado em ordem cronológica.
- Last touch observado: último evento retornado em ordem cronológica.
- Conversão: evento de formulário/conversão.
- Tracking: evento de acesso/página.

Limitação importante: o MCP só calcula com os eventos que a API retorna. Por isso, a saída usa `first touch observado`, não `first touch absoluto`.

## Exemplo

Evento de tracking:

```json
{
  "created_at": "2026-05-19T14:16:18.000Z",
  "utm_source": "chatgpt.com",
  "utm_medium": null,
  "utm_campaign": null,
  "g_clid": null,
  "lead_origin": null,
  "host": "example.com"
}
```

Evento de conversão:

```json
{
  "created_at": "2026-05-19T14:16:58.000Z",
  "utm_source": "chatgpt.com",
  "utm_medium": null,
  "utm_campaign": null,
  "g_clid": null,
  "lead_origin": "organic | Twitter",
  "host": "example.com"
}
```

Diagnóstico esperado do MCP:

```txt
Fonte bruta observada: chatgpt.com
Classificação normalizada: AI / LLM Referral
Origem da conversão Leads2b: organic | Twitter
Alerta: classificação da Leads2b diverge da fonte UTM bruta.
```

## Campos Recomendados Para Relatórios

Relatórios do MCP devem sempre mostrar, lado a lado:

- Origem cadastral.
- Origem da conversão da Leads2b.
- UTM source.
- UTM medium.
- UTM campaign.
- Click IDs.
- Host/domínio.
- First touch observado.
- Last touch observado.
- Classificação normalizada do MCP.
- Divergências.

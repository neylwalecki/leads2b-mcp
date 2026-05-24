# Atribuição e Origem

O MCP separa origem cadastral, evidência bruta e classificação resumida da Leads2b.

## Camadas

| Camada | Exemplos | Uso |
|---|---|---|
| Origem cadastral | Origem do CRM | Operação, filtros e relatórios internos. |
| Evidência bruta | UTMs, click IDs, referrer, host, datas | Diagnóstico de marketing e jornada. |
| Classificação Leads2b | `lead_origin` | Comparação e alerta de divergência. |

No diagnóstico local, UTMs, click IDs e referrer têm prioridade sobre campos resumidos.

## Normalização

Ordem geral:

1. `gclid`/`g_clid` -> `paid_search`.
2. `fbclid`/`fb_clid` com sinal social -> `paid_social`.
3. Domínios de IA/LLM -> `ai_referral`.
4. `utm_medium` pago -> mídia paga.
5. `utm_medium` orgânico -> orgânico.
6. Referrer ou `utm_source` externo -> referral.
7. Sem sinal de origem -> direct.
8. Sinais conflitantes -> baixa confiança e evidências listadas.

Fontes de IA mapeadas inicialmente:

- `chatgpt.com`
- `chat.openai.com`
- `perplexity.ai`
- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com`
- `poe.com`

## First Touch e Last Touch

O MCP calcula:

- First touch observado.
- Last touch observado.
- Eventos de conversão.
- Eventos de tracking.
- Divergências entre evidência bruta e `lead_origin`.
- Diagnóstico em lote por registros ou buscas, sem interromper o lote inteiro quando uma entidade não tiver eventos.

O termo “observado” é intencional: o cálculo usa apenas eventos retornados pela API.

## Campos Úteis em Relatórios

- Origem cadastral.
- `lead_origin`.
- `utm_source`, `utm_medium`, `utm_campaign`.
- Click IDs.
- Host/referrer.
- First touch observado.
- Last touch observado.
- Última conversão.
- Classificação normalizada.
- Divergências.

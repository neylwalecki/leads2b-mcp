# Atribuição e origem

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
2. `fbclid`/`fb_clid` -> `paid_social`.
3. Domínios de IA/LLM -> `ai_referral`.
4. `utm_medium` pago -> mídia paga.
5. `utm_medium` orgânico -> orgânico.
6. Referrer ou `utm_source` externo -> referral.
7. Sem sinal de origem e sem host -> `unknown`, com confiança baixa.
8. Host presente sem UTM, click ID ou referrer externo -> `direct`, com confiança baixa.

Divergências com `lead_origin` são informadas separadamente; não alteram automaticamente o canal nem a confiança.

Fontes de IA reconhecidas:

- `chatgpt.com`
- `chat.openai.com`
- `perplexity.ai`
- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com`
- `poe.com`

## First touch e last touch

O MCP calcula:

- First touch observado.
- Last touch observado.
- Eventos de conversão.
- Eventos de tracking.
- Divergências entre evidência bruta e `lead_origin`.
- Diagnóstico em lote por registros ou buscas, sem interromper o lote inteiro quando uma entidade não tiver eventos.

O termo “observado” é intencional: o cálculo usa apenas eventos retornados pela API.

## Campos úteis em relatórios

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

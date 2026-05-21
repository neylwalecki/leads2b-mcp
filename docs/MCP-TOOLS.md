# Ferramentas MCP

Este documento descreve as ferramentas read-only implementadas no MVP.

## Convenções de Design

Todas as ferramentas devem retornar JSON estruturado e, quando útil, uma síntese em texto para agentes.

Campos comuns de retorno:

```ts
type ToolResult<T> = {
  ok: boolean;
  data?: T;
  summary?: string;
  warnings?: string[];
  source: {
    api: "v1" | "v2" | "snippet" | "local";
    endpoint?: string;
    stability: "confirmed" | "observed" | "experimental" | "unknown";
  };
};
```

Erros devem ser estruturados:

```ts
type ToolError = {
  ok: false;
  error: {
    status?: number;
    code?: string;
    message: string;
    endpoint?: string;
    details?: unknown;
  };
};
```

## Ferramentas do MVP

| Ferramenta | API | Endpoint | Finalidade |
|---|---|---|---|
| `leads2b_health_check` | v1/v2 | vários | Validar tokens, bases e disponibilidade. |
| `leads2b_get_logged_user` | v1 | `/user/logged/` | Retornar usuário autenticado do token v1. |
| `leads2b_list_users` | v2 | `/users` | Listar usuários da conta. |
| `leads2b_list_origins` | v1 | `/origin/index/` | Listar origens cadastrais. |
| `leads2b_list_pipelines` | v1 | `/pipeline/active` | Listar funis/pipelines ativos. |
| `leads2b_list_forms` | v1 | `/form/index` | Listar formulários conhecidos pela API v1. |
| `leads2b_get_lead_columns` | v1 | `/lead/columns` | Listar colunas/campos de lead. |
| `leads2b_list_customers` | v1 | `/customer/index` | Listar clientes existentes e obter IDs candidatos. |
| `leads2b_find_customer` | v1/local | `/customer/index` | Buscar customer por e-mail, telefone, documento, nome ou texto. |
| `leads2b_search_customers` | v2 | `/customer?search={search}` | Buscar customers com filtro server-side. |
| `leads2b_get_customer` | v2 | `/customer/{id}` | Consultar detalhe de customer por ID. |
| `leads2b_get_lead_detail` | v1 | `/lead/index/{id}/defaultLead` | Consultar detalhe de lead por ID. |
| `leads2b_list_webhooks` | v2 | `/webhooks` | Listar webhooks configurados. |
| `leads2b_get_snippet_config` | v2 | `/integrations/config/token` | Obter token público do snippet. |
| `leads2b_get_snippet_script` | v2 | `/integrations/config/script` | Obter script oficial do snippet. |
| `leads2b_get_conversions` | v2 | `/conversions` | Consultar conversões por `id` e `entity`. |
| `leads2b_get_tracking` | v2 | `/conversions/tracking` | Consultar tracking por `id` e `entity`. |
| `leads2b_normalize_source` | local | local | Classificar origem com base em UTMs/referrer/click IDs. |
| `leads2b_find_attribution_candidates` | v1/v2/local | `/customer/index` + conversões/tracking | Encontrar IDs existentes com eventos de atribuição. |
| `leads2b_diagnose_attribution` | v2/local | conversões + tracking | Diagnosticar first/last touch e inconsistências. |
| `leads2b_diagnose_customer_attribution` | v1/v2/local | `/customer/index` + conversões/tracking | Buscar customer por critério e diagnosticar eventos em um só passo. |

## Detalhes das Ferramentas

### `leads2b_health_check`

Entrada:

```ts
type Input = {
  includeSnippet?: boolean;
};
```

Saída esperada:

- Token v1 configurado: sim/não.
- Token v1 válido: sim/não.
- Token v2 configurado: sim/não.
- Token v2 válido: sim/não.
- Expiração do token v2, se detectável no JWT.
- Ferramentas disponíveis.

### `leads2b_list_customers`

Entrada:

```ts
type Input = {
  limit?: number;
  offset?: number;
  search?: string;
  summaryOnly?: boolean;
};
```

Comportamento:

- Sem opções, retorna a resposta integral de `GET /api/v1/customer/index`.
- Com opções, aplica filtro local sobre `data.customers[]`.
- `summaryOnly=true` reduz o volume de campos retornados, mas não mascara dados.
- Útil para encontrar IDs candidatos antes de chamar `get_conversions`, `get_tracking` ou `diagnose_attribution`.

### `leads2b_find_customer`

Entrada:

```ts
type Input = {
  search?: string;
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
  limit?: number;
  offset?: number;
  summaryOnly?: boolean;
};
```

Comportamento:

- Buscar `GET /api/v1/customer/index`.
- Filtrar localmente por um ou mais critérios.
- Exigir pelo menos um critério.
- Retornar dados reais da conta autenticada.
- Servir como fallback enquanto não houver endpoint confiável de busca por e-mail/telefone na API v2.

### `leads2b_search_customers`

Entrada:

```ts
type Input = {
  search: string;
};
```

Comportamento:

- Chamar `GET /api/v2/customer?search={search}`.
- Retornar a resposta integral da conta autenticada.
- Útil para busca server-side por e-mail, nome ou texto aceito pela API.

### `leads2b_get_customer`

Entrada:

```ts
type Input = {
  id: string | number;
};
```

Comportamento:

- Chamar `GET /api/v2/customer/{id}`.
- Retornar o detalhe do customer.

### `leads2b_get_lead_detail`

Entrada:

```ts
type Input = {
  id: string | number;
};
```

Comportamento:

- Chamar `GET /api/v1/lead/index/{id}/defaultLead`.
- Retornar o detalhe do lead.

### `leads2b_get_conversions`

Entrada:

```ts
type Input = {
  id: string | number;
  entity: "LEAD" | "CONTACT" | "OPPORTUNITY";
};
```

Comportamento:

- Chamar `GET /api/v2/conversions?id={id}&entity={entity}`.
- Ordenar eventos por data quando possível.
- Retornar a resposta integral da conta autenticada.

### `leads2b_get_tracking`

Entrada:

```ts
type Input = {
  id: string | number;
  entity: "LEAD" | "CONTACT" | "OPPORTUNITY";
};
```

Comportamento:

- Chamar `GET /api/v2/conversions/tracking?id={id}&entity={entity}`.
- Ordenar eventos por data quando possível.
- Destacar UTMs, `g_clid`, `fb_clid`, `host` e `lead_origin`.

### `leads2b_normalize_source`

Entrada:

```ts
type Input = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  g_clid?: string | null;
  fbclid?: string | null;
  fb_clid?: string | null;
  referrer?: string | null;
  host?: string | null;
  vendorLeadOrigin?: string | null;
};
```

Saída:

```ts
type Output = {
  normalizedSource: string;
  normalizedMedium?: string;
  channel: "paid_search" | "organic_search" | "paid_social" | "organic_social" | "ai_referral" | "referral" | "direct" | "unknown";
  confidence: "high" | "medium" | "low";
  evidence: string[];
  vendorDisagreement?: {
    vendorLeadOrigin?: string | null;
    reason: string;
  };
};
```

### `leads2b_find_attribution_candidates`

Entrada:

```ts
type Input = {
  limit?: number; // padrão 25, máximo 100
  entities?: Array<"LEAD" | "CONTACT" | "OPPORTUNITY">;
  onlyWithEvents?: boolean; // padrão true
};
```

Comportamento:

- Buscar clientes existentes em `GET /api/v1/customer/index`.
- Testar cada `customer.id` na API v2 de conversões e tracking.
- Retornar candidatos com contagem de eventos por entidade.
- Não substitui busca por e-mail; é um atalho read-only para descobrir IDs úteis de diagnóstico.

Saída resumida:

```ts
type Output = {
  scannedCustomers: number;
  entities: Array<"LEAD" | "CONTACT" | "OPPORTUNITY">;
  onlyWithEvents: boolean;
  candidates: Array<{
    customerId: string;
    name?: string;
    companyName?: string;
    entities: Array<{
      entity: "LEAD" | "CONTACT" | "OPPORTUNITY";
      conversionsCount: number;
      trackingCount: number;
    }>;
  }>;
};
```

### `leads2b_diagnose_attribution`

Entrada:

```ts
type Input = {
  id: string | number;
  entity: "LEAD" | "CONTACT" | "OPPORTUNITY";
  includeRaw?: boolean;
};
```

### `leads2b_diagnose_customer_attribution`

Entrada:

```ts
type Input = {
  search?: string;
  email?: string;
  phone?: string;
  document?: string;
  name?: string;
  entities?: Array<"LEAD" | "CONTACT" | "OPPORTUNITY">;
  customerLimit?: number;
  includeRaw?: boolean;
};
```

Comportamento:

- Busca customers na v1 usando os critérios informados.
- Para cada customer encontrado, consulta conversões e tracking na v2 para as entidades solicitadas.
- Calcula diagnóstico local de first touch observado, last touch observado e divergências.
- Trata combinações v2 sem entidade/eventos como vazias quando a API retorna `400`, `404` ou `422`.
- Retorna dados reais da conta autenticada.

Comportamento:

- Buscar tracking.
- Buscar conversões.
- Ordenar eventos.
- Calcular first touch observado.
- Calcular last touch observado.
- Comparar UTMs brutas com `lead_origin`.
- Gerar alertas.
- Quando `includeRaw=true`, incluir o evento bruto retornado pela API sem mascaramento.

Saída resumida:

```ts
type Output = {
  entity: "LEAD" | "CONTACT" | "OPPORTUNITY";
  id: string;
  firstTouch?: AttributionEvent;
  lastTouch?: AttributionEvent;
  conversions: AttributionEvent[];
  tracking: AttributionEvent[];
  warnings: string[];
  recommendation?: string;
};
```

## Ideias Para Próximas Versões

| Ferramenta | Finalidade | Status |
|---|---|---|
| `leads2b_find_entity_by_email` | Buscar lead/contato/oportunidade por e-mail. | Pesquisa |
| `leads2b_get_opportunity_or_contact` | Buscar oportunidade/contato por ID. | Pesquisa |
| `leads2b_export_entities_by_origin` | Gerar relatório de entidades agrupadas por origem. | Pesquisa |
| `leads2b_get_form_integrations` | Auditar configurações específicas por formulário. | Pesquisa |

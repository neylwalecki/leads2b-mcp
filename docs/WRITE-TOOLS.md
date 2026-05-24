# Ferramentas de Escrita

## Modos

```txt
LEADS2B_WRITE_MODE=disabled
LEADS2B_WRITE_MODE=preview
LEADS2B_WRITE_MODE=live
```

- `disabled`: Não registra ferramentas de escrita.
- `preview`: Registra ferramentas de escrita, mas retorna apenas o plano da operação.
- `live`: Executa creates e updates simples diretamente.

`LEADS2B_ENABLE_WRITE_TOOLS=true` ainda é aceito como compatibilidade temporária e equivale a `preview` quando `LEADS2B_WRITE_MODE` não foi definido.

## Customers

| Ferramenta | API | Endpoint | Status |
|---|---|---|---|
| `leads2b_create_customer` | v2 | `POST /customer` | Experimental |
| `leads2b_update_customer` | v2 | `PATCH /customer/{id}` | Experimental |

Entrada:

```ts
type CreateCustomerInput = {
  fields: Record<string, unknown>;
};

type UpdateCustomerInput = {
  id: string | number;
  fields: Record<string, unknown>;
};
```

Em `preview`, o retorno inclui `method`, `endpoint`, `fields`, `mode` e `executed=false`.

Em `live`, a chamada é enviada para a API da Leads2b e o retorno bruto autenticado fica em `data.result`.

## Raw API

`leads2b_api_request` só é registrado com:

```txt
LEADS2B_ENABLE_RAW_API=true
```

Entrada:

```ts
type RawApiInput = {
  api: "v1" | "v2";
  method: "GET" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  body?: unknown;
  confirm_destructive?: boolean;
};
```

Regras:

- `GET` e `OPTIONS` executam diretamente.
- `POST`, `PUT` e `PATCH` respeitam `LEADS2B_WRITE_MODE`.
- `DELETE`, caminhos com `bulk`, `delete`, `destroy` ou `merge` exigem `confirm_destructive=true` em modo `live`.

## CRUD Investigado

| Área | Status no MCP |
|---|---|
| Customers | Lista, busca, detalhe, create experimental e update experimental. |
| Leads | Detalhe por ID via v1 e listagem observada via `/deals?entity=LEAD`; criação externa de lead segue como contrato separado e não virou ferramenta normal nesta versão. |
| Oportunidades/deals | Listagem observada via `/deals?entity=OPPORTUNITY`, contadores e eventos de atribuição; CRUD direto ainda não confiável. |
| Contatos | Eventos de atribuição por `CONTACT`; CRUD direto ainda não confiável. |
| Atividades | Eventos de calendário somente leitura; CRUD direto ainda não confiável. |

Contratos não documentados permanecem marcados como experimentais, observados ou desconhecidos.

As ferramentas de operação comercial (`leads2b_find_records`, `leads2b_list_recent_opportunities`, `leads2b_get_record_detail` e `leads2b_get_lead_ops_candidates`) são somente leitura e não alteram o contrato de escrita.

# Ferramentas de Escrita

O servidor é read-only por padrão. Ferramentas de escrita só são registradas quando o usuário habilita explicitamente:

```txt
LEADS2B_ENABLE_WRITE_TOOLS=true
```

## Contrato de Segurança

Toda ferramenta de escrita deve exigir:

- `dry_run=true` por padrão.
- `confirm_live=true` para execução real.
- `reason` obrigatório.
- Resultado estruturado com `executed`.
- Operações em lote somente em fase própria, com plano de recuperação.

## Ferramentas Disponíveis

### `leads2b_update_customer`

Atualiza um customer pela API v2.

Endpoint experimental:

```http
PATCH /api/v2/customer/{id}
```

Entrada:

```ts
type Input = {
  id: string | number;
  fields: Record<string, unknown>;
  dry_run?: boolean;
  confirm_live?: boolean;
  reason: string;
};
```

Dry-run:

```json
{
  "id": 123,
  "fields": {
    "name": "Example"
  },
  "reason": "Update requested by the account owner."
}
```

Execução real:

```json
{
  "id": 123,
  "fields": {
    "name": "Example"
  },
  "dry_run": false,
  "confirm_live": true,
  "reason": "Update requested by the account owner."
}
```

## Status

`leads2b_update_customer` está marcado como experimental porque o repositório não executa mutação live em testes automáticos. Antes de tratar o contrato como estável, valide em uma conta de teste ou em um registro descartável.

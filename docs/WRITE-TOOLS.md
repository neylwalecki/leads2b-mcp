# Ferramentas de Escrita

## Estado Atual

Na `v0.1.0`, escrita é experimental e fica desabilitada por padrão:

```txt
LEADS2B_ENABLE_WRITE_TOOLS=true
```

Ferramenta disponível:

| Ferramenta | API | Endpoint |
|---|---|---|
| `leads2b_update_customer` | v2 | `PATCH /api/v2/customer/{id}` |

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

## Próximo Modelo

A próxima versão deve trocar o gate por chamada pelo modo operacional:

```txt
LEADS2B_WRITE_MODE=disabled
LEADS2B_WRITE_MODE=preview
LEADS2B_WRITE_MODE=live
```

Direção pretendida:

- `disabled`: não registra ferramentas de escrita.
- `preview`: registra escrita, mas retorna plano sem alterar dados.
- `live`: permite criação e atualização direta.
- Delete e operações em lote continuam exigindo confirmação explícita.

## Escopo de CRUD Planejado

- Customers.
- Leads.
- Oportunidades/deals.
- Contatos.
- Atividades/agendamentos.
- Tags, origens e campos customizados quando o contrato da API permitir.

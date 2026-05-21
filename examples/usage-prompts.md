# Usage Prompts

Use these examples in an MCP-capable client after configuring the Leads2b server.

## Health Check

```txt
Call `leads2b_health_check` and summarize which APIs are configured, which APIs responded, and which tools are available.
```

## Find a Customer

```txt
Use `leads2b_search_customers` to search for `lead@example.com`. If no result appears, use `leads2b_find_customer` with `summaryOnly=true`.
```

## Diagnose Attribution

```txt
Find the customer matching `lead@example.com`, then run `leads2b_diagnose_customer_attribution` for `LEAD` and `OPPORTUNITY`. Explain first touch, last touch, and divergences.
```

## Calendar and Activity Review

```txt
Use `leads2b_list_calendar_events` for the current week with calendars `["leads2b"]` and types `["action", "meet"]`. Group the returned events by type and responsible user.
```

## Deals by Pipeline

```txt
Use `leads2b_list_pipelines_by_entity` for `OPPORTUNITY`, identify the relevant pipeline ID, then call `leads2b_count_deals` for status `lost`.
```

## Receita/CNPJ Lookup

```txt
Use `leads2b_get_receita_by_cnpj` with a sanitized or user-provided CNPJ, then summarize company registration fields returned by the account.
```

## Customer Update Dry-Run

Requires `LEADS2B_ENABLE_WRITE_TOOLS=true`.

```txt
Call `leads2b_update_customer` with `dry_run` omitted, `id=123`, `fields={"name":"Example"}`, and `reason="Update requested by the account owner."` Show the planned request and confirm that no live change was sent.
```

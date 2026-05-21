# Changelog

## 0.2.0

- Replaced per-call dry-run write gating with `LEADS2B_WRITE_MODE=disabled|preview|live`.
- Added experimental `leads2b_create_customer`.
- Simplified `leads2b_update_customer` for direct live updates when write mode is `live`.
- Added advanced `leads2b_api_request` behind `LEADS2B_ENABLE_RAW_API=true`.
- Documented current CRUD confidence for customers, leads, opportunities, contacts, and activities.

## 0.1.0

- Added MCP `stdio` server for Leads2b.
- Added separate HTTP clients for API v1 and API v2.
- Added read-only tools for users, origins, pipelines, forms, columns, customers, webhooks, snippet config, conversions, tracking, dashboard counts, tags, actions, campaigns, flows, segmentations, calendar events, CNAEs, and Receita/CNPJ lookup.
- Added local customer search, attribution candidate discovery, source normalization, and attribution diagnosis.
- Added opt-in experimental write tool `leads2b_update_customer` with dry-run default, live confirmation, and required reason.
- Added unit tests, MCP stdio smoke tests, and opt-in live integration tests.

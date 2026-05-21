# Contributing

Thanks for considering a contribution.

## Local Setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Data Hygiene

Do not include real Leads2b tokens, authorization headers, account data, lead data, customer data, or raw API dumps.

Use placeholders such as:

- `<TOKEN>`
- `lead@example.com`
- `example.com`
- Fictitious IDs and phone numbers.

## Endpoint Changes

When adding endpoints:

- Keep API v1 and API v2 clients separate.
- Mark undocumented contracts as `observed` or `experimental`.
- Add tests without external calls.
- Add opt-in integration coverage only when the call is read-only.

## Write Tools

Write behavior must be explicit in configuration:

- `disabled`: no write tools.
- `preview`: write tools return the planned request.
- `live`: simple creates and updates may execute directly.

Deletes and bulk writes need stronger confirmation and a recovery plan.

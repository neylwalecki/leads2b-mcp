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

Do not include real Leads2b tokens, authorization headers, lead names, e-mails, phone numbers, customer names, screenshots, or raw API dumps.

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

Write tools must be opt-in and must require:

- `dry_run=true` by default.
- `confirm_live=true` for live execution.
- `reason` for every live operation.
- A structured result with `executed` status.

Do not add bulk write tools without a separate design and recovery plan.

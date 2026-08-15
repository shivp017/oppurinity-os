# Opportunity OS

The initial product workspace for an opportunity intelligence platform: profiles/personas, compliant opportunity ingestion, explainable matching, application tracking, and later client acquisition.

## Current slice

- Responsive dashboard shell with isolated persona selection
- Opportunity cards with type, match, freshness, source, and confidence
- Domain types and typed demo data ready to be replaced by API queries
- Architecture baseline: `docs/architecture.md` (copy from the approved architecture package during implementation)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run with Docker

```bash
docker compose up --build
```

Then open `http://localhost:3000`. Stop it with `docker compose down`.

## Next build steps

1. Add database schema and organization/persona authorization boundary.
2. Implement resume upload, versioning, parsing jobs, and evidence-backed profile extraction.
3. Add one permitted ATS connector, normalized opportunity storage, lineage, deduplication, and a matching API.
4. Replace dashboard fixtures with authenticated API data and add audit events.

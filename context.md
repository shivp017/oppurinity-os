# Opportunity OS — Working Context

## Product vision

Opportunity OS is a multi-persona opportunity intelligence platform. It helps an individual, freelancer, consultant, or agency continuously find credible ways their skills can generate income:

- Full-time, part-time, contract, freelance, and internship opportunities
- Client opportunities for services such as HubSpot, RevOps, automation, development, and marketing operations
- High-confidence, explainable recommendations instead of a large unfiltered job list

The core loop is:

`DISCOVER → NORMALIZE → DEDUPLICATE → VALIDATE → ENRICH → SCORE → RECOMMEND → PERSONALIZE → APPLY / OUTREACH → TRACK → LEARN`

Accuracy, freshness, provenance, user consent, and tenant/profile isolation matter more than scrape volume or autonomous actions.

## Architecture decisions

- Start as a modular TypeScript/Next.js application backed by PostgreSQL, not microservices.
- Use Docker Compose locally with `web` (Next.js) and `db` (PostgreSQL 16) services.
- Keep AI advisory and schema-constrained; deterministic policies control actions.
- Preserve data lineage for every externally sourced opportunity field.
- Use replaceable connector/provider interfaces for ATS, enrichment, AI, CRM, and email integrations.
- Treat application/outreach automation as policy-gated, consented, audited, and idempotent.
- Do not bypass protected websites, CAPTCHA controls, terms of service, or source restrictions.
- Do not fabricate resume experience or company personalization.

## Authentication decision

Authentication, tenant enforcement, RBAC, OAuth, and MFA are intentionally deferred until pre-deployment. Until then, this is a **single local development workspace**.

The database and API design should remain ready to add organizations, memberships, and persona-scoped authorization before any shared or production deployment.

## Current implementation

### Foundation — complete

- Next.js 16 / TypeScript application
- Responsive dashboard UI with warm neutral aesthetic
- Dockerfile and `compose.yaml`
- PostgreSQL-backed local persistence
- Production build and dependency audit pass

### Persona and opportunity workflow — complete

- Multiple personas in the local workspace
- Create a persona through the dashboard
- Profile-specific opportunity records
- Dashboard recommendations and type filters
- Opportunity Inbox: `/opportunities` with real-time keyword/skill search
- Opportunity detail view: `/opportunities/:id?profileId=:profileId`
- Match explanation, source/freshness details, and action history
- Persisted status lifecycle: `RECOMMENDED`, `SAVED`, `APPLICATION_PREPARING`
- Persisted application drafts and Applications page: `/applications` with multi-stage tracker (`PREPARING`, `READY_FOR_REVIEW`, `SUBMITTED`, `INTERVIEWING`, `OFFER`) and interview prep notes.

### Profile intelligence & multi-factor matching — complete

- Persona-specific Profile Settings page: `/profiles/:id`
- PDF/DOCX resume upload with 5 MB upload limit
- Skills & tech stack tag manager with interactive tag insertion
- Target compensation and hourly rate expectations (`minHourlyRate`, `minAnnualComp`)
- Work authorization multi-selection (US Citizen, Green Card, Authorized, C2C)
- Availability dropdown (Immediate, 2 weeks, 1 month, Flexible)
- Multi-factor deterministic scoring engine (`lib/matching.ts`):
  - Target role title alignment (25 pts)
  - Skills & tech stack overlap (20 pts)
  - Remote/location eligibility (10 pts)
  - Compensation disclosure & alignment (8 pts)
  - Opportunity kind match (5 pts)
  - Itemized explainable match `reasons` generated automatically

### Discovery intelligence & ATS connectors — complete

- Dedicated Discovery & Ingestion Hub: `/discovery`
- Three structured public ATS connectors with zero scraping:
  - **Greenhouse Public Board API**: `boards-api.greenhouse.io/v1/boards/{boardToken}/jobs`
  - **Ashby Public Job Board API**: `api.ashbyhq.com/posting-api/job-board/{boardToken}`
  - **Lever Public Postings API**: `api.lever.co/v0/postings/{companyToken}`
  - **Manual Import Connector**: Schema validation and provenance hashing
- Automated Search Agents (`/api/search-agents` and `/api/search-agents/:id/run`):
  - Configure target ATS board, frequency, keyword filters per persona
  - On-demand execution, telemetry tracking, and auto-recommendation creation
- Source Registry & Ingestion Runs feed:
  - Live history of sync runs, status badges, fetched record counts, execution time, and error logs
- Controlled Manual Importer & Tester tool for JSON payloads with direct validation

### Client acquisition & outreach studio — complete

- Interactive Client Pipeline CRM: `/client-pipeline`
- Full pipeline stage progression: `DISCOVERED` → `QUALIFIED` → `OUTREACH_READY` → `CONTACTED` → `RESPONDED` → `CONVERTED` (plus `DISQUALIFIED`)
- Interactive Lead Drawer:
  - Strict visual and conceptual separation of **Verified Source Facts** vs **AI Advisory Inference**
  - Company Details (Domain, Industry, Employee Range)
  - Service Profiles manager: attach persona-specific offerings (e.g. HubSpot CRM Architecture, Next.js Dev)
  - Contacts & Consent management with suppression list checks (`PERMITTED`, `UNKNOWN`, `OPTED_OUT`)
  - Outreach Studio: Compose and review customized drafts referencing verified facts, with 1-click policy approval (sending remains disabled for safety)
- Safety & Policy Layer:
  - Audit log recording (`/api/audit-events`)
  - Idempotency protection (`Idempotency-Key` header with replay)
  - Rate limiting per endpoint window (`lib/rate-limit.ts`)

## Current data model

- `profiles`: persona name, role, state, opportunity count
- `opportunities`: normalized attributes, match score, confidence, source, reasons, url, description, provenance keys
- `profile_opportunities`: profile-specific recommendation/action state
- `applications`: application records, stage lifecycle, notes, resume version link, external url
- `resumes`: profile-specific resume metadata and storage key
- `profile_preferences`: target titles, preferred kinds, remote-only, min score, skills, min rates, work auth, availability
- `sources` and `source_records`: connector metadata and immutable imported payload provenance
- `ingestion_runs`: telemetry runs for ATS and search agent syncs
- `search_agents`: persona-scoped automated search agent configurations
- `service_profiles`: client service offerings linked to personas
- `companies`: company directory with domain, industry, and employee range
- `client_opportunities`: buying signals, pipeline stage, verified facts JSON, AI inference
- `contacts`: verified contacts with consent status
- `outreach_drafts`: personalized outreach drafts with approval status
- `suppressions`: global email suppression list
- `audit_events`: immutable audit trail
- `idempotency_records`: idempotency keys and cached responses
- `rate_limit_windows`: sliding rate limiting counters

## Local runbook

```bash
cd /Users/shivsingh/Desktop/Projects/opportunity-os
docker compose up --build
```

Open `http://localhost:3000`.

Useful pages:

- Dashboard: `http://localhost:3000`
- Opportunity Inbox: `http://localhost:3000/opportunities`
- Discovery & Search Agents Hub: `http://localhost:3000/discovery`
- Client Pipeline CRM: `http://localhost:3000/client-pipeline`
- Applications Tracker: `http://localhost:3000/applications`
- Profile Settings: `http://localhost:3000/profiles/revops`
- API contract: `http://localhost:3000/api/openapi`

Stop local services:

```bash
docker compose down
```

## Build roadmap

1. **Foundation** — complete
2. **Opportunity operations** — complete
3. **Profile intelligence & matching** — complete
4. **Discovery intelligence & ATS connectors** — complete
5. **Client acquisition & outreach studio** — complete
6. **Production preparation** — next
   - Authentication (NextAuth / Clerk / Auth0), multi-tenant organization isolation, RBAC, encrypted secrets, scheduled background cron runner for Search Agents, observability (OpenTelemetry / Sentry), deployment CI/CD.

## Important constraints

- A persona's resume and preferences must never be silently used for another persona.
- Every automated external action needs a policy decision, audit record, and idempotency protection.
- Source confidence and field provenance must be visible to users.
- Missing or uncertain data must be represented as uncertain, not treated as confirmed.
- AI inferences are strictly advisory and separated from empirical verified facts.

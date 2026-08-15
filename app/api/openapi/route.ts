import { NextResponse } from "next/server";

const openApiSchema = {
  openapi: "3.1.0",
  info: {
    title: "Opportunity OS API",
    version: "0.2.0",
    description:
      "Opportunity intelligence and discovery platform API. Includes structured ATS connectors (Greenhouse, Ashby, Lever), search agents, client pipeline CRM, outreach safety gating, and persona intelligence.",
  },
  paths: {
    "/api/health": {
      get: { summary: "Health check" },
    },
    "/api/profiles": {
      get: { summary: "List personas" },
      post: { summary: "Create persona" },
    },
    "/api/profiles/{id}": {
      get: { summary: "Read profile and matching preferences" },
      patch: { summary: "Update matching preferences, skills, rates, and authorization" },
    },
    "/api/profiles/{id}/resume": {
      get: { summary: "List persona resume versions" },
      post: { summary: "Upload new resume version (PDF/DOCX)" },
    },
    "/api/opportunities": {
      get: { summary: "List profile-eligible opportunities with multi-factor scoring" },
    },
    "/api/opportunities/{id}": {
      get: { summary: "Get opportunity details and match explanation" },
    },
    "/api/opportunities/{id}/save": {
      post: { summary: "Save opportunity for a profile" },
    },
    "/api/applications": {
      get: { summary: "List applications with stage and notes" },
      post: { summary: "Create application draft" },
      patch: { summary: "Update application lifecycle stage, notes, or resume link" },
    },
    "/api/ingest": {
      post: { summary: "Controlled normalized opportunity import and auto-matching" },
    },
    "/api/ingest/greenhouse": {
      post: { summary: "Fetch and ingest public Greenhouse board" },
    },
    "/api/ingest/ashby": {
      post: { summary: "Fetch and ingest public Ashby job board" },
    },
    "/api/ingest/lever": {
      post: { summary: "Fetch and ingest public Lever job postings" },
    },
    "/api/sources": {
      get: { summary: "List registered connectors and sync status" },
    },
    "/api/ingestion-runs": {
      get: { summary: "List connector ingestion telemetry runs" },
    },
    "/api/search-agents": {
      get: { summary: "List automated search agents by persona" },
      post: { summary: "Create a new automated search agent" },
    },
    "/api/search-agents/{id}/run": {
      post: { summary: "Execute search agent on demand" },
    },
    "/api/service-profiles": {
      get: { summary: "List client service offerings" },
      post: { summary: "Create a new service offering for a persona" },
    },
    "/api/client-opportunities": {
      get: { summary: "List client opportunities by persona or stage" },
      post: { summary: "Record new buying signal / client lead" },
      patch: { summary: "Update client pipeline stage, facts, or inference" },
    },
    "/api/contacts": {
      get: { summary: "List contacts for a company" },
      post: { summary: "Add contact with consent tracking and suppression check" },
    },
    "/api/outreach-drafts": {
      get: { summary: "List outreach drafts for a client lead" },
      post: { summary: "Create draft referencing verified facts; supports Idempotency-Key" },
      patch: { summary: "Approve draft (policy-gated; sending disabled)" },
    },
    "/api/suppressions": {
      post: { summary: "Add email suppression" },
    },
    "/api/audit-events": {
      get: { summary: "Read complete system audit trail" },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSchema);
}

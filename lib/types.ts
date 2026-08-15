export type OpportunityKind = "job" | "contract" | "client";

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  company: string;
  location: string;
  compensation: string;
  matchScore: number;
  freshness: string;
  source: string;
  reasons: string[];
  confidence: "High" | "Medium" | "Review";
  status?: "RECOMMENDED" | "SAVED" | "APPLICATION_PREPARING";
  sourceId?: string;
  externalId?: string;
  url?: string;
  description?: string;
}

export interface Profile {
  id: string;
  name: string;
  role: string;
  status: "Active" | "Paused";
  opportunityCount: number;
}

export interface ProfilePreferences {
  targetTitles: string[];
  preferredKinds: OpportunityKind[];
  remoteOnly: boolean;
  minMatchScore: number;
  skills?: string[];
  minHourlyRate?: number;
  minAnnualComp?: number;
  workAuthorization?: string[];
  availability?: string;
}

export interface Source {
  id: string;
  name: string;
  connectorType: "GREENHOUSE" | "ASHBY" | "LEVER" | "MANUAL";
  status: "ACTIVE" | "PAUSED" | "ERROR";
  lastIngestedAt: string | null;
  recordsIngested: number;
}

export interface IngestionRun {
  id: string;
  sourceId: string;
  connectorType: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  recordsFetched: number;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface SearchAgent {
  id: string;
  profileId: string;
  name: string;
  connectorType: "GREENHOUSE" | "ASHBY" | "LEVER";
  boardToken: string;
  queryParams?: {
    keywords?: string[];
    department?: string;
    locationFilter?: string;
  };
  frequencyHours: number;
  status: "ACTIVE" | "PAUSED";
  lastRunAt?: string | null;
  createdAt: string;
}

export type ClientOpportunityStatus =
  | "DISCOVERED"
  | "QUALIFIED"
  | "OUTREACH_READY"
  | "CONTACTED"
  | "RESPONDED"
  | "CONVERTED"
  | "DISQUALIFIED";

export interface ClientOpportunity {
  id: string;
  profileId: string;
  companyId: string;
  companyName: string;
  domain?: string;
  serviceProfileId?: string;
  serviceName?: string;
  title: string;
  score: number;
  status: ClientOpportunityStatus;
  facts: string[];
  inference?: string;
  createdAt: string;
}

export interface ServiceProfile {
  id: string;
  profileId: string;
  name: string;
  description: string;
  targetIndustries: string[];
  createdAt: string;
}

export interface Contact {
  id: string;
  companyId: string;
  email: string;
  fullName?: string;
  title?: string;
  consentStatus: "UNKNOWN" | "PERMITTED" | "OPTED_OUT";
  createdAt: string;
}

export interface OutreachDraft {
  id: string;
  clientOpportunityId: string;
  subject: string;
  body: string;
  status: "DRAFT" | "APPROVED" | "SENT";
  createdAt: string;
}

export interface Application {
  id: string;
  profileId: string;
  profileName?: string;
  opportunityId: string;
  title?: string;
  company?: string;
  location?: string;
  status: "PREPARING" | "READY_FOR_REVIEW" | "SUBMITTED" | "INTERVIEWING" | "OFFER" | "REJECTED";
  notes?: string;
  resumeId?: string;
  externalUrl?: string;
  createdAt: string;
  updatedAt: string;
}

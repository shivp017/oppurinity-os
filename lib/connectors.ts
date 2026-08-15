export type SourceOpportunity = {
  externalId: string;
  kind: "job" | "contract" | "client";
  title: string;
  company: string;
  location: string;
  compensation?: string;
  url?: string;
  description?: string;
};

export interface OpportunityConnector {
  readonly id: string;
  readonly name: string;
  readonly connectorType: "GREENHOUSE" | "ASHBY" | "LEVER" | "MANUAL";
  validate(records: SourceOpportunity[]): string[];
  normalize(record: SourceOpportunity): SourceOpportunity;
}

export const manualImportConnector: OpportunityConnector = {
  id: "manual-import",
  name: "Manual opportunity import",
  connectorType: "MANUAL",
  validate: (records: SourceOpportunity[]) =>
    records.flatMap((record) =>
      !record.externalId || !record.title || !record.company || !record.location
        ? [`${record.externalId || "unknown"}: externalId, title, company, and location are required`]
        : []
    ),
  normalize: (record: SourceOpportunity) => ({
    ...record,
    title: record.title.trim(),
    company: record.company.trim(),
    location: record.location.trim(),
    compensation: record.compensation?.trim() || "Not disclosed",
  }),
};

/**
 * Greenhouse Public Job Board API
 * https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs?content=true
 */
export async function fetchGreenhouseBoard(boardToken: string): Promise<SourceOpportunity[]> {
  if (!/^[a-z0-9_-]+$/i.test(boardToken)) {
    throw new Error("Invalid Greenhouse board token format. Use alphanumeric, dash or underscore.");
  }
  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Greenhouse API responded with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    jobs?: Array<{
      id: number | string;
      title: string;
      location?: { name?: string };
      absolute_url?: string;
      content?: string;
    }>;
  };

  const companyName = boardToken.charAt(0).toUpperCase() + boardToken.slice(1);
  return (payload.jobs ?? []).map((job) => ({
    externalId: String(job.id),
    kind: "job",
    title: job.title.trim(),
    company: companyName,
    location: job.location?.name?.trim() || "Location not disclosed",
    description: job.content ? stripHtml(job.content) : undefined,
    url: job.absolute_url,
    compensation: "Disclosed in posting",
  }));
}

/**
 * Ashby Public Job Board API
 * https://api.ashbyhq.com/posting-api/job-board/{boardToken}
 */
export async function fetchAshbyBoard(boardToken: string): Promise<SourceOpportunity[]> {
  if (!/^[a-z0-9_-]+$/i.test(boardToken)) {
    throw new Error("Invalid Ashby board token format.");
  }
  const response = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardToken)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Ashby API responded with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    jobs?: Array<{
      id: string;
      title: string;
      locationName?: string;
      jobUrl?: string;
      descriptionHtml?: string;
      compensation?: {
        compensationTierSummary?: string;
      };
    }>;
  };

  const companyName = boardToken.charAt(0).toUpperCase() + boardToken.slice(1);
  return (payload.jobs ?? []).map((job) => ({
    externalId: job.id,
    kind: "job",
    title: job.title.trim(),
    company: companyName,
    location: job.locationName?.trim() || "Remote / Unspecified",
    compensation: job.compensation?.compensationTierSummary?.trim() || "Not disclosed",
    url: job.jobUrl,
    description: job.descriptionHtml ? stripHtml(job.descriptionHtml) : undefined,
  }));
}

/**
 * Lever Public Job Postings API
 * https://api.lever.co/v0/postings/{companyToken}?mode=json
 */
export async function fetchLeverBoard(companyToken: string): Promise<SourceOpportunity[]> {
  if (!/^[a-z0-9_-]+$/i.test(companyToken)) {
    throw new Error("Invalid Lever company token format.");
  }
  const response = await fetch(
    `https://api.lever.co/v0/postings/${encodeURIComponent(companyToken)}?mode=json`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Lever API responded with HTTP ${response.status}`);
  }
  const postings = (await response.json()) as Array<{
    id: string;
    text: string;
    categories?: {
      location?: string;
      commitment?: string;
      team?: string;
    };
    hostedUrl?: string;
    descriptionPlain?: string;
    salaryDescription?: string;
  }>;

  const companyName = companyToken.charAt(0).toUpperCase() + companyToken.slice(1);
  return (postings ?? []).map((item) => {
    const isContract = item.categories?.commitment?.toLowerCase().includes("contract") ||
      item.categories?.commitment?.toLowerCase().includes("freelance");
    return {
      externalId: item.id,
      kind: isContract ? "contract" : "job",
      title: item.text.trim(),
      company: companyName,
      location: item.categories?.location?.trim() || "Location not disclosed",
      compensation: item.salaryDescription?.trim() || "Not disclosed",
      url: item.hostedUrl,
      description: item.descriptionPlain?.trim(),
    };
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, " ").replace(/\s\s+/g, " ").trim();
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { rows } = await getDb().query(
    `SELECT 
       p.id, 
       p.name, 
       p.role, 
       p.status, 
       p.opportunity_count AS "opportunityCount", 
       COALESCE(pp.target_titles, '{}') AS "targetTitles", 
       COALESCE(pp.preferred_kinds, ARRAY['job', 'contract', 'client']) AS "preferredKinds", 
       COALESCE(pp.remote_only, false) AS "remoteOnly", 
       COALESCE(pp.min_match_score, 0) AS "minMatchScore",
       COALESCE(pp.skills, '{}') AS "skills",
       pp.min_hourly_rate AS "minHourlyRate",
       pp.min_annual_comp AS "minAnnualComp",
       COALESCE(pp.work_authorization, ARRAY['US Citizen', 'Contractor C2C']) AS "workAuthorization",
       COALESCE(pp.availability, 'Immediate') AS "availability"
     FROM profiles p 
     LEFT JOIN profile_preferences pp ON pp.profile_id = p.id 
     WHERE p.id = $1`,
    [id]
  );
  if (!rows[0]) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    targetTitles?: string[];
    preferredKinds?: string[];
    remoteOnly?: boolean;
    minMatchScore?: number;
    skills?: string[];
    minHourlyRate?: number;
    minAnnualComp?: number;
    workAuthorization?: string[];
    availability?: string;
  };

  const kinds = (body.preferredKinds ?? []).filter((kind) =>
    ["job", "contract", "client"].includes(kind)
  );
  const score = typeof body.minMatchScore === "number" ? body.minMatchScore : 0;

  const { rows } = await getDb().query(
    `INSERT INTO profile_preferences (
       profile_id, target_titles, preferred_kinds, remote_only, min_match_score, 
       skills, min_hourly_rate, min_annual_comp, work_authorization, availability
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (profile_id) DO UPDATE SET 
       target_titles = EXCLUDED.target_titles, 
       preferred_kinds = EXCLUDED.preferred_kinds, 
       remote_only = EXCLUDED.remote_only, 
       min_match_score = EXCLUDED.min_match_score,
       skills = EXCLUDED.skills,
       min_hourly_rate = EXCLUDED.min_hourly_rate,
       min_annual_comp = EXCLUDED.min_annual_comp,
       work_authorization = EXCLUDED.work_authorization,
       availability = EXCLUDED.availability,
       updated_at = NOW()
     RETURNING 
       target_titles AS "targetTitles", 
       preferred_kinds AS "preferredKinds", 
       remote_only AS "remoteOnly", 
       min_match_score AS "minMatchScore",
       skills,
       min_hourly_rate AS "minHourlyRate",
       min_annual_comp AS "minAnnualComp",
       work_authorization AS "workAuthorization",
       availability`,
    [
      id,
      (body.targetTitles ?? []).map((t) => t.trim()).filter(Boolean),
      kinds.length > 0 ? kinds : ["job", "contract", "client"],
      Boolean(body.remoteOnly),
      score,
      (body.skills ?? []).map((s) => s.trim()).filter(Boolean),
      body.minHourlyRate ?? null,
      body.minAnnualComp ?? null,
      body.workAuthorization ?? ["US Citizen", "Contractor C2C"],
      body.availability ?? "Immediate",
    ]
  );
  return NextResponse.json(rows[0]);
}

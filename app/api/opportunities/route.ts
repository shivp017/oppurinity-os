import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { passesEligibility } from "@/lib/matching";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!profileId) return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  const database = getDb();
  const preferences = await database.query("SELECT preferred_kinds AS \"preferredKinds\", remote_only AS \"remoteOnly\", min_match_score AS \"minMatchScore\" FROM profile_preferences WHERE profile_id = $1", [profileId]);
  const { rows } = await database.query(
    `SELECT o.id, o.kind, o.title, o.company, o.location, o.compensation, o.match_score AS "matchScore", o.freshness, o.source, o.confidence, o.reasons, po.status FROM profile_opportunities po JOIN opportunities o ON o.id = po.opportunity_id WHERE po.profile_id = $1 AND ($2::text IS NULL OR o.kind = $2) ORDER BY o.match_score DESC`,
    [profileId, kind && kind !== "all" ? kind : null],
  );
  const preference = preferences.rows[0] ?? { preferredKinds: [], remoteOnly: false, minMatchScore: 0 };
  return NextResponse.json(rows.filter(candidate => passesEligibility(candidate, preference)));
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  const { rows } = await getDb().query(
    `SELECT o.id, o.kind, o.title, o.company, o.location, o.compensation, o.match_score AS "matchScore", o.freshness, o.source, o.confidence, o.reasons, po.status,
            p.name AS "profileName", po.recommended_at AS "recommendedAt"
     FROM profile_opportunities po JOIN opportunities o ON o.id = po.opportunity_id JOIN profiles p ON p.id = po.profile_id
     WHERE po.profile_id = $1 AND o.id = $2`, [profileId, id],
  );
  if (rows.length === 0) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

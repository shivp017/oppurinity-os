import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { profileId } = await request.json() as { profileId?: string };
  if (!profileId) return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  const result = await getDb().query("UPDATE profile_opportunities SET status = 'SAVED' WHERE profile_id = $1 AND opportunity_id = $2 RETURNING status", [profileId, id]);
  if (result.rowCount === 0) return NextResponse.json({ error: "Opportunity not found for profile" }, { status: 404 });
  await audit("opportunity.saved", "opportunity", id, { profileId });
  return NextResponse.json({ id, status: result.rows[0].status });
}

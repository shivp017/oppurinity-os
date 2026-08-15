import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const { rows } = await getDb().query("SELECT id, name, role, status, opportunity_count AS \"opportunityCount\" FROM profiles ORDER BY name");
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json() as { name?: string; role?: string };
  const name = body.name?.trim();
  const role = body.role?.trim();
  if (!name || !role) return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID();
  const { rows } = await getDb().query(
    "INSERT INTO profiles (id, name, role, status, opportunity_count) VALUES ($1, $2, $3, 'Active', 0) RETURNING id, name, role, status, opportunity_count AS \"opportunityCount\"",
    [id, name, role],
  );
  await getDb().query("INSERT INTO profile_preferences (profile_id, target_titles) VALUES ($1, $2)", [id, [role]]);
  return NextResponse.json(rows[0], { status: 201 });
}

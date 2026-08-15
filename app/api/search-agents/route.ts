import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profileId");
  const db = getDb();

  const query = profileId
    ? `SELECT 
        id, 
        profile_id AS "profileId", 
        name, 
        connector_type AS "connectorType", 
        board_token AS "boardToken", 
        query_params AS "queryParams", 
        frequency_hours AS "frequencyHours", 
        status, 
        last_run_at AS "lastRunAt", 
        created_at AS "createdAt" 
       FROM search_agents 
       WHERE profile_id = $1 
       ORDER BY created_at DESC`
    : `SELECT 
        id, 
        profile_id AS "profileId", 
        name, 
        connector_type AS "connectorType", 
        board_token AS "boardToken", 
        query_params AS "queryParams", 
        frequency_hours AS "frequencyHours", 
        status, 
        last_run_at AS "lastRunAt", 
        created_at AS "createdAt" 
       FROM search_agents 
       ORDER BY created_at DESC`;

  const { rows } = await db.query(query, profileId ? [profileId] : []);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    profileId?: string;
    name?: string;
    connectorType?: "GREENHOUSE" | "ASHBY" | "LEVER";
    boardToken?: string;
    queryParams?: { keywords?: string[]; department?: string; locationFilter?: string };
    frequencyHours?: number;
  };

  if (!body.profileId || !body.name || !body.connectorType || !body.boardToken) {
    return NextResponse.json(
      { error: "profileId, name, connectorType, and boardToken are required." },
      { status: 400 }
    );
  }

  const cleanToken = body.boardToken.trim().toLowerCase();
  const db = getDb();

  const { rows } = await db.query(
    `INSERT INTO search_agents (
      profile_id, name, connector_type, board_token, query_params, frequency_hours
    ) VALUES ($1, $2, $3, $4, $5, $6) 
    RETURNING 
      id, 
      profile_id AS "profileId", 
      name, 
      connector_type AS "connectorType", 
      board_token AS "boardToken", 
      query_params AS "queryParams", 
      frequency_hours AS "frequencyHours", 
      status, 
      last_run_at AS "lastRunAt", 
      created_at AS "createdAt"`,
    [
      body.profileId,
      body.name.trim(),
      body.connectorType,
      cleanToken,
      JSON.stringify(body.queryParams || {}),
      body.frequencyHours || 24,
    ]
  );

  const created = rows[0];
  await audit("search_agent.created", "search_agent", created.id, {
    profileId: body.profileId,
    connectorType: body.connectorType,
    boardToken: cleanToken,
  });

  return NextResponse.json(created, { status: 201 });
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
export async function GET() { const { rows } = await getDb().query("SELECT id, name, connector_type AS \"connectorType\", status, last_ingested_at AS \"lastIngestedAt\", records_ingested AS \"recordsIngested\" FROM sources ORDER BY created_at"); return NextResponse.json(rows); }

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
export async function GET() { const { rows } = await getDb().query("SELECT id, event_type AS \"eventType\", entity_type AS \"entityType\", entity_id AS \"entityId\", payload, created_at AS \"createdAt\" FROM audit_events ORDER BY created_at DESC LIMIT 100"); return NextResponse.json(rows); }

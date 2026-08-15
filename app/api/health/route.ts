import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
export async function GET() { try { await getDb().query("SELECT 1"); return NextResponse.json({ status: "ok", database: "ok", timestamp: new Date().toISOString() }); } catch { return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 }); } }

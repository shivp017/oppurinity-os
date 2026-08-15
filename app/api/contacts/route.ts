import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const companyId = new URL(request.url).searchParams.get("companyId");
  const db = getDb();

  const query = companyId
    ? `SELECT 
        id, 
        company_id AS "companyId", 
        email, 
        full_name AS "fullName", 
        title, 
        consent_status AS "consentStatus", 
        created_at AS "createdAt" 
       FROM contacts 
       WHERE company_id = $1 
       ORDER BY created_at DESC`
    : `SELECT 
        id, 
        company_id AS "companyId", 
        email, 
        full_name AS "fullName", 
        title, 
        consent_status AS "consentStatus", 
        created_at AS "createdAt" 
       FROM contacts 
       ORDER BY created_at DESC LIMIT 100`;

  const { rows } = await db.query(query, companyId ? [companyId] : []);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const b = (await request.json()) as {
    companyId?: string;
    email?: string;
    fullName?: string;
    title?: string;
    consentStatus?: string;
  };

  if (!b.companyId || !b.email) {
    return NextResponse.json({ error: "companyId and email required" }, { status: 400 });
  }

  const email = b.email.trim().toLowerCase();
  const db = getDb();

  const blocked = await db.query("SELECT 1 FROM suppressions WHERE email = $1", [email]);
  if (blocked.rowCount && blocked.rowCount > 0) {
    return NextResponse.json({ error: "Contact email is on suppression list" }, { status: 409 });
  }

  const consent = ["UNKNOWN", "PERMITTED", "OPTED_OUT"].includes(b.consentStatus ?? "")
    ? b.consentStatus
    : "UNKNOWN";

  const { rows } = await db.query(
    `INSERT INTO contacts (company_id, email, full_name, title, consent_status) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING 
       id, 
       company_id AS "companyId", 
       email, 
       full_name AS "fullName", 
       title, 
       consent_status AS "consentStatus"`,
    [b.companyId, email, b.fullName?.trim() ?? null, b.title?.trim() ?? null, consent]
  );

  return NextResponse.json(rows[0], { status: 201 });
}

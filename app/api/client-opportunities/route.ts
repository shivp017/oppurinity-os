import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profileId");
  const status = new URL(request.url).searchParams.get("status");
  const db = getDb();

  const query = `
    SELECT 
      co.id,
      co.profile_id AS "profileId",
      co.company_id AS "companyId",
      co.title,
      co.score,
      co.status,
      co.facts,
      co.inference,
      co.created_at AS "createdAt",
      c.name AS "companyName",
      c.domain,
      c.industry,
      c.employee_range AS "employeeRange",
      sp.name AS "serviceName",
      (SELECT COUNT(*) FROM contacts cnt WHERE cnt.company_id = co.company_id)::int AS "contactCount",
      (SELECT COUNT(*) FROM outreach_drafts od WHERE od.client_opportunity_id = co.id)::int AS "draftCount"
    FROM client_opportunities co
    JOIN companies c ON c.id = co.company_id
    LEFT JOIN service_profiles sp ON sp.id = co.service_profile_id
    WHERE ($1::text IS NULL OR co.profile_id = $1)
      AND ($2::text IS NULL OR co.status = $2)
    ORDER BY co.score DESC, co.created_at DESC
  `;

  const { rows } = await db.query(query, [profileId || null, status || null]);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    profileId?: string;
    companyName?: string;
    domain?: string;
    industry?: string;
    employeeRange?: string;
    serviceProfileId?: string;
    title?: string;
    score?: number;
    facts?: string[];
    inference?: string;
  };

  if (!body.profileId || !body.companyName || !body.title) {
    return NextResponse.json(
      { error: "profileId, companyName, and title are required" },
      { status: 400 }
    );
  }

  const score = typeof body.score === "number" ? Math.min(100, Math.max(0, body.score)) : 85;
  const db = getDb();

  // Upsert company
  const companyRes = await db.query(
    `INSERT INTO companies (name, domain, industry, employee_range)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (domain) DO UPDATE SET 
       name = EXCLUDED.name,
       industry = COALESCE(EXCLUDED.industry, companies.industry),
       employee_range = COALESCE(EXCLUDED.employee_range, companies.employee_range)
     RETURNING id`,
    [
      body.companyName.trim(),
      body.domain?.trim().toLowerCase() || null,
      body.industry?.trim() || null,
      body.employeeRange?.trim() || null,
    ]
  );
  const companyId = companyRes.rows[0].id;

  const { rows } = await db.query(
    `INSERT INTO client_opportunities (
      profile_id, company_id, service_profile_id, title, score, facts, inference, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DISCOVERED')
    RETURNING 
      id, 
      profile_id AS "profileId", 
      company_id AS "companyId", 
      title, 
      score, 
      status, 
      facts, 
      inference, 
      created_at AS "createdAt"`,
    [
      body.profileId,
      companyId,
      body.serviceProfileId || null,
      body.title.trim(),
      score,
      JSON.stringify(body.facts || []),
      body.inference?.trim() || null,
    ]
  );

  const created = rows[0];
  await audit("client_opportunity.created", "client_opportunity", created.id, {
    profileId: body.profileId,
    company: body.companyName,
    score,
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    status?: string;
    inference?: string;
    facts?: string[];
  };

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const validStatuses = [
    "DISCOVERED",
    "QUALIFIED",
    "OUTREACH_READY",
    "CONTACTED",
    "RESPONDED",
    "CONVERTED",
    "DISQUALIFIED",
  ];

  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
  }

  const db = getDb();
  const { rows } = await db.query(
    `UPDATE client_opportunities 
     SET 
       status = COALESCE($2, status),
       inference = COALESCE($3, inference),
       facts = COALESCE($4, facts)
     WHERE id = $1
     RETURNING 
       id, 
       profile_id AS "profileId", 
       company_id AS "companyId", 
       title, 
       score, 
       status, 
       facts, 
       inference`,
    [
      body.id,
      body.status || null,
      body.inference || null,
      body.facts ? JSON.stringify(body.facts) : null,
    ]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Client opportunity not found" }, { status: 404 });
  }

  const updated = rows[0];
  if (body.status) {
    await audit("client_opportunity.status_changed", "client_opportunity", updated.id, {
      newStatus: body.status,
    });
  }

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profileId");
  const db = getDb();

  const query = `
    SELECT 
      a.id, 
      a.profile_id AS "profileId",
      a.opportunity_id AS "opportunityId",
      a.status, 
      a.notes,
      a.resume_id AS "resumeId",
      a.external_url AS "externalUrl",
      a.created_at AS "createdAt", 
      a.updated_at AS "updatedAt",
      p.name AS "profileName", 
      o.title, 
      o.company, 
      o.location,
      o.compensation,
      r.file_name AS "resumeFileName"
    FROM applications a 
    JOIN profiles p ON p.id = a.profile_id 
    JOIN opportunities o ON o.id = a.opportunity_id
    LEFT JOIN resumes r ON r.id = a.resume_id
    WHERE ($1::text IS NULL OR a.profile_id = $1)
    ORDER BY a.updated_at DESC
  `;

  const { rows } = await db.query(query, [profileId || null]);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { profileId, opportunityId, notes, resumeId, externalUrl } = (await request.json()) as {
    profileId?: string;
    opportunityId?: string;
    notes?: string;
    resumeId?: string;
    externalUrl?: string;
  };
  if (!profileId || !opportunityId) {
    return NextResponse.json(
      { error: "profileId and opportunityId are required" },
      { status: 400 }
    );
  }
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const application = await client.query(
      `INSERT INTO applications (profile_id, opportunity_id, notes, resume_id, external_url) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (profile_id, opportunity_id) DO UPDATE SET 
         updated_at = NOW(),
         notes = COALESCE(EXCLUDED.notes, applications.notes),
         resume_id = COALESCE(EXCLUDED.resume_id, applications.resume_id),
         external_url = COALESCE(EXCLUDED.external_url, applications.external_url)
       RETURNING id, status, notes, resume_id AS "resumeId", external_url AS "externalUrl"`,
      [profileId, opportunityId, notes || null, resumeId || null, externalUrl || null]
    );
    await client.query(
      `UPDATE profile_opportunities 
       SET status = 'APPLICATION_PREPARING' 
       WHERE profile_id = $1 AND opportunity_id = $2`,
      [profileId, opportunityId]
    );
    await client.query("COMMIT");

    await audit("application.created", "application", application.rows[0].id, {
      profileId,
      opportunityId,
    });

    return NextResponse.json(application.rows[0], { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    status?: string;
    notes?: string;
    resumeId?: string;
    externalUrl?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const validStatuses = [
    "PREPARING",
    "READY_FOR_REVIEW",
    "SUBMITTED",
    "INTERVIEWING",
    "OFFER",
    "REJECTED",
  ];

  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
  }

  const db = getDb();
  const { rows } = await db.query(
    `UPDATE applications 
     SET 
       status = COALESCE($2, status),
       notes = COALESCE($3, notes),
       resume_id = COALESCE($4, resume_id),
       external_url = COALESCE($5, external_url),
       updated_at = NOW()
     WHERE id = $1
     RETURNING 
       id, 
       status, 
       notes, 
       resume_id AS "resumeId", 
       external_url AS "externalUrl", 
       updated_at AS "updatedAt"`,
    [
      body.id,
      body.status || null,
      body.notes !== undefined ? body.notes : null,
      body.resumeId !== undefined ? body.resumeId : null,
      body.externalUrl !== undefined ? body.externalUrl : null,
    ]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const updated = rows[0];
  if (body.status) {
    await audit("application.status_changed", "application", updated.id, {
      newStatus: body.status,
    });
  }

  return NextResponse.json(updated);
}

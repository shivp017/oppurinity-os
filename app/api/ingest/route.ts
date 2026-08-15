import { NextResponse } from "next/server";
import { manualImportConnector, type SourceOpportunity } from "@/lib/connectors";
import { processAndIngestRecords } from "@/lib/ingestion-service";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sourceId?: string;
    records?: SourceOpportunity[];
  };

  const sourceId = body.sourceId || "manual-import";
  if (!Array.isArray(body.records) || body.records.length === 0) {
    return NextResponse.json(
      { error: "Payload must contain an array of opportunity 'records'." },
      { status: 400 }
    );
  }

  const errors = manualImportConnector.validate(body.records);
  if (errors.length) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const db = getDb();
  await db.query(
    `INSERT INTO sources (id, name, connector_type) 
     VALUES ($1, 'Manual opportunity import', 'MANUAL') 
     ON CONFLICT (id) DO NOTHING`,
    [sourceId]
  );

  const runRes = await db.query(
    `INSERT INTO ingestion_runs (source_id, connector_type, status) 
     VALUES ($1, 'MANUAL', 'RUNNING') 
     RETURNING id`,
    [sourceId]
  );
  const runId = runRes.rows[0].id;

  try {
    const normalizedRecords = body.records.map((r) => manualImportConnector.normalize(r));
    const result = await processAndIngestRecords(sourceId, "MANUAL", normalizedRecords, runId);

    return NextResponse.json({
      imported: result.recordsInserted,
      recommendationsCreated: result.recommendationsCreated,
      sourceId: result.sourceId,
      runId: result.runId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { fetchLeverBoard } from "@/lib/connectors";
import { getDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { processAndIngestRecords } from "@/lib/ingestion-service";

export async function POST(request: Request) {
  const { companyToken, autoIngest = true } = (await request.json()) as {
    companyToken?: string;
    autoIngest?: boolean;
  };
  if (!companyToken) {
    return NextResponse.json({ error: "companyToken is required" }, { status: 400 });
  }

  if (!(await enforceRateLimit("ingest:lever", 20))) {
    return NextResponse.json(
      { error: "Rate limit exceeded; please retry in a moment" },
      { status: 429 }
    );
  }

  const sourceId = `lever:${companyToken.toLowerCase()}`;
  const db = getDb();

  await db.query(
    `INSERT INTO sources (id, name, connector_type) 
     VALUES ($1, $2, 'LEVER') 
     ON CONFLICT (id) DO NOTHING`,
    [sourceId, `Lever: ${companyToken}`]
  );

  const runRes = await db.query(
    `INSERT INTO ingestion_runs (source_id, connector_type, status) 
     VALUES ($1, 'LEVER', 'RUNNING') 
     RETURNING id`,
    [sourceId]
  );
  const runId = runRes.rows[0].id;

  try {
    const records = await fetchLeverBoard(companyToken);

    if (autoIngest) {
      const result = await processAndIngestRecords(sourceId, "LEVER", records, runId);
      return NextResponse.json({
        ...result,
        message: `Successfully ingested ${result.recordsInserted} opportunities from Lever (${companyToken}) with ${result.recommendationsCreated} new profile recommendations.`,
      });
    }

    await db.query(
      `UPDATE ingestion_runs 
       SET status = 'SUCCEEDED', records_fetched = $2, finished_at = NOW() 
       WHERE id = $1`,
      [runId, records.length]
    );

    return NextResponse.json({
      source: sourceId,
      runId,
      fetched: records.length,
      records,
      next: "Review records and submit approved records to /api/ingest.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lever connector failed";
    await db.query(
      `UPDATE ingestion_runs 
       SET status = 'FAILED', error_message = $2, finished_at = NOW() 
       WHERE id = $1`,
      [runId, message]
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

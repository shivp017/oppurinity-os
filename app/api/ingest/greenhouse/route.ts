import { NextResponse } from "next/server";
import { fetchGreenhouseBoard } from "@/lib/connectors";
import { getDb } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { processAndIngestRecords } from "@/lib/ingestion-service";

export async function POST(request: Request) {
  const { boardToken, autoIngest = true } = (await request.json()) as {
    boardToken?: string;
    autoIngest?: boolean;
  };
  if (!boardToken) {
    return NextResponse.json({ error: "boardToken is required" }, { status: 400 });
  }

  if (!(await enforceRateLimit("ingest:greenhouse", 20))) {
    return NextResponse.json(
      { error: "Rate limit exceeded; please retry in a moment" },
      { status: 429 }
    );
  }

  const sourceId = `greenhouse:${boardToken.toLowerCase()}`;
  const db = getDb();

  await db.query(
    `INSERT INTO sources (id, name, connector_type) 
     VALUES ($1, $2, 'GREENHOUSE') 
     ON CONFLICT (id) DO NOTHING`,
    [sourceId, `Greenhouse: ${boardToken}`]
  );

  const runRes = await db.query(
    `INSERT INTO ingestion_runs (source_id, connector_type, status) 
     VALUES ($1, 'GREENHOUSE', 'RUNNING') 
     RETURNING id`,
    [sourceId]
  );
  const runId = runRes.rows[0].id;

  try {
    const records = await fetchGreenhouseBoard(boardToken);

    if (autoIngest) {
      const result = await processAndIngestRecords(sourceId, "GREENHOUSE", records, runId);
      return NextResponse.json({
        ...result,
        message: `Successfully ingested ${result.recordsInserted} opportunities from Greenhouse (${boardToken}) with ${result.recommendationsCreated} new profile recommendations.`,
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
    const message = error instanceof Error ? error.message : "Greenhouse connector failed";
    await db.query(
      `UPDATE ingestion_runs 
       SET status = 'FAILED', error_message = $2, finished_at = NOW() 
       WHERE id = $1`,
      [runId, message]
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

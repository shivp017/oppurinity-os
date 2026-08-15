import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fetchGreenhouseBoard, fetchAshbyBoard, fetchLeverBoard, type SourceOpportunity } from "@/lib/connectors";
import { processAndIngestRecords } from "@/lib/ingestion-service";
import { audit } from "@/lib/audit";

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const db = getDb();

  const agentRes = await db.query(
    `SELECT 
      id, 
      profile_id AS "profileId", 
      name, 
      connector_type AS "connectorType", 
      board_token AS "boardToken", 
      query_params AS "queryParams", 
      status 
     FROM search_agents 
     WHERE id = $1`,
    [id]
  );

  if (agentRes.rows.length === 0) {
    return NextResponse.json({ error: "Search agent not found" }, { status: 404 });
  }

  const agent = agentRes.rows[0];
  const sourceId = `${agent.connectorType.toLowerCase()}:${agent.boardToken}`;

  // Ensure source exists in sources table
  await db.query(
    `INSERT INTO sources (id, name, connector_type) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (id) DO NOTHING`,
    [sourceId, `${agent.connectorType}: ${agent.boardToken}`, agent.connectorType]
  );

  // Log running ingestion run
  const runRes = await db.query(
    `INSERT INTO ingestion_runs (source_id, connector_type, status) 
     VALUES ($1, $2, 'RUNNING') 
     RETURNING id`,
    [sourceId, agent.connectorType]
  );
  const runId = runRes.rows[0].id;

  try {
    let records: SourceOpportunity[] = [];
    if (agent.connectorType === "GREENHOUSE") {
      records = await fetchGreenhouseBoard(agent.boardToken);
    } else if (agent.connectorType === "ASHBY") {
      records = await fetchAshbyBoard(agent.boardToken);
    } else if (agent.connectorType === "LEVER") {
      records = await fetchLeverBoard(agent.boardToken);
    }

    // Apply agent query_params keyword filtering if specified
    const keywords: string[] = agent.queryParams?.keywords ?? [];
    if (keywords.length > 0) {
      records = records.filter((rec) => {
        const text = `${rec.title} ${rec.description || ""}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw.toLowerCase()));
      });
    }

    const result = await processAndIngestRecords(
      sourceId,
      agent.connectorType,
      records,
      runId
    );

    // Update search agent last_run_at
    await db.query(`UPDATE search_agents SET last_run_at = NOW() WHERE id = $1`, [agent.id]);

    await audit("search_agent.executed", "search_agent", agent.id, {
      recordsFetched: records.length,
      inserted: result.recordsInserted,
      recommendations: result.recommendationsCreated,
    });

    return NextResponse.json({
      agentId: agent.id,
      agentName: agent.name,
      fetched: records.length,
      recordsInserted: result.recordsInserted,
      recommendationsCreated: result.recommendationsCreated,
      lastRunAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search agent execution failed";
    await db.query(
      `UPDATE ingestion_runs 
       SET status = 'FAILED', error_message = $2, finished_at = NOW() 
       WHERE id = $1`,
      [runId, message]
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

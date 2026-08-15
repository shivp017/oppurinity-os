import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { evaluateOpportunityMatch, passesEligibility } from "@/lib/matching";
import type { SourceOpportunity } from "@/lib/connectors";

export interface IngestionResult {
  sourceId: string;
  runId: string;
  totalFetched: number;
  recordsInserted: number;
  recommendationsCreated: number;
  records: SourceOpportunity[];
}

export async function processAndIngestRecords(
  sourceId: string,
  connectorType: "GREENHOUSE" | "ASHBY" | "LEVER" | "MANUAL",
  records: SourceOpportunity[],
  runId?: string
): Promise<IngestionResult> {
  const db = getDb();
  const client = await db.connect();

  let insertedCount = 0;
  let recsCount = 0;

  try {
    await client.query("BEGIN");

    // Fetch active profile preferences
    const profileRes = await client.query(`
      SELECT 
        p.id, 
        p.name,
        pp.target_titles AS "targetTitles", 
        pp.preferred_kinds AS "preferredKinds", 
        pp.remote_only AS "remoteOnly", 
        pp.min_match_score AS "minMatchScore",
        pp.skills,
        pp.min_hourly_rate AS "minHourlyRate",
        pp.min_annual_comp AS "minAnnualComp"
      FROM profiles p 
      JOIN profile_preferences pp ON pp.profile_id = p.id 
      WHERE p.status = 'Active'
    `);
    const profiles = profileRes.rows;

    for (const record of records) {
      const payloadHash = createHash("sha256")
        .update(JSON.stringify(record))
        .digest("hex");

      // 1. Record raw source provenance
      await client.query(
        `INSERT INTO source_records (source_id, external_id, raw_payload, payload_hash) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (source_id, external_id, payload_hash) DO NOTHING`,
        [sourceId, record.externalId, JSON.stringify(record), payloadHash]
      );

      // 2. Score opportunity against profiles to find best overall match score & reasons
      let bestScore = 60;
      let bestConfidence: "High" | "Medium" | "Review" = "Medium";
      let bestReasons: string[] = ["Discovered via structured ATS connector"];

      for (const prof of profiles) {
        const evalResult = evaluateOpportunityMatch(record, prof);
        if (evalResult.score > bestScore) {
          bestScore = evalResult.score;
          bestConfidence = evalResult.confidence;
          bestReasons = evalResult.reasons;
        }
      }

      const oppId = `${connectorType.toLowerCase()}-${sourceId.replace(/[^a-z0-9]/gi, "-")}-${record.externalId}`;

      // 3. Upsert normalized opportunity
      const oppResult = await client.query(
        `INSERT INTO opportunities (
          id, kind, title, company, location, compensation, match_score, freshness, 
          source, confidence, reasons, source_id, external_id, url, description
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'Just now', $8, $9, $10, $11, $12, $13, $14
        ) ON CONFLICT (source_id, external_id) WHERE source_id IS NOT NULL AND external_id IS NOT NULL 
        DO UPDATE SET 
          title = EXCLUDED.title,
          company = EXCLUDED.company,
          location = EXCLUDED.location,
          compensation = EXCLUDED.compensation,
          freshness = 'Updated recently',
          url = EXCLUDED.url,
          description = EXCLUDED.description
        RETURNING id`,
        [
          oppId,
          record.kind,
          record.title,
          record.company,
          record.location,
          record.compensation || "Not disclosed",
          bestScore,
          `${connectorType.charAt(0) + connectorType.slice(1).toLowerCase()}: ${record.company}`,
          bestConfidence,
          bestReasons,
          sourceId,
          record.externalId,
          record.url || null,
          record.description || null,
        ]
      );

      if (oppResult.rows[0]) {
        insertedCount++;
        const savedOppId = oppResult.rows[0].id;

        // 4. Link eligible profile recommendations
        for (const prof of profiles) {
          const evalResult = evaluateOpportunityMatch(record, prof);
          if (
            passesEligibility(
              {
                kind: record.kind,
                location: record.location,
                matchScore: evalResult.score,
              },
              prof
            )
          ) {
            const linkRes = await client.query(
              `INSERT INTO profile_opportunities (profile_id, opportunity_id, status)
               VALUES ($1, $2, 'RECOMMENDED')
               ON CONFLICT (profile_id, opportunity_id) DO NOTHING
               RETURNING profile_id`,
              [prof.id, savedOppId]
            );
            if (linkRes.rowCount && linkRes.rowCount > 0) {
              recsCount++;
            }
          }
        }
      }
    }

    // 5. Update source metadata
    await client.query(
      `UPDATE sources 
       SET last_ingested_at = NOW(), records_ingested = records_ingested + $2, status = 'ACTIVE' 
       WHERE id = $1`,
      [sourceId, insertedCount]
    );

    await client.query("COMMIT");

    if (runId) {
      await client.query(
        `UPDATE ingestion_runs 
         SET status = 'SUCCEEDED', records_fetched = $2, finished_at = NOW() 
         WHERE id = $1`,
        [runId, records.length]
      );
    }

    await audit("ingestion.completed", "source", sourceId, {
      connectorType,
      totalFetched: records.length,
      recordsInserted: insertedCount,
      recommendationsCreated: recsCount,
      runId,
    });

    return {
      sourceId,
      runId: runId || "",
      totalFetched: records.length,
      recordsInserted: insertedCount,
      recommendationsCreated: recsCount,
      records,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (runId) {
      await db.query(
        `UPDATE ingestion_runs 
         SET status = 'FAILED', error_message = $2, finished_at = NOW() 
         WHERE id = $1`,
        [runId, error instanceof Error ? error.message : "Unknown error"]
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

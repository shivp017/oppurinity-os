import { getDb } from "@/lib/db";
export async function audit(eventType: string, entityType: string, entityId: string, payload: Record<string, unknown> = {}) { await getDb().query("INSERT INTO audit_events (event_type, entity_type, entity_id, payload) VALUES ($1,$2,$3,$4)", [eventType, entityType, entityId, JSON.stringify(payload)]); }

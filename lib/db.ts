import { Pool } from "pg";

const globalForDb = globalThis as unknown as { opportunityPool?: Pool };

export function getDb() {
  if (globalForDb.opportunityPool) return globalForDb.opportunityPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access Opportunity OS data.");
  }

  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("@db:");

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.opportunityPool = pool;
  }
  return pool;
}

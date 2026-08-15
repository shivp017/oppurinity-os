import { getDb } from "@/lib/db";
export async function enforceRateLimit(key:string,limit:number){const {rows}=await getDb().query("INSERT INTO rate_limit_windows(key,window_start,count) VALUES($1,date_trunc('minute',NOW()),1) ON CONFLICT(key,window_start) DO UPDATE SET count=rate_limit_windows.count+1 RETURNING count",[key]);return rows[0].count<=limit;}

import { getDb } from "@/lib/db";
export async function replay(key:string|null,route:string){if(!key)return null;const{rows}=await getDb().query("SELECT response_status AS \"status\",response_body AS \"body\" FROM idempotency_records WHERE key=$1 AND route=$2",[key,route]);return rows[0]??null;}
export async function remember(key:string|null,route:string,status:number,body:unknown){if(key)await getDb().query("INSERT INTO idempotency_records(key,route,response_status,response_body) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO NOTHING",[key,route,status,JSON.stringify(body)]);}

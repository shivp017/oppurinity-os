import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { rows } = await getDb().query("SELECT id, file_name AS \"fileName\", mime_type AS \"mimeType\", byte_size AS \"byteSize\", created_at AS \"createdAt\" FROM resumes WHERE profile_id = $1 ORDER BY created_at DESC", [id]);
  return NextResponse.json(rows);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("resume");
  if (!(file instanceof File)) return NextResponse.json({ error: "resume file is required" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: "Resume must be between 1 byte and 5 MB" }, { status: 400 });
  const allowedTypes = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Only PDF and DOCX resumes are supported" }, { status: 400 });
  const extension = file.type === "application/pdf" ? ".pdf" : ".docx";
  const storageKey = `${crypto.randomUUID()}${extension}`;
  const directory = path.join(process.cwd(), "data", "resumes");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storageKey), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  const { rows } = await getDb().query(
    "INSERT INTO resumes (profile_id, file_name, mime_type, byte_size, storage_key) VALUES ($1, $2, $3, $4, $5) RETURNING id, file_name AS \"fileName\", created_at AS \"createdAt\"",
    [profileId, file.name, file.type, file.size, storageKey],
  );
  return NextResponse.json(rows[0], { status: 201 });
}

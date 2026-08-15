"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import type { Opportunity } from "@/lib/types";

type Detail = Opportunity & { profileName: string; recommendedAt: string };

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const profileId = search.get("profileId") ?? "revops";
  const [item, setItem] = useState<Detail | null>(null);
  useEffect(() => { void fetch(`/api/opportunities/${id}?profileId=${profileId}`).then(response => response.json()).then(setItem); }, [id, profileId]);
  async function action() { if (!item) return; const saved = item.status === "SAVED"; const response = await fetch(saved ? "/api/applications" : `/api/opportunities/${item.id}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved ? { profileId, opportunityId: item.id } : { profileId }) }); if (response.ok) setItem({ ...item, status: saved ? "APPLICATION_PREPARING" : "SAVED" }); }
  if (!item) return <main><Sidebar /><section className="content"><p className="loading detail-loading">Loading opportunity…</p></section></main>;
  const actionLabel = item.status === "SAVED" ? "Prepare application" : item.status === "APPLICATION_PREPARING" ? "Application ready" : "Save opportunity";
  return <main><Sidebar /><section className="content"><header className="topbar"><a className="back-link" href="/opportunities">← Opportunity inbox</a></header><section className="detail"><div className="detail-hero"><span className={`kind ${item.kind}`}>{item.kind === "client" ? "Client signal" : item.kind}</span><h1>{item.title}</h1><p>{item.company} · {item.location}</p><p className="detail-comp">{item.compensation}</p><button className="primary" disabled={item.status === "APPLICATION_PREPARING"} onClick={action}>{actionLabel}</button></div><aside className="match-panel"><small>PROFILE MATCH</small><strong>{item.matchScore}<span>%</span></strong><p>{item.confidence} confidence · {item.profileName}</p></aside><div className="detail-grid"><article><h2>Why this is a match</h2><p>Each recommendation is based on verified profile preferences and source facts.</p><ul>{item.reasons.map(reason => <li key={reason}>✓ {reason}</li>)}</ul></article><article><h2>Source confidence</h2><dl><div><dt>Source</dt><dd>{item.source}</dd></div><div><dt>Freshness</dt><dd>{item.freshness}</dd></div><div><dt>Recommended</dt><dd>{new Date(item.recommendedAt).toLocaleDateString()}</dd></div></dl></article><article className="full-width"><h2>Action history</h2><div className="timeline"><span>Discovered from {item.source}</span><span>Matched against {item.profileName}</span><span>Current state: {item.status?.replaceAll("_", " ")}</span></div></article></div></section></section></main>;
}

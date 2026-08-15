import type { Opportunity } from "@/lib/types";
import { Icon } from "./icons";

const kindLabel: Record<Opportunity["kind"], string> = { job: "Job", contract: "Contract", client: "Client signal" };

export function OpportunityCard({ opportunity, profileId, onAction }: { opportunity: Opportunity; profileId: string; onAction: (opportunity: Opportunity) => void }) {
  return <article className="opportunity-card">
    <div className="card-top"><span className={`kind ${opportunity.kind}`}>{kindLabel[opportunity.kind]}</span><span className="freshness">{opportunity.freshness}</span></div>
    <div className="card-heading"><div><a className="card-link" href={`/opportunities/${opportunity.id}?profileId=${profileId}`}><h3>{opportunity.title}</h3></a><p>{opportunity.company} <span>·</span> {opportunity.location}</p></div><div className="score"><strong>{opportunity.matchScore}</strong><small>match</small></div></div>
    <p className="compensation">{opportunity.compensation}</p>
    <div className="reasons">{opportunity.reasons.slice(0, 2).map(reason => <span key={reason}><Icon name="check" /> {reason}</span>)}</div>
    <footer><span className={`confidence ${opportunity.confidence.toLowerCase()}`}>{opportunity.confidence} confidence</span><span>{opportunity.source}</span><button className="action-button" onClick={() => onAction(opportunity)} disabled={opportunity.status === "APPLICATION_PREPARING"}>{opportunity.status === "SAVED" ? "Prepare app" : opportunity.status === "APPLICATION_PREPARING" ? "App ready" : "Save"}</button></footer>
  </article>;
}

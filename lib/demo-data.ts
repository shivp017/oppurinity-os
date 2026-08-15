import type { Opportunity, Profile } from "./types";

export const profiles: Profile[] = [
  { id: "revops", name: "RevOps Consultant", role: "HubSpot & GTM systems", status: "Active", opportunityCount: 18 },
  { id: "fullstack", name: "Full Stack Developer", role: "TypeScript & product engineering", status: "Active", opportunityCount: 12 },
  { id: "automation", name: "Automation Specialist", role: "Make, AI workflows & ops", status: "Paused", opportunityCount: 7 },
];

export const opportunities: Opportunity[] = [
  {
    id: "opp-1", kind: "job", title: "Senior Revenue Operations Manager", company: "Linear", location: "Remote · US", compensation: "$135k–$165k", matchScore: 94, freshness: "Posted 2h ago", source: "Greenhouse", confidence: "High",
    reasons: ["HubSpot workflow experience", "Remote preference matches", "Seniority aligned"],
  },
  {
    id: "opp-2", kind: "contract", title: "HubSpot migration & lifecycle build", company: "Fable", location: "Remote · Contract", compensation: "$75–$95/hr", matchScore: 89, freshness: "Posted 5h ago", source: "Company careers", confidence: "High",
    reasons: ["Service profile: HubSpot consulting", "Similar project evidence", "Rate meets minimum"],
  },
  {
    id: "opp-3", kind: "client", title: "Likely CRM scaling requirement", company: "Arcade", location: "San Francisco · Remote", compensation: "Estimated $12k–$30k project", matchScore: 86, freshness: "New signal today", source: "Career graph", confidence: "Medium",
    reasons: ["Hiring RevOps roles", "HubSpot detected", "Headcount signal in ICP"],
  },
  {
    id: "opp-4", kind: "job", title: "Staff Full Stack Engineer", company: "PostHog", location: "Remote · Global", compensation: "$120k–$175k", matchScore: 83, freshness: "Posted 1d ago", source: "Ashby", confidence: "High",
    reasons: ["TypeScript stack", "Remote eligibility", "Product experience"],
  },
];

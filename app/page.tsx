"use client";

import { useEffect, useState } from "react";
import { OpportunityCard } from "@/components/opportunity-card";
import { Sidebar } from "@/components/sidebar";
import { Icon } from "@/components/icons";
import { opportunities as defaultOpportunities, profiles as defaultProfiles } from "@/lib/demo-data";
import type { Opportunity, Profile } from "@/lib/types";

export default function Dashboard() {
  const [activeProfile, setActiveProfile] = useState(defaultProfiles[0].id);
  const [filter, setFilter] = useState<"all" | "job" | "contract" | "client">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [profileList, setProfileList] = useState<Profile[]>(defaultProfiles);
  const [items, setItems] = useState<Opportunity[]>(
    defaultOpportunities.map((item) => ({ ...item, status: "RECOMMENDED" }))
  );
  const [isLoading, setIsLoading] = useState(true);

  // Persona Modal
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRole, setNewProfileRole] = useState("");

  // Search Agent Modal
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentConnector, setAgentConnector] = useState<"GREENHOUSE" | "ASHBY" | "LEVER">("GREENHOUSE");
  const [agentToken, setAgentToken] = useState("");
  const [agentKeywords, setAgentKeywords] = useState("");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  const selected = profileList.find((p) => p.id === activeProfile) ?? profileList[0];

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [profileResponse, opportunityResponse] = await Promise.all([
          fetch("/api/profiles"),
          fetch(`/api/opportunities?profileId=${activeProfile}&kind=${filter}`),
        ]);
        if (profileResponse.ok) setProfileList(await profileResponse.json());
        if (opportunityResponse.ok) setItems(await opportunityResponse.json());
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [activeProfile, filter]);

  async function actionOpportunity(opportunity: Opportunity) {
    const isSaved = opportunity.status === "SAVED";
    const response = await fetch(
      isSaved ? "/api/applications" : `/api/opportunities/${opportunity.id}/save`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSaved
            ? { profileId: activeProfile, opportunityId: opportunity.id }
            : { profileId: activeProfile }
        ),
      }
    );
    if (!response.ok) return;
    setItems((current) =>
      current.map((item) =>
        item.id === opportunity.id
          ? { ...item, status: isSaved ? "APPLICATION_PREPARING" : "SAVED" }
          : item
      )
    );
  }

  async function createProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProfileName, role: newProfileRole }),
    });
    if (!response.ok) return;
    const created = (await response.json()) as Profile;
    setProfileList((current) => [...current, created]);
    setActiveProfile(created.id);
    setNewProfileName("");
    setNewProfileRole("");
    setShowProfileForm(false);
  }

  async function createSearchAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!agentName || !agentToken) return;
    setIsCreatingAgent(true);
    try {
      const keywords = agentKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch("/api/search-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeProfile,
          name: agentName,
          connectorType: agentConnector,
          boardToken: agentToken,
          queryParams: { keywords },
          frequencyHours: 24,
        }),
      });
      if (res.ok) {
        setShowAgentModal(false);
        setAgentName("");
        setAgentToken("");
        setAgentKeywords("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingAgent(false);
    }
  }

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.company.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.reasons.some((r) => r.toLowerCase().includes(q))
    );
  });

  return (
    <main id="top">
      <Sidebar />
      <section className="content">
        <header className="topbar">
          <label className="searchbox">
            <Icon name="search" />
            <input
              placeholder="Search opportunities, companies, skills…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <button
            className="primary"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowAgentModal(true)}
          >
            <Icon name="plus" /> New search agent
          </button>
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">YOUR OPPORTUNITY INTELLIGENCE</p>
            <h1>Good morning, Shiv.</h1>
            <p className="subtitle">
              Verified high-confidence opportunities matched strictly to your active persona.
            </p>
          </div>
          <a className="date-filter text-button" href="/discovery">
            <span>Live Discovery Hub</span>
            <Icon name="chevron" />
          </a>
        </div>

        <section className="profile-row">
          <div className="section-title">
            <div>
              <h2>Active persona</h2>
              <p>Resumes, deterministic rules, and outreach remain strictly separated.</p>
            </div>
            <span className="profile-actions">
              <a className="text-button" href={`/profiles/${activeProfile}`}>
                Profile settings <Icon name="arrow" />
              </a>
              <button className="text-button" onClick={() => setShowProfileForm(true)}>
                Add persona <Icon name="plus" />
              </button>
            </span>
          </div>
          <div className="profiles">
            {profileList.map((profile) => (
              <button
                className={profile.id === activeProfile ? "profile-card selected" : "profile-card"}
                onClick={() => setActiveProfile(profile.id)}
                key={profile.id}
              >
                <span className="profile-icon">{profile.name.slice(0, 1)}</span>
                <span className="profile-copy">
                  <b>{profile.name}</b>
                  <small>{profile.role}</small>
                </span>
                <span className={`status ${profile.status.toLowerCase()}`}>{profile.status}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="metrics">
          <div className="metric featured">
            <span className="metric-icon">
              <Icon name="spark" />
            </span>
            <div>
              <small>Persona fit opportunities</small>
              <strong>{selected.opportunityCount}</strong>
              <p>
                <b>+6</b> new since yesterday
              </p>
            </div>
          </div>
          <div className="metric">
            <small>Average match quality</small>
            <strong>
              88<span>%</span>
            </strong>
            <p>
              <b>Deterministic</b> multi-factor
            </p>
          </div>
          <div className="metric">
            <small>Active discovery agents</small>
            <strong>3</strong>
            <p>Greenhouse · Ashby · Lever</p>
          </div>
          <div className="metric">
            <small>Verified source health</small>
            <strong className="healthy">
              100<span>%</span>
            </strong>
            <p>Official structured APIs</p>
          </div>
        </section>

        <section className="feed">
          <div className="section-title">
            <div>
              <h2>Recommended for {selected.name}</h2>
              <p>Ranked on role focus, skills, rate alignment, remote eligibility, and provenance.</p>
            </div>
            <a className="text-button" href="/opportunities">
              View full inbox <Icon name="arrow" />
            </a>
          </div>
          <div className="filters">
            {(["all", "job", "contract", "client"] as const).map((item) => (
              <button
                className={filter === item ? "filter selected" : "filter"}
                onClick={() => setFilter(item)}
                key={item}
              >
                {item === "all"
                  ? "All opportunities"
                  : item === "client"
                  ? "Client signals"
                  : `${item[0].toUpperCase()}${item.slice(1)}s`}
              </button>
            ))}
          </div>
          <div className="opportunity-grid">
            {isLoading ? (
              <p className="loading">Loading recommendations…</p>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "span 2" }}>
                <h2>No opportunities match your filter</h2>
                <p>Try adjusting your search query or trigger a fresh discovery sync.</p>
              </div>
            ) : (
              filteredItems.map((opportunity) => (
                <OpportunityCard
                  opportunity={opportunity}
                  profileId={activeProfile}
                  onAction={actionOpportunity}
                  key={opportunity.id}
                />
              ))
            )}
          </div>
        </section>

        {/* New Persona Modal */}
        {showProfileForm && (
          <div className="modal-backdrop" role="presentation">
            <form className="profile-form" onSubmit={createProfile}>
              <div>
                <p className="eyebrow">NEW PERSONA</p>
                <h2>Create a focused opportunity profile</h2>
                <p>Resumes, preferences, and actions will remain separated.</p>
              </div>
              <label>
                Name
                <input
                  autoFocus
                  required
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="e.g. Product Designer"
                />
              </label>
              <label>
                Focus
                <input
                  required
                  value={newProfileRole}
                  onChange={(event) => setNewProfileRole(event.target.value)}
                  placeholder="e.g. UX strategy & design systems"
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowProfileForm(false)}
                >
                  Cancel
                </button>
                <button className="primary" type="submit">
                  Create persona
                </button>
              </div>
            </form>
          </div>
        )}

        {/* New Search Agent Modal */}
        {showAgentModal && (
          <div className="modal-backdrop" role="presentation">
            <form className="profile-form" onSubmit={createSearchAgent}>
              <div>
                <p className="eyebrow">NEW SEARCH AGENT</p>
                <h2>Create Discovery Agent</h2>
                <p>Automate structured board monitoring for {selected.name}.</p>
              </div>
              <label>
                Agent Name
                <input
                  required
                  placeholder="e.g. Linear RevOps Monitor"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
              </label>
              <label>
                ATS Connector Type
                <select
                  className="profile-select"
                  value={agentConnector}
                  onChange={(e) =>
                    setAgentConnector(e.target.value as "GREENHOUSE" | "ASHBY" | "LEVER")
                  }
                >
                  <option value="GREENHOUSE">Greenhouse Public Board</option>
                  <option value="ASHBY">Ashby Public Board</option>
                  <option value="LEVER">Lever Postings API</option>
                </select>
              </label>
              <label>
                Board Token / Company Slug
                <input
                  required
                  placeholder="e.g. linear, posthog, figma"
                  value={agentToken}
                  onChange={(e) => setAgentToken(e.target.value)}
                />
              </label>
              <label>
                Keyword Filters (comma-separated)
                <input
                  placeholder="e.g. revops, operations, typescript, engineer"
                  value={agentKeywords}
                  onChange={(e) => setAgentKeywords(e.target.value)}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowAgentModal(false)}
                >
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={isCreatingAgent}>
                  {isCreatingAgent ? "Creating agent…" : "Create Search Agent"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

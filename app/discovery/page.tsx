"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Icon } from "@/components/icons";
import type { Profile, Source, IngestionRun, SearchAgent } from "@/lib/types";

export default function DiscoveryPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>("revops");
  const [activeTab, setActiveTab] = useState<"agents" | "sources" | "runs" | "manual">("agents");

  const [agents, setAgents] = useState<SearchAgent[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search Agent Modal State
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentConnector, setNewAgentConnector] = useState<"GREENHOUSE" | "ASHBY" | "LEVER">("GREENHOUSE");
  const [newAgentToken, setNewAgentToken] = useState("");
  const [newAgentKeywords, setNewAgentKeywords] = useState("");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  // Manual Import State
  const [manualJson, setManualJson] = useState(
    JSON.stringify(
      [
        {
          externalId: "custom-job-101",
          kind: "contract",
          title: "HubSpot & Segment Integration Architect",
          company: "Acme Corp",
          location: "Remote · US",
          compensation: "$90–$120/hr",
          description: "Need an experienced HubSpot RevOps consultant to integrate Segment event streams and lifecycle stages.",
        },
      ],
      null,
      2
    )
  );
  const [manualStatus, setManualStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Quick Ingest State for Sources
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [profRes, srcRes, runsRes] = await Promise.all([
          fetch("/api/profiles"),
          fetch("/api/sources"),
          fetch("/api/ingestion-runs"),
        ]);
        if (profRes.ok) {
          const profData = await profRes.json();
          setProfiles(profData);
          if (profData.length > 0 && !activeProfile) {
            setActiveProfile(profData[0].id);
          }
        }
        if (srcRes.ok) setSources(await srcRes.json());
        if (runsRes.ok) setRuns(await runsRes.json());
      } catch (err) {
        console.error("Failed to load discovery data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadInitialData();
  }, []);

  useEffect(() => {
    async function loadAgents() {
      if (!activeProfile) return;
      try {
        const res = await fetch(`/api/search-agents?profileId=${activeProfile}`);
        if (res.ok) setAgents(await res.json());
      } catch (err) {
        console.error("Failed to load search agents:", err);
      }
    }
    void loadAgents();
  }, [activeProfile]);

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newAgentName || !newAgentToken) return;
    setIsCreatingAgent(true);
    try {
      const keywords = newAgentKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/search-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeProfile,
          name: newAgentName,
          connectorType: newAgentConnector,
          boardToken: newAgentToken,
          queryParams: { keywords },
          frequencyHours: 24,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAgents((prev) => [created, ...prev]);
        setShowAgentModal(false);
        setNewAgentName("");
        setNewAgentToken("");
        setNewAgentKeywords("");
      }
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setIsCreatingAgent(false);
    }
  }

  async function handleRunAgent(agentId: string) {
    setRunningAgentId(agentId);
    try {
      const res = await fetch(`/api/search-agents/${agentId}/run`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        // Update agent last run in list
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, lastRunAt: data.lastRunAt } : a))
        );
        // Refresh runs and sources
        const [runsRes, srcRes] = await Promise.all([
          fetch("/api/ingestion-runs"),
          fetch("/api/sources"),
        ]);
        if (runsRes.ok) setRuns(await runsRes.json());
        if (srcRes.ok) setSources(await srcRes.json());
      }
    } catch (err) {
      console.error("Agent run failed:", err);
    } finally {
      setRunningAgentId(null);
    }
  }

  async function handleSyncConnector(connectorType: string, token: string) {
    const key = `${connectorType.toLowerCase()}:${token}`;
    setSyncingSource(key);
    try {
      let endpoint = "/api/ingest/greenhouse";
      let payload: Record<string, unknown> = { boardToken: token, autoIngest: true };

      if (connectorType === "ASHBY") {
        endpoint = "/api/ingest/ashby";
        payload = { boardToken: token, autoIngest: true };
      } else if (connectorType === "LEVER") {
        endpoint = "/api/ingest/lever";
        payload = { companyToken: token, autoIngest: true };
      }

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Refresh sources and runs
      const [srcRes, runsRes] = await Promise.all([
        fetch("/api/sources"),
        fetch("/api/ingestion-runs"),
      ]);
      if (srcRes.ok) setSources(await srcRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncingSource(null);
    }
  }

  async function handleManualImport() {
    setIsImporting(true);
    setManualStatus(null);
    try {
      const parsed = JSON.parse(manualJson);
      const records = Array.isArray(parsed) ? parsed : [parsed];

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "manual-import", records }),
      });

      const data = await res.json();
      if (res.ok) {
        setManualStatus(`Imported ${data.imported} records with ${data.recommendationsCreated} new recommendations.`);
        // Refresh sources and runs
        const [srcRes, runsRes] = await Promise.all([
          fetch("/api/sources"),
          fetch("/api/ingestion-runs"),
        ]);
        if (srcRes.ok) setSources(await srcRes.json());
        if (runsRes.ok) setRuns(await runsRes.json());
      } else {
        setManualStatus(`Error: ${data.error || "Validation failed"}`);
      }
    } catch (err) {
      setManualStatus(`JSON Parse Error: ${err instanceof Error ? err.message : "Invalid JSON"}`);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main id="top">
      <Sidebar />
      <section className="content">
        <header className="topbar">
          <a className="back-link" href="/">
            ← Overview
          </a>
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
            <p className="eyebrow">DISCOVERY & INGESTION HUB</p>
            <h1>Opportunity Discovery</h1>
            <p className="subtitle">
              Structured ATS connectors, automated search agents, and verified source provenance.
            </p>
          </div>
          <div className="persona-picker">
            <label>Active Persona</label>
            <select
              className="profile-select"
              value={activeProfile}
              onChange={(e) => setActiveProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="filters" style={{ marginBottom: "24px" }}>
          <button
            className={activeTab === "agents" ? "filter selected" : "filter"}
            onClick={() => setActiveTab("agents")}
          >
            <Icon name="spark" /> Search Agents ({agents.length})
          </button>
          <button
            className={activeTab === "sources" ? "filter selected" : "filter"}
            onClick={() => setActiveTab("sources")}
          >
            <Icon name="grid" /> Connected Sources ({sources.length})
          </button>
          <button
            className={activeTab === "runs" ? "filter selected" : "filter"}
            onClick={() => setActiveTab("runs")}
          >
            <Icon name="chart" /> Ingestion Runs ({runs.length})
          </button>
          <button
            className={activeTab === "manual" ? "filter selected" : "filter"}
            onClick={() => setActiveTab("manual")}
          >
            <Icon name="briefcase" /> Manual Import & Tester
          </button>
        </div>

        {/* Search Agents View */}
        {activeTab === "agents" && (
          <section className="agent-section">
            <div className="section-title">
              <div>
                <h2>Automated Search Agents</h2>
                <p>Scheduled bots continuously monitor verified ATS endpoints for matching opportunities.</p>
              </div>
              <button className="text-button" onClick={() => setShowAgentModal(true)}>
                <Icon name="plus" /> Add search agent
              </button>
            </div>

            {isLoading ? (
              <p className="loading">Loading search agents…</p>
            ) : agents.length === 0 ? (
              <div className="empty-state" style={{ marginTop: "16px" }}>
                <h2>No search agents configured yet</h2>
                <p>Create an agent to monitor Greenhouse, Ashby, or Lever job boards automatically.</p>
                <button
                  className="primary"
                  style={{ margin: "16px auto 0" }}
                  onClick={() => setShowAgentModal(true)}
                >
                  <Icon name="plus" /> Create your first agent
                </button>
              </div>
            ) : (
              <div className="agent-grid" style={{ marginTop: "18px" }}>
                {agents.map((agent) => (
                  <article className="agent-card" key={agent.id}>
                    <div className="agent-header">
                      <span className={`connector-badge ${agent.connectorType.toLowerCase()}`}>
                        {agent.connectorType}
                      </span>
                      <span className={`status ${agent.status.toLowerCase()}`}>{agent.status}</span>
                    </div>
                    <h3>{agent.name}</h3>
                    <p className="agent-target">
                      <b>Board Target:</b> <code>{agent.boardToken}</code>
                    </p>
                    {agent.queryParams?.keywords && agent.queryParams.keywords.length > 0 && (
                      <div className="keywords-list">
                        {agent.queryParams.keywords.map((kw) => (
                          <span className="keyword-chip" key={kw}>
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    <footer className="agent-footer">
                      <small>
                        {agent.lastRunAt
                          ? `Last run: ${new Date(agent.lastRunAt).toLocaleTimeString()}`
                          : "Never run"}
                      </small>
                      <button
                        className="action-button"
                        disabled={runningAgentId === agent.id}
                        onClick={() => handleRunAgent(agent.id)}
                      >
                        {runningAgentId === agent.id ? "Running…" : "Run now →"}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Sources Catalog View */}
        {activeTab === "sources" && (
          <section className="sources-section">
            <div className="section-title">
              <div>
                <h2>Verified Connectors & Job Boards</h2>
                <p>Pre-authenticated structured ATS endpoints with provenance hashes and zero scraping.</p>
              </div>
            </div>

            <div className="sources-table" style={{ marginTop: "18px" }}>
              {sources.map((src) => (
                <div className="source-row" key={src.id}>
                  <div>
                    <span className={`connector-badge ${src.connectorType.toLowerCase()}`}>
                      {src.connectorType}
                    </span>
                    <h3>{src.name}</h3>
                    <small>ID: {src.id}</small>
                  </div>
                  <div>
                    <small>Total Ingested</small>
                    <b>{src.recordsIngested} records</b>
                  </div>
                  <div>
                    <small>Last Sync</small>
                    <b>{src.lastIngestedAt ? new Date(src.lastIngestedAt).toLocaleDateString() : "Pending"}</b>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {src.connectorType !== "MANUAL" && (
                      <button
                        className="action-button"
                        disabled={syncingSource === src.id}
                        onClick={() =>
                          handleSyncConnector(
                            src.connectorType,
                            src.id.split(":")[1] || src.id
                          )
                        }
                      >
                        {syncingSource === src.id ? "Syncing…" : "Sync fresh"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ingestion Runs View */}
        {activeTab === "runs" && (
          <section className="runs-section">
            <div className="section-title">
              <div>
                <h2>Telemetry & Ingestion Runs</h2>
                <p>Audit trail of every ingestion execution and record normalization run.</p>
              </div>
            </div>

            <div className="runs-list" style={{ marginTop: "18px" }}>
              {runs.map((run) => (
                <article className="run-row" key={run.id}>
                  <div>
                    <span className={`status ${run.status === "SUCCEEDED" ? "active" : run.status === "RUNNING" ? "running" : "paused"}`}>
                      {run.status}
                    </span>
                    <b>{run.sourceId}</b>
                  </div>
                  <div>
                    <small>Connector</small>
                    <span>{run.connectorType}</span>
                  </div>
                  <div>
                    <small>Fetched</small>
                    <b>{run.recordsFetched} items</b>
                  </div>
                  <div>
                    <small>Executed At</small>
                    <span>{new Date(run.startedAt).toLocaleString()}</span>
                  </div>
                  {run.errorMessage && <p className="run-error">Error: {run.errorMessage}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Manual Import & Tester View */}
        {activeTab === "manual" && (
          <section className="manual-section">
            <div className="section-title">
              <div>
                <h2>Controlled Manual Importer & Tester</h2>
                <p>Import curated opportunity records directly with schema validation and provenance hashing.</p>
              </div>
            </div>

            <div className="manual-box" style={{ marginTop: "18px" }}>
              <label>
                <b>JSON Opportunity Payload</b>
                <textarea
                  className="code-textarea"
                  rows={14}
                  value={manualJson}
                  onChange={(e) => setManualJson(e.target.value)}
                />
              </label>
              <div className="manual-actions">
                <button
                  className="primary"
                  disabled={isImporting}
                  onClick={handleManualImport}
                >
                  {isImporting ? "Processing & Matching…" : "Validate & Ingest Records"}
                </button>
                {manualStatus && <span className="manual-feedback">{manualStatus}</span>}
              </div>
            </div>
          </section>
        )}

        {/* New Search Agent Modal */}
        {showAgentModal && (
          <div className="modal-backdrop" role="presentation">
            <form className="profile-form" onSubmit={handleCreateAgent}>
              <div>
                <p className="eyebrow">NEW SEARCH AGENT</p>
                <h2>Configure Discovery Agent</h2>
                <p>Automate discovery from official ATS boards for {profiles.find((p) => p.id === activeProfile)?.name}.</p>
              </div>
              <label>
                Agent Name
                <input
                  required
                  placeholder="e.g. Linear RevOps Monitor"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                />
              </label>
              <label>
                ATS Connector Type
                <select
                  className="profile-select"
                  value={newAgentConnector}
                  onChange={(e) =>
                    setNewAgentConnector(e.target.value as "GREENHOUSE" | "ASHBY" | "LEVER")
                  }
                >
                  <option value="GREENHOUSE">Greenhouse Job Board</option>
                  <option value="ASHBY">Ashby Public Board</option>
                  <option value="LEVER">Lever Postings API</option>
                </select>
              </label>
              <label>
                Board Token / Company Slug
                <input
                  required
                  placeholder="e.g. linear, posthog, figma"
                  value={newAgentToken}
                  onChange={(e) => setNewAgentToken(e.target.value)}
                />
              </label>
              <label>
                Keyword Filters (comma-separated)
                <input
                  placeholder="e.g. revops, operations, hubspot, engineer"
                  value={newAgentKeywords}
                  onChange={(e) => setNewAgentKeywords(e.target.value)}
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
                  {isCreatingAgent ? "Creating…" : "Save Search Agent"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

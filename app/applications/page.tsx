"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Icon } from "@/components/icons";
import type { Application, Profile } from "@/lib/types";

const APP_STAGES = [
  { key: "all", label: "All Applications" },
  { key: "PREPARING", label: "Preparing Draft" },
  { key: "READY_FOR_REVIEW", label: "Ready for Review" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "INTERVIEWING", label: "Interviewing" },
  { key: "OFFER", label: "Offer Received" },
];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Selected Application Modal
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [appRes, profRes] = await Promise.all([
          fetch("/api/applications"),
          fetch("/api/profiles"),
        ]);
        if (appRes.ok) setApplications(await appRes.json());
        if (profRes.ok) setProfiles(await profRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, []);

  function openAppDetails(app: Application) {
    setSelectedApp(app);
    setNotes(app.notes || "");
  }

  async function handleUpdateStatus(appId: string, newStatus: string) {
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appId, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: updated.status } : a))
        );
        if (selectedApp && selectedApp.id === appId) {
          setSelectedApp((prev) => (prev ? { ...prev, status: updated.status } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveNotes() {
    if (!selectedApp) return;
    setIsSavingNotes(true);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedApp.id, notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApplications((prev) =>
          prev.map((a) => (a.id === selectedApp.id ? { ...a, notes: updated.notes } : a))
        );
        setSelectedApp((prev) => (prev ? { ...prev, notes: updated.notes } : null));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  }

  const filteredApps = applications.filter((app) => {
    const profileMatch = activeProfile === "all" || app.profileId === activeProfile;
    const stageMatch = stageFilter === "all" || app.status === stageFilter;
    return profileMatch && stageMatch;
  });

  return (
    <main id="top">
      <Sidebar />
      <section className="content">
        <header className="topbar">
          <a className="back-link" href="/">
            ← Overview
          </a>
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Filter by persona:</span>
            <select
              className="profile-select"
              value={activeProfile}
              onChange={(e) => setActiveProfile(e.target.value)}
            >
              <option value="all">All Personas</option>
              {profiles.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">APPLICATION WORKFLOW & TRACKER</p>
            <h1>Application Pipelines</h1>
            <p className="subtitle">
              Every application draft and submission stays linked to its persona and verified opportunity.
            </p>
          </div>
        </div>

        {/* Stage Filter */}
        <div className="filters" style={{ marginBottom: "20px" }}>
          {APP_STAGES.map((st) => {
            const count =
              st.key === "all"
                ? applications.length
                : applications.filter((a) => a.status === st.key).length;
            return (
              <button
                className={stageFilter === st.key ? "filter selected" : "filter"}
                onClick={() => setStageFilter(st.key)}
                key={st.key}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Application List */}
        {isLoading ? (
          <p className="loading">Loading applications…</p>
        ) : filteredApps.length === 0 ? (
          <div className="empty-state">
            <h2>No applications found in this stage</h2>
            <p>Save an opportunity from your inbox and choose “Prepare application” to begin tracking.</p>
            <a
              className="text-button"
              href="/opportunities"
              style={{ display: "inline-flex", margin: "16px auto 0" }}
            >
              Browse Opportunity Inbox <Icon name="arrow" />
            </a>
          </div>
        ) : (
          <section className="application-list">
            {filteredApps.map((app) => (
              <article
                className="application-row"
                key={app.id}
                style={{ cursor: "pointer" }}
                onClick={() => openAppDetails(app)}
              >
                <div>
                  <span className={`kind ${app.status === "OFFER" ? "contract" : "job"}`}>
                    {app.status.replaceAll("_", " ")}
                  </span>
                  <h2>{app.title}</h2>
                  <p>
                    {app.company} · {app.location}
                  </p>
                </div>
                <div>
                  <small>Persona</small>
                  <b>{app.profileName}</b>
                </div>
                <div>
                  <small>Last Activity</small>
                  <b>{new Date(app.updatedAt).toLocaleDateString()}</b>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAppDetails(app);
                    }}
                  >
                    View & Edit →
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Application Detail Modal */}
        {selectedApp && (
          <div className="modal-backdrop" role="presentation">
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
              <header className="drawer-header">
                <div>
                  <span className="kind job">{selectedApp.status.replaceAll("_", " ")}</span>
                  <h2>{selectedApp.title}</h2>
                  <p>
                    {selectedApp.company} · {selectedApp.location}
                  </p>
                </div>
                <button className="icon-button" onClick={() => setSelectedApp(null)}>
                  ✕
                </button>
              </header>

              <div className="drawer-body">
                <section className="drawer-section">
                  <label className="section-label">Update Application Stage</label>
                  <div className="stage-buttons">
                    {APP_STAGES.filter((s) => s.key !== "all").map((st) => (
                      <button
                        className={selectedApp.status === st.key ? "stage-btn active" : "stage-btn"}
                        onClick={() => handleUpdateStatus(selectedApp.id, st.key)}
                        key={st.key}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="drawer-section" style={{ marginTop: "20px" }}>
                  <h3>Persona & Target Role</h3>
                  <p className="subtext">
                    Scoped strictly to persona <b>{selectedApp.profileName}</b>.
                  </p>
                </section>

                <section className="drawer-section" style={{ marginTop: "20px" }}>
                  <h3>Application Notes & Interview Prep</h3>
                  <textarea
                    rows={6}
                    placeholder="Add interview notes, compensation discussion, customized cover letter points, or referral contacts…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: "100%", marginTop: "8px" }}
                  />
                  <button
                    className="primary"
                    style={{ marginTop: "10px" }}
                    disabled={isSavingNotes}
                    onClick={handleSaveNotes}
                  >
                    {isSavingNotes ? "Saving notes…" : "Save Notes"}
                  </button>
                </section>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

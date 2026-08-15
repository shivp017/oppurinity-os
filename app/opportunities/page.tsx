"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { OpportunityCard } from "@/components/opportunity-card";
import { Icon } from "@/components/icons";
import type { Opportunity, Profile } from "@/lib/types";

export default function OpportunityInbox() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [kind, setKind] = useState<"all" | "job" | "contract" | "client">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: Profile[]) => {
        setProfiles(data);
        if (data.length > 0) setProfileId(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!profileId) return;
    setIsLoading(true);
    void fetch(`/api/opportunities?profileId=${profileId}&kind=${kind}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setIsLoading(false);
      });
  }, [profileId, kind]);

  async function action(item: Opportunity) {
    const saved = item.status === "SAVED";
    const response = await fetch(
      saved ? "/api/applications" : `/api/opportunities/${item.id}/save`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          saved ? { profileId, opportunityId: item.id } : { profileId }
        ),
      }
    );
    if (response.ok) {
      setItems((current) =>
        current.map((value) =>
          value.id === item.id
            ? { ...value, status: saved ? "APPLICATION_PREPARING" : "SAVED" }
            : value
        )
      );
    }
  }

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
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
          <a className="back-link" href="/">
            ← Overview
          </a>
          <label className="searchbox" style={{ marginLeft: "auto" }}>
            <Icon name="search" />
            <input
              placeholder="Search by title, skill, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">OPPORTUNITY INBOX</p>
            <h1>Explore Opportunities</h1>
            <p className="subtitle">Only profile-eligible records appear here.</p>
          </div>
          <div className="persona-picker">
            <label>Persona</label>
            <select
              className="profile-select"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
            >
              {profiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filters">
          {(["all", "job", "contract", "client"] as const).map((value) => (
            <button
              className={kind === value ? "filter selected" : "filter"}
              onClick={() => setKind(value)}
              key={value}
            >
              {value === "all"
                ? "All opportunities"
                : value === "client"
                ? "Client signals"
                : `${value[0].toUpperCase()}${value.slice(1)}s`}
            </button>
          ))}
        </div>

        <div className="opportunity-grid">
          {isLoading ? (
            <p className="loading">Loading opportunities…</p>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: "span 2" }}>
              <h2>No opportunities found</h2>
              <p>No records matched your criteria. You can create a search agent to discover more.</p>
              <a
                className="text-button"
                href="/discovery"
                style={{ display: "inline-flex", margin: "16px auto 0" }}
              >
                Go to Discovery Hub <Icon name="arrow" />
              </a>
            </div>
          ) : (
            filteredItems.map((item) => (
              <OpportunityCard
                key={item.id}
                opportunity={item}
                profileId={profileId}
                onAction={action}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

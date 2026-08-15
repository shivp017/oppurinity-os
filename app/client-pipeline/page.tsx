"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Icon } from "@/components/icons";
import type {
  ClientOpportunity,
  ClientOpportunityStatus,
  Contact,
  OutreachDraft,
  Profile,
  ServiceProfile,
} from "@/lib/types";

const STAGES: { key: ClientOpportunityStatus; label: string }[] = [
  { key: "DISCOVERED", label: "Discovered" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "OUTREACH_READY", label: "Outreach Ready" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "RESPONDED", label: "Responded" },
  { key: "CONVERTED", label: "Converted" },
];

export default function ClientPipeline() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>("revops");
  const [leads, setLeads] = useState<ClientOpportunity[]>([]);
  const [services, setServices] = useState<ServiceProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Lead Drawer
  const [selectedLead, setSelectedLead] = useState<ClientOpportunity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);

  // New Lead Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newFacts, setNewFacts] = useState("");
  const [newInference, setNewInference] = useState("");
  const [newServiceId, setNewServiceId] = useState("");
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  // New Contact State
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactTitle, setNewContactTitle] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);

  // New Outreach Draft State
  const [newDraftSubject, setNewDraftSubject] = useState("");
  const [newDraftBody, setNewDraftBody] = useState("");
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  // Stage Filter
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    async function loadInitial() {
      try {
        const [profRes, servRes] = await Promise.all([
          fetch("/api/profiles"),
          fetch(`/api/service-profiles?profileId=${activeProfile}`),
        ]);
        if (profRes.ok) {
          const profData = await profRes.json();
          setProfiles(profData);
        }
        if (servRes.ok) {
          setServices(await servRes.json());
        }
      } catch (err) {
        console.error(err);
      }
    }
    void loadInitial();
  }, [activeProfile]);

  useEffect(() => {
    async function loadLeads() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/client-opportunities?profileId=${activeProfile}`);
        if (res.ok) {
          const data = await res.json();
          setLeads(data);
          if (selectedLead) {
            const updated = data.find((l: ClientOpportunity) => l.id === selectedLead.id);
            if (updated) setSelectedLead(updated);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadLeads();
  }, [activeProfile]);

  async function openLeadDrawer(lead: ClientOpportunity) {
    setSelectedLead(lead);
    setIsDrawerLoading(true);
    setContactError(null);
    try {
      const [contRes, draftRes] = await Promise.all([
        fetch(`/api/contacts?companyId=${lead.companyId}`),
        fetch(`/api/outreach-drafts?clientOpportunityId=${lead.id}`),
      ]);
      if (contRes.ok) setContacts(await contRes.json());
      if (draftRes.ok) setDrafts(await draftRes.json());

      // Pre-fill a smart outreach template if no draft exists
      if (draftRes.ok) {
        const existingDrafts = await draftRes.json();
        if (existingDrafts.length === 0) {
          setNewDraftSubject(`RevOps & Systems Optimization for ${lead.companyName}`);
          setNewDraftBody(
            `Hi there,\n\nI noticed ${lead.companyName} is expanding its GTM operations. Given your recent focus on ${
              lead.facts?.[0] || "scaling pipeline infrastructure"
            }, many high-velocity teams face bottlenecks with CRM attribution and lifecycle automation.\n\nI specialize in turnkey architecture for growing teams. Happy to share a quick 1-pager if useful.\n\nBest,\nShiv`
          );
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDrawerLoading(false);
    }
  }

  async function handleUpdateStage(leadId: string, newStatus: ClientOpportunityStatus) {
    try {
      const res = await fetch("/api/client-opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: updated.status } : l)));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, status: updated.status } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyName || !newTitle) return;
    setIsSubmittingLead(true);
    try {
      const factsList = newFacts
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await fetch("/api/client-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: activeProfile,
          companyName: newCompanyName,
          domain: newCompanyDomain || undefined,
          industry: newCompanyIndustry || undefined,
          title: newTitle,
          score: 88,
          facts: factsList,
          inference: newInference || undefined,
          serviceProfileId: newServiceId || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setLeads((prev) => [created, ...prev]);
        setShowAddModal(false);
        setNewCompanyName("");
        setNewCompanyDomain("");
        setNewCompanyIndustry("");
        setNewTitle("");
        setNewFacts("");
        setNewInference("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingLead(false);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead || !newContactEmail) return;
    setContactError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: selectedLead.companyId,
          email: newContactEmail,
          fullName: newContactName || undefined,
          title: newContactTitle || undefined,
          consentStatus: "PERMITTED",
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setContacts((prev) => [created, ...prev]);
        setNewContactEmail("");
        setNewContactName("");
        setNewContactTitle("");
      } else {
        const data = await res.json();
        setContactError(data.error || "Failed to add contact");
      }
    } catch (err) {
      setContactError("Error adding contact");
    }
  }

  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead || !newDraftSubject || !newDraftBody) return;
    setIsCreatingDraft(true);
    try {
      const res = await fetch("/api/outreach-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientOpportunityId: selectedLead.id,
          subject: newDraftSubject,
          body: newDraftBody,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setDrafts((prev) => [created, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingDraft(false);
    }
  }

  async function handleApproveDraft(draftId: string) {
    try {
      const res = await fetch("/api/outreach-drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, status: "APPROVED" }),
      });
      if (res.ok) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === draftId ? { ...d, status: "APPROVED" } : d))
        );
      }
    } catch (err) {
      console.error(err);
    }
  }

  const filteredLeads =
    activeFilter === "all" ? leads : leads.filter((l) => l.status === activeFilter);

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
            onClick={() => setShowAddModal(true)}
          >
            <Icon name="plus" /> Add Client Lead
          </button>
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">CLIENT ACQUISITION & CRM</p>
            <h1>Client Pipeline</h1>
            <p className="subtitle">
              Verified buying signals, explainable inference, consent tracking, and approved outreach.
            </p>
          </div>
          <div className="persona-picker">
            <label>Service Persona</label>
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

        {/* Stage Filter Bar */}
        <div className="filters" style={{ marginBottom: "20px" }}>
          <button
            className={activeFilter === "all" ? "filter selected" : "filter"}
            onClick={() => setActiveFilter("all")}
          >
            All Signals ({leads.length})
          </button>
          {STAGES.map((st) => {
            const count = leads.filter((l) => l.status === st.key).length;
            return (
              <button
                className={activeFilter === st.key ? "filter selected" : "filter"}
                onClick={() => setActiveFilter(st.key)}
                key={st.key}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Pipeline Leads Grid */}
        {isLoading ? (
          <p className="loading">Loading client pipeline…</p>
        ) : filteredLeads.length === 0 ? (
          <div className="empty-state">
            <h2>No client opportunities in this stage</h2>
            <p>Add a client lead or discovery signal to begin outreach preparation.</p>
            <button
              className="primary"
              style={{ margin: "16px auto 0" }}
              onClick={() => setShowAddModal(true)}
            >
              <Icon name="plus" /> Add new lead
            </button>
          </div>
        ) : (
          <div className="client-grid">
            {filteredLeads.map((lead) => (
              <article
                className={`client-card ${selectedLead?.id === lead.id ? "selected" : ""}`}
                key={lead.id}
                onClick={() => openLeadDrawer(lead)}
              >
                <div className="card-top">
                  <span className="kind client">{lead.status.replaceAll("_", " ")}</span>
                  <div className="score" style={{ width: "36px", height: "36px" }}>
                    <strong>{lead.score}</strong>
                  </div>
                </div>
                <h3>{lead.title}</h3>
                <p className="company-info">
                  <b>{lead.companyName}</b>
                  {lead.domain && <span> · {lead.domain}</span>}
                </p>

                {/* Facts Pills */}
                <div className="facts-preview">
                  <span className="verified-badge">
                    <Icon name="check" /> {lead.facts?.length ?? 0} Verified Facts
                  </span>
                  {lead.inference && <span className="inference-badge">✦ AI Inference</span>}
                </div>

                <footer className="client-card-footer">
                  <small>{lead.serviceName || "General Advisory"}</small>
                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLeadDrawer(lead);
                    }}
                  >
                    View Details →
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}

        {/* Lead Detail Drawer */}
        {selectedLead && (
          <div className="modal-backdrop" role="presentation">
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
              <header className="drawer-header">
                <div>
                  <span className="kind client">{selectedLead.status.replaceAll("_", " ")}</span>
                  <h2>{selectedLead.title}</h2>
                  <p>
                    {selectedLead.companyName} {selectedLead.domain && `(${selectedLead.domain})`}
                  </p>
                </div>
                <button className="icon-button" onClick={() => setSelectedLead(null)}>
                  ✕
                </button>
              </header>

              <div className="drawer-body">
                {/* Stage Progression Controller */}
                <section className="drawer-section">
                  <label className="section-label">Pipeline Stage</label>
                  <div className="stage-buttons">
                    {STAGES.map((st) => (
                      <button
                        className={selectedLead.status === st.key ? "stage-btn active" : "stage-btn"}
                        onClick={() => handleUpdateStage(selectedLead.id, st.key)}
                        key={st.key}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Verified Facts vs AI Inference */}
                <div className="facts-inference-split">
                  <div className="facts-col">
                    <h3>
                      <span className="dot green-dot" /> Verified Source Facts
                    </h3>
                    <p className="subtext">Empirical, verifiable company intelligence</p>
                    <ul className="facts-list">
                      {(selectedLead.facts ?? []).map((fact, idx) => (
                        <li key={idx}>✓ {fact}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="inference-col">
                    <h3>
                      <span className="dot blue-dot" /> AI Advisory Inference
                    </h3>
                    <p className="subtext">Contextual extrapolation based on company signals</p>
                    <div className="inference-box">
                      {selectedLead.inference ? (
                        <p>{selectedLead.inference}</p>
                      ) : (
                        <p className="muted">No inference generated for this signal.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Outreach Studio */}
                <section className="drawer-section" style={{ marginTop: "24px" }}>
                  <div className="section-title">
                    <div>
                      <h3>Outreach Studio</h3>
                      <p>Drafts reference verified facts. Explicit manual approval required before sending.</p>
                    </div>
                  </div>

                  {drafts.length > 0 && (
                    <div className="drafts-list" style={{ marginTop: "12px" }}>
                      {drafts.map((d) => (
                        <article className="draft-card" key={d.id}>
                          <div className="draft-top">
                            <b>Subject: {d.subject}</b>
                            <span className={`status ${d.status === "APPROVED" ? "active" : "paused"}`}>
                              {d.status}
                            </span>
                          </div>
                          <pre className="draft-body">{d.body}</pre>
                          {d.status === "DRAFT" && (
                            <button
                              className="action-button"
                              style={{ marginTop: "8px" }}
                              onClick={() => handleApproveDraft(d.id)}
                            >
                              ✓ Approve Draft (Gated)
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  )}

                  <form className="new-draft-form" onSubmit={handleCreateDraft} style={{ marginTop: "16px" }}>
                    <label>
                      Subject Line
                      <input
                        required
                        value={newDraftSubject}
                        onChange={(e) => setNewDraftSubject(e.target.value)}
                      />
                    </label>
                    <label>
                      Email Body
                      <textarea
                        required
                        rows={6}
                        value={newDraftBody}
                        onChange={(e) => setNewDraftBody(e.target.value)}
                      />
                    </label>
                    <button className="primary" type="submit" disabled={isCreatingDraft}>
                      {isCreatingDraft ? "Saving…" : "Save New Outreach Draft"}
                    </button>
                  </form>
                </section>

                {/* Verified Contacts & Consent */}
                <section className="drawer-section" style={{ marginTop: "24px" }}>
                  <h3>Company Contacts & Consent Status</h3>
                  <div className="contacts-table" style={{ marginTop: "12px" }}>
                    {contacts.length === 0 ? (
                      <p className="muted">No verified contacts linked yet.</p>
                    ) : (
                      contacts.map((c) => (
                        <div className="contact-row" key={c.id}>
                          <div>
                            <b>{c.fullName || "Unnamed Contact"}</b>
                            <small>{c.title || "Role not specified"}</small>
                          </div>
                          <div>
                            <code>{c.email}</code>
                          </div>
                          <span
                            className={`status ${
                              c.consentStatus === "PERMITTED"
                                ? "active"
                                : c.consentStatus === "OPTED_OUT"
                                ? "paused"
                                : ""
                            }`}
                          >
                            {c.consentStatus}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="add-contact-form" onSubmit={handleAddContact} style={{ marginTop: "16px" }}>
                    <h4>Add Contact (Verified Consent)</h4>
                    {contactError && <p className="run-error">{contactError}</p>}
                    <div className="form-row-3">
                      <input
                        placeholder="Full Name"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                      />
                      <input
                        placeholder="Title / Role"
                        value={newContactTitle}
                        onChange={(e) => setNewContactTitle(e.target.value)}
                      />
                      <input
                        required
                        type="email"
                        placeholder="Email (checked vs suppression)"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                      />
                    </div>
                    <button className="action-button" type="submit" style={{ marginTop: "8px" }}>
                      + Add Contact
                    </button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Add Client Lead Modal */}
        {showAddModal && (
          <div className="modal-backdrop" role="presentation">
            <form className="profile-form" style={{ width: "min(560px, 100%)" }} onSubmit={handleCreateLead}>
              <div>
                <p className="eyebrow">NEW CLIENT OPPORTUNITY</p>
                <h2>Record Buying Signal & Lead</h2>
                <p>Attach verified empirical company facts and optional advisory inferences.</p>
              </div>
              <label>
                Company Name
                <input
                  required
                  placeholder="e.g. Arcade Software"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
              </label>
              <div className="form-row-2">
                <label>
                  Domain
                  <input
                    placeholder="e.g. arcade.software"
                    value={newCompanyDomain}
                    onChange={(e) => setNewCompanyDomain(e.target.value)}
                  />
                </label>
                <label>
                  Industry
                  <input
                    placeholder="e.g. DevTools, B2B SaaS"
                    value={newCompanyIndustry}
                    onChange={(e) => setNewCompanyIndustry(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Opportunity Title
                <input
                  required
                  placeholder="e.g. HubSpot CRM & Lifecycle Scaling Bridge"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>
              <label>
                Target Service Profile
                <select
                  className="profile-select"
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                >
                  <option value="">General Advisory / Custom</option>
                  {services.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Verified Facts (1 per line)
                <textarea
                  rows={3}
                  placeholder="e.g. Hiring 3 Enterprise AEs&#10;Using HubSpot CRM with no dedicated hire&#10;Raised $12M Series A"
                  value={newFacts}
                  onChange={(e) => setNewFacts(e.target.value)}
                />
              </label>
              <label>
                Advisory Inference (AI Context)
                <textarea
                  rows={2}
                  placeholder="e.g. Likely experiencing lead routing and attribution leakage as sales team doubles."
                  value={newInference}
                  onChange={(e) => setNewInference(e.target.value)}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={isSubmittingLead}>
                  {isSubmittingLead ? "Creating…" : "Add Client Signal"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

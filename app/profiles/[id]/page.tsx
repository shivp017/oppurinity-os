"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Icon } from "@/components/icons";
import type { Profile, ProfilePreferences, ServiceProfile } from "@/lib/types";

type Resume = { id: string; fileName: string; byteSize: number; createdAt: string };
type ProfileDetail = Profile & ProfilePreferences;

const KINDS = ["job", "contract", "client"] as const;
const WORK_AUTHS = ["US Citizen", "Green Card", "Work Authorized (Visa/OPT)", "Contractor C2C"];

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [services, setServices] = useState<ServiceProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // New Service Profile modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [serviceIndustries, setServiceIndustries] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profRes, resumeRes, servRes, allProfRes] = await Promise.all([
          fetch(`/api/profiles/${id}`),
          fetch(`/api/profiles/${id}/resume`),
          fetch(`/api/service-profiles?profileId=${id}`),
          fetch("/api/profiles"),
        ]);
        if (profRes.ok) setProfile(await profRes.json());
        if (resumeRes.ok) setResumes(await resumeRes.json());
        if (servRes.ok) setServices(await servRes.json());
        if (allProfRes.ok) setAllProfiles(await allProfRes.json());
      } catch (err) {
        console.error(err);
      }
    }
    void loadData();
  }, [id]);

  async function handleUploadResume(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("resume", file);
      const res = await fetch(`/api/profiles/${id}/resume`, {
        method: "POST",
        body: data,
      });
      if (res.ok) {
        const resume = (await res.json()) as Resume;
        setResumes((prev) => [resume, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTitles: profile.targetTitles,
          preferredKinds: profile.preferredKinds,
          remoteOnly: profile.remoteOnly,
          minMatchScore: profile.minMatchScore,
          skills: profile.skills,
          minHourlyRate: profile.minHourlyRate,
          minAnnualComp: profile.minAnnualComp,
          workAuthorization: profile.workAuthorization,
          availability: profile.availability,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
        setSaveMessage("Profile intelligence preferences updated successfully.");
        setTimeout(() => setSaveMessage(null), 3500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleAddSkill(e: React.KeyboardEvent) {
    if (e.key === "Enter" && newSkill.trim()) {
      e.preventDefault();
      const skillClean = newSkill.trim();
      if (profile && !profile.skills?.includes(skillClean)) {
        setProfile({
          ...profile,
          skills: [...(profile.skills || []), skillClean],
        });
      }
      setNewSkill("");
    }
  }

  function handleRemoveSkill(skillToRemove: string) {
    if (!profile) return;
    setProfile({
      ...profile,
      skills: (profile.skills || []).filter((s) => s !== skillToRemove),
    });
  }

  function handleToggleKind(kind: "job" | "contract" | "client") {
    if (!profile) return;
    const current = profile.preferredKinds || [];
    setProfile({
      ...profile,
      preferredKinds: current.includes(kind)
        ? current.filter((k) => k !== kind)
        : [...current, kind],
    });
  }

  function handleToggleAuth(auth: string) {
    if (!profile) return;
    const current = profile.workAuthorization || [];
    setProfile({
      ...profile,
      workAuthorization: current.includes(auth)
        ? current.filter((a) => a !== auth)
        : [...current, auth],
    });
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceName || !serviceDesc) return;
    try {
      const indList = serviceIndustries
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
      const res = await fetch("/api/service-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: id,
          name: serviceName,
          description: serviceDesc,
          targetIndustries: indList,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setServices((prev) => [created, ...prev]);
        setShowServiceModal(false);
        setServiceName("");
        setServiceDesc("");
        setServiceIndustries("");
      }
    } catch (err) {
      console.error(err);
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
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Switch persona:</span>
            <select
              className="profile-select"
              value={id}
              onChange={(e) => {
                window.location.href = `/profiles/${e.target.value}`;
              }}
            >
              {allProfiles.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="page-header">
          <div>
            <p className="eyebrow">PERSONA INTELLIGENCE</p>
            <h1>{profile?.name ?? "Loading profile…"}</h1>
            <p className="subtitle">{profile?.role}</p>
          </div>
        </div>

        {saveMessage && (
          <div className="alert-success" style={{ marginBottom: "20px" }}>
            ✓ {saveMessage}
          </div>
        )}

        <div className="profile-settings-grid">
          {/* Column 1: Matching Rules & Preferences */}
          <form className="preference-form" onSubmit={handleSavePreferences}>
            <div className="section-title">
              <div>
                <h2>Deterministic Matching Rules</h2>
                <p>Rules apply strictly to all incoming opportunities before display.</p>
              </div>
            </div>

            <label>
              Target Job & Role Titles (comma-separated)
              <input
                value={profile?.targetTitles.join(", ") ?? ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          targetTitles: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        }
                      : null
                  )
                }
                placeholder="e.g. RevOps Manager, HubSpot Consultant, GTM Architect"
              />
            </label>

            {/* Skills Tag Input */}
            <div className="form-group">
              <label>Skills & Tech Stack Tags</label>
              <div className="skills-container">
                {(profile?.skills || []).map((skill) => (
                  <span className="skill-tag" key={skill}>
                    {skill}
                    <button type="button" onClick={() => handleRemoveSkill(skill)}>
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  className="skill-input"
                  placeholder="Add skill and press Enter…"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleAddSkill}
                />
              </div>
              <small className="help-text">Type a skill name and press Enter.</small>
            </div>

            {/* Rate & Comp Expectations */}
            <div className="form-row-2">
              <label>
                Min. Hourly Rate ($/hr)
                <input
                  type="number"
                  placeholder="e.g. 85"
                  value={profile?.minHourlyRate ?? ""}
                  onChange={(e) =>
                    setProfile((prev) =>
                      prev
                        ? { ...prev, minHourlyRate: e.target.value ? Number(e.target.value) : undefined }
                        : null
                    )
                  }
                />
              </label>
              <label>
                Min. Annual Compensation ($)
                <input
                  type="number"
                  placeholder="e.g. 140000"
                  value={profile?.minAnnualComp ?? ""}
                  onChange={(e) =>
                    setProfile((prev) =>
                      prev
                        ? { ...prev, minAnnualComp: e.target.value ? Number(e.target.value) : undefined }
                        : null
                    )
                  }
                />
              </label>
            </div>

            {/* Opportunity Types */}
            <fieldset>
              <legend>Eligible Opportunity Kinds</legend>
              <div className="checkbox-row">
                {KINDS.map((kind) => (
                  <label className="check-label" key={kind}>
                    <input
                      type="checkbox"
                      checked={profile?.preferredKinds?.includes(kind) ?? false}
                      onChange={() => handleToggleKind(kind)}
                    />
                    {kind.charAt(0).toUpperCase() + kind.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Location & Remote */}
            <div className="checkbox-row">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={profile?.remoteOnly ?? false}
                  onChange={(e) =>
                    setProfile((prev) =>
                      prev ? { ...prev, remoteOnly: e.target.checked } : null
                    )
                  }
                />
                Remote positions only
              </label>
            </div>

            {/* Work Authorization */}
            <fieldset>
              <legend>Work Authorization / Billing Type</legend>
              <div className="checkbox-row">
                {WORK_AUTHS.map((auth) => (
                  <label className="check-label" key={auth}>
                    <input
                      type="checkbox"
                      checked={profile?.workAuthorization?.includes(auth) ?? false}
                      onChange={() => handleToggleAuth(auth)}
                    />
                    {auth}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Availability */}
            <label>
              Availability / Start Date
              <select
                className="profile-select"
                value={profile?.availability ?? "Immediate"}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, availability: e.target.value } : null
                  )
                }
              >
                <option value="Immediate">Immediate / Available Now</option>
                <option value="2 weeks">2 weeks notice</option>
                <option value="1 month">1 month notice</option>
                <option value="Flexible">Flexible / Part-time only</option>
              </select>
            </label>

            {/* Min Match Score */}
            <label>
              Minimum Match Score Threshold: <b>{profile?.minMatchScore ?? 0}%</b>
              <input
                type="range"
                min="0"
                max="100"
                value={profile?.minMatchScore ?? 0}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, minMatchScore: Number(e.target.value) } : null
                  )
                }
              />
            </label>

            <button className="primary" disabled={saving || !profile} type="submit">
              {saving ? "Saving preferences…" : "Save Intelligence Preferences"}
            </button>
          </form>

          {/* Column 2: Resume History & Service Profiles */}
          <div className="profile-side-column">
            {/* Resume Versions */}
            <article className="settings-card">
              <div className="section-title">
                <div>
                  <h2>Resume Versions</h2>
                  <p>Uploaded resumes remain strictly isolated to this persona.</p>
                </div>
              </div>

              <label className="upload-control" style={{ marginTop: "14px" }}>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleUploadResume}
                  disabled={uploading}
                />
                <span>{uploading ? "Uploading resume…" : "＋ Upload new resume version"}</span>
              </label>

              <div className="resume-list" style={{ marginTop: "14px" }}>
                {resumes.length === 0 ? (
                  <p className="muted">No resume uploaded yet for this persona.</p>
                ) : (
                  resumes.map((resume) => (
                    <div className="resume-item" key={resume.id}>
                      <span className="doc-icon">▤</span>
                      <div>
                        <b>{resume.fileName}</b>
                        <small>
                          {Math.ceil(resume.byteSize / 1024)} KB ·{" "}
                          {new Date(resume.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            {/* Service Profiles for Client Acquisition */}
            <article className="settings-card" style={{ marginTop: "20px" }}>
              <div className="section-title">
                <div>
                  <h2>Client Service Offerings</h2>
                  <p>Services offered for inbound & outbound client pipelines.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setShowServiceModal(true)}
                >
                  <Icon name="plus" /> Add service
                </button>
              </div>

              <div className="services-list" style={{ marginTop: "14px" }}>
                {services.length === 0 ? (
                  <p className="muted">No service offerings created yet.</p>
                ) : (
                  services.map((serv) => (
                    <div className="service-card" key={serv.id}>
                      <b>{serv.name}</b>
                      <p>{serv.description}</p>
                      {serv.targetIndustries && serv.targetIndustries.length > 0 && (
                        <div className="industry-tags">
                          {serv.targetIndustries.map((ind) => (
                            <span className="industry-tag" key={ind}>
                              {ind}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </div>

        {/* New Service Profile Modal */}
        {showServiceModal && (
          <div className="modal-backdrop" role="presentation">
            <form className="profile-form" onSubmit={handleCreateService}>
              <div>
                <p className="eyebrow">NEW SERVICE OFFERING</p>
                <h2>Create Service Profile</h2>
                <p>Define an advisory offering for {profile?.name}.</p>
              </div>
              <label>
                Service Name
                <input
                  required
                  placeholder="e.g. HubSpot CRM Architecture & Attribution"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Turnkey CRM data modeling, pipeline automations, and billing reconciliation for B2B SaaS."
                  value={serviceDesc}
                  onChange={(e) => setServiceDesc(e.target.value)}
                />
              </label>
              <label>
                Target Industries (comma-separated)
                <input
                  placeholder="e.g. B2B SaaS, Fintech, Developer Tools"
                  value={serviceIndustries}
                  onChange={(e) => setServiceIndustries(e.target.value)}
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowServiceModal(false)}
                >
                  Cancel
                </button>
                <button className="primary" type="submit">
                  Save Service
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

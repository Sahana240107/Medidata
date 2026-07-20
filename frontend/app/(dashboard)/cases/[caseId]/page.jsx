"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCase } from "@/lib/api/cases";
import { useAuthStore } from "@/store/useAuthStore";

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--navy)" }}>{value || "—"}</div>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 600, background: "var(--lavender-50)", color: "var(--lavender-700, #4338ca)",
      marginRight: 6, marginBottom: 6,
    }}>
      {children}
    </span>
  );
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const caseId = params?.caseId;

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !caseId) return;
    setLoading(true);
    setError("");
    getCase(caseId, token)
      .then(setCaseData)
      .catch((err) => setError(err.message || "Could not load this case."))
      .finally(() => setLoading(false));
  }, [token, caseId]);

  const handleClose = () => {
    if (window.history.length > 1) router.back();
    else router.push("/cases");
  };

  return (
    <>
      <header style={{
        padding: "16px 32px", background: "var(--white)", borderBottom: "1px solid var(--lavender-100)",
        position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>
            Case detail
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
            {caseData ? caseData.fingerprint_id : "Loading…"}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          style={{
            width: 34, height: 34, borderRadius: 8, border: "1.5px solid var(--lavender-100)",
            background: "var(--white)", color: "var(--text-muted)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}
        >
          ✕
        </button>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: 760 }}>
        {loading && (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Loading case…
          </div>
        )}

        {!loading && error && <div className="auth-alert auth-alert--error">{error}</div>}

        {!loading && !error && caseData && (
          <>
            <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
                <Field label="Age range" value={caseData.age_range} />
                <Field label="Sex" value={caseData.sex} />
                <Field label="Country" value={caseData.country} />
                <Field label="Outcome" value={caseData.outcome} />
                <Field label="Status" value={caseData.status} />
                <Field label="Submitted" value={new Date(caseData.created_at).toLocaleString()} />
              </div>
            </div>

            <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>
                Symptoms
              </div>
              {(caseData.symptoms || []).length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>None recorded.</div>}
              {(caseData.symptoms || []).map((s, i) => <Chip key={i}>{s.name}{s.onset_day != null ? ` · day ${s.onset_day}` : ""}</Chip>)}
            </div>

            <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>
                Lab results
              </div>
              {(caseData.lab_results || []).length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>None recorded.</div>}
              {(caseData.lab_results || []).map((l, i) => <Chip key={i}>{l.marker}: {l.value}{l.flag ? ` (${l.flag})` : ""}</Chip>)}
            </div>

            <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: 22, marginBottom: 20 }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>
                Medications & procedures
              </div>
              {(caseData.medications || []).map((m, i) => <Chip key={`m${i}`}>{m.name}{m.response ? ` · ${m.response}` : ""}</Chip>)}
              {(caseData.procedures || []).map((p, i) => <Chip key={`p${i}`}>{p}</Chip>)}
              {(caseData.medications || []).length === 0 && (caseData.procedures || []).length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>None recorded.</div>
              )}
            </div>

            {caseData.clinical_notes_summary && (
              <div style={{ background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: 22 }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>
                  Clinical summary
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {caseData.clinical_notes_summary}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
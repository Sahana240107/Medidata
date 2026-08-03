"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listCases } from "@/lib/api/cases";
import { useAuthStore } from "@/store/useAuthStore";

const PAGE_SIZE = 200;

function OutcomeTag({ outcome }) {
  const palettes = {
    recovered: { bg: "#dcfce7", color: "#16a34a" },
    deteriorated: { bg: "#fee2e2", color: "#dc2626" },
    unresolved: { bg: "#fef3c7", color: "#d97706" },
  };
  const p = palettes[outcome] || { bg: "var(--lavender-50)", color: "var(--text-muted)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: p.bg, color: p.color, textTransform: "capitalize",
    }}>
      {outcome || "unknown"}
    </span>
  );
}

function CaseCard({ c }) {
  const symptomNames = (c.symptoms || []).map((s) => s.name).filter(Boolean);
  return (
    <Link
      href={`/cases/${c.id}`}
      style={{
        display: "block", background: "var(--white)", border: "1.5px solid var(--lavender-100)",
        borderRadius: 14, padding: 18, textDecoration: "none", color: "inherit",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lavender-300, #a5b4fc)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lavender-100)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 13.5, fontWeight: 700, color: "var(--navy)" }}>
          {c.fingerprint_id}
        </div>
        <OutcomeTag outcome={c.outcome} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
        {c.age_range || "Age n/a"} · {c.sex || "sex n/a"} · {c.country || "location n/a"}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, minHeight: 18 }}>
        {symptomNames.length > 0 ? symptomNames.slice(0, 4).join(", ") : "No symptoms recorded"}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
        {new Date(c.created_at).toLocaleDateString()} · status: {c.status}
      </div>
    </Link>
  );
}

export default function CasesListPage() {
  const token = useAuthStore((s) => s.token);
  const [cases, setCases] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const load = (nextOffset) => {
    if (!token) return;
    setLoading(true);
    setError("");
    listCases(token, { limit: PAGE_SIZE, offset: nextOffset })
      .then((data) => {
        setCases(data || []);
        setHasMore((data || []).length === PAGE_SIZE);
      })
      .catch((err) => setError(err.message || "Could not load cases."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(offset); /* eslint-disable-next-line */ }, [token, offset]);

  return (
    <>
      <header style={{
        padding: "16px 32px", background: "var(--white)", borderBottom: "1px solid var(--lavender-100)",
        position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>
            Cases
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
            De-identified cases synced from your hospital via the MediData CLI.
          </div>
        </div>
      </header>

      <div style={{ padding: "24px 32px" }}>
        {error && <div className="auth-alert auth-alert--error" style={{ marginBottom: 16 }}>{error}</div>}

        {loading && (
          <div style={{ padding: 40, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Loading cases…
          </div>
        )}

        {!loading && !error && cases.length === 0 && (
          <div style={{
            padding: "48px 20px", textAlign: "center", fontSize: 13, color: "var(--text-muted)",
            background: "#f8f9fc", border: "1px dashed var(--lavender-200)", borderRadius: 12,
          }}>
            No cases synced yet. Run <code>medidata sync</code> from your hospital's CLI to bring in new cases.
          </div>
        )}

        {!loading && cases.length > 0 && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16,
            }}>
              {cases.map((c) => <CaseCard key={c.id} c={c} />)}
            </div>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 28 }}>
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                style={{
                  background: "none", border: "1.5px solid var(--lavender-100)", borderRadius: 8,
                  padding: "7px 14px", fontSize: 13, cursor: offset === 0 ? "not-allowed" : "pointer",
                  color: offset === 0 ? "var(--text-muted)" : "var(--navy)", fontFamily: "inherit",
                  opacity: offset === 0 ? 0.5 : 1,
                }}
              >
                ← Previous
              </button>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Showing {offset + 1}–{offset + cases.length}
              </span>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                style={{
                  background: "none", border: "1.5px solid var(--lavender-100)", borderRadius: 8,
                  padding: "7px 14px", fontSize: 13, cursor: !hasMore ? "not-allowed" : "pointer",
                  color: !hasMore ? "var(--text-muted)" : "var(--navy)", fontFamily: "inherit",
                  opacity: !hasMore ? 0.5 : 1,
                }}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
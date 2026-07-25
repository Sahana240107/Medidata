"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { getSyncHistory } from "@/lib/api/clisync";
import { isCliReachable, getSetupStatus, cliSyncPreview, cliSyncApprove } from "@/lib/api/localCli";

// ─── sync history (audit trail from the backend, not the local CLI) ─────

function statusChip(row) {
  if (row.rejected_count > 0 && row.accepted_count === 0) return { label: "Rejected", bg: "#fee2e2", color: "#dc2626" };
  if (row.accepted_count > 0) return { label: "Synced", bg: "#dcfce7", color: "#16a34a" };
  return { label: "No new records", bg: "var(--lavender-50)", color: "var(--text-muted)" };
}

function SyncHistory({ refreshKey }) {
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getSyncHistory(token, { limit: 20 })
      .then((data) => setRows(data || []))
      .catch((err) => setError(err.message || "Could not load sync history."))
      .finally(() => setLoading(false));
  }, [token, refreshKey]);

  if (loading) return <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Loading sync history…</div>;
  if (error) return <div className="auth-alert auth-alert--error">{error}</div>;
  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "var(--text-muted)", background: "#f8f9fc", border: "1px dashed var(--lavender-200)", borderRadius: 12 }}>
        No syncs yet. Submit new cases above and they'll show up here once verified.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) => {
        const chip = statusChip(row);
        return (
          <div key={row.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{new Date(row.created_at).toLocaleString()}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {row.accepted_count} accepted · {row.duplicate_count} duplicate · {row.rejected_count} rejected
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: chip.bg, color: chip.color }}>
                {chip.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── privacy report summary ───────────────────────────────────────────────

function ReportStat({ label, value }) {
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)", fontFamily: "'Sora', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function PrivacyReportSummary({ preview }) {
  const r = preview.privacy_report || {};
  return (
    <div style={{ display: "flex", gap: 28, flexWrap: "wrap", padding: "16px 4px" }}>
      <ReportStat label="Records found" value={preview.records_found} />
      <ReportStat label="Passed validation" value={preview.valid_count} />
      <ReportStat label="Rejected" value={preview.rejected?.length || 0} />
      {r.k_anonymity_summary?.k !== undefined && <ReportStat label="k-anonymity (k)" value={r.k_anonymity_summary.k} />}
    </div>
  );
}

function BeforeAfterSample({ preview }) {
  if (!preview.sample_before || !preview.sample_after) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8, minWidth: 0 }}>
      {[["Local record (raw)", preview.sample_before], ["What gets uploaded (anonymized)", preview.sample_after]].map(([label, obj]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
          <pre style={{
            background: "var(--navy)", color: "#dbe1f7", borderRadius: 10, padding: "12px 14px",
            fontSize: 11, lineHeight: 1.6, maxHeight: 260, overflowY: "auto", overflowX: "hidden", margin: 0,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word",
            boxSizing: "border-box", maxWidth: "100%",
          }}>
            {JSON.stringify(obj, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────

export default function CaseSubmission() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const reachable = await isCliReachable();
      if (!reachable) { setReady(false); setChecking(false); return; }
      try {
        const status = await getSetupStatus();
        const ok = status.logged_in && status.mysql_configured && status.mysql_password_set_this_session && status.doctor_mapped;
        setReady(!!ok);
      } catch {
        setReady(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [approveState, setApproveState] = useState(null); // "approving" | "success" | "discarded" | null
  const [approveResult, setApproveResult] = useState(null);
  const [approveError, setApproveError] = useState("");
  const [historyKey, setHistoryKey] = useState(0);

  async function handleSubmitNewCases() {
    setPreviewing(true);
    setPreviewError("");
    setPreview(null);
    setApproveState(null);
    setApproveResult(null);
    try {
      const result = await cliSyncPreview({});
      setPreview(result);
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDecision(approve) {
    if (!preview?.batch_id) return;
    setApproveState("approving");
    setApproveError("");
    try {
      const result = await cliSyncApprove({ batch_id: preview.batch_id, approve });
      setApproveResult(result);
      setApproveState(approve ? "success" : "discarded");
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setApproveError(err.message);
      setApproveState(null);
    }
  }

  return (
    <>
      <header style={{ padding: "16px 32px", background: "var(--white)", borderBottom: "1px solid var(--lavender-100)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>Submit New Cases</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
          Fetches new local records for your doctor account, anonymizes them, and lets you review before anything uploads.
        </div>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: 900 }}>
        {checking && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Checking your setup…</div>
        )}

        {!checking && !ready && (
          <div style={{
            background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          }}>
            <div style={{ fontSize: 13, color: "#9a3412" }}>
              Setup isn't complete yet — make sure <code>medidata serve</code> is running and finish the setup steps.
            </div>
            <button
              onClick={() => router.push("/cases/setup")}
              style={{ padding: "8px 14px", background: "#c2410c", color: "white", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Go to setup →
            </button>
          </div>
        )}

        {!checking && ready && (
          <>
            {!preview && (
              <button
                onClick={handleSubmitNewCases}
                disabled={previewing}
                style={{
                  padding: "12px 22px", background: "var(--lavender-600, #5c6bc0)", color: "white", border: "none",
                  borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "'Sora', sans-serif",
                  cursor: previewing ? "not-allowed" : "pointer", opacity: previewing ? 0.7 : 1,
                }}
              >
                {previewing ? "Fetching new cases…" : "Submit New Cases"}
              </button>
            )}
            {previewError && <div className="auth-alert auth-alert--error" style={{ marginTop: 12 }}>{previewError}</div>}

            {preview && preview.records_found === 0 && (
              <div style={{ marginTop: 16, padding: "16px 20px", background: "var(--lavender-50)", borderRadius: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                No new records since your last sync.
                <button onClick={() => setPreview(null)} style={{ marginLeft: 12, background: "none", border: "none", color: "var(--lavender-600, #5c6bc0)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Check again
                </button>
              </div>
            )}

            {preview && preview.records_found > 0 && approveState !== "success" && approveState !== "discarded" && (
              <div style={{ marginTop: 20, background: "var(--white)", border: "1.5px solid var(--lavender-100)", borderRadius: 14, padding: "20px 22px" }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>Review before upload</div>
                <PrivacyReportSummary preview={preview} />

                {preview.rejected?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginBottom: 6 }}>
                      {preview.rejected.length} record(s) failed validation and won't be uploaded:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)" }}>
                      {preview.rejected.slice(0, 5).map((r, i) => (
                        <li key={i}>{(r.errors || []).join("; ")}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.valid_count > 0 ? (
                  <>
                    <BeforeAfterSample preview={preview} />
                    <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                      <button
                        onClick={() => handleDecision(true)}
                        disabled={approveState === "approving"}
                        style={{
                          padding: "10px 20px", background: "#16a34a", color: "white", border: "none", borderRadius: 9,
                          fontSize: 13.5, fontWeight: 700, fontFamily: "'Sora', sans-serif", cursor: "pointer",
                        }}
                      >
                        {approveState === "approving" ? "Uploading…" : `Verify & Upload ${preview.valid_count} case(s)`}
                      </button>
                      <button
                        onClick={() => handleDecision(false)}
                        disabled={approveState === "approving"}
                        style={{
                          padding: "10px 20px", background: "var(--white)", color: "var(--text-secondary)",
                          border: "1.5px solid var(--lavender-100)", borderRadius: 9, fontSize: 13.5, fontWeight: 600,
                          fontFamily: "'Sora', sans-serif", cursor: "pointer",
                        }}
                      >
                        Discard
                      </button>
                    </div>
                    {approveError && <div className="auth-alert auth-alert--error" style={{ marginTop: 12 }}>{approveError}</div>}
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nothing passed validation — nothing to upload.</div>
                )}
              </div>
            )}

            {approveState === "success" && approveResult && (
              <div style={{ marginTop: 20, padding: "18px 20px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: "#16a34a", fontSize: 14 }}>Uploaded</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
                  {approveResult.accepted?.length || 0} case(s) written to the MediData network (Supabase + search index) ·{" "}
                  {approveResult.duplicates?.length || 0} duplicate(s) skipped · {approveResult.rejected?.length || 0} rejected by the server.
                </div>
                <button onClick={() => { setPreview(null); setApproveState(null); setApproveResult(null); }} style={{
                  marginTop: 12, padding: "8px 14px", background: "var(--lavender-600, #5c6bc0)", color: "white",
                  border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                }}>
                  Check for more new cases
                </button>
              </div>
            )}

            {approveState === "discarded" && (
              <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 12, background: "var(--lavender-50)", fontSize: 13, color: "var(--text-secondary)" }}>
                Discarded — nothing left your hospital's network, and your sync watermark didn't move.
                <button onClick={() => { setPreview(null); setApproveState(null); }} style={{ marginLeft: 12, background: "none", border: "none", color: "var(--lavender-600, #5c6bc0)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Back
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 32, marginBottom: 12 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>Recent syncs</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, marginBottom: 12 }}>
            What's already been verified and uploaded from your hospital.
          </div>
          <SyncHistory refreshKey={historyKey} />
        </div>
      </div>
    </>
  );
}
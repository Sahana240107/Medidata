"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import {
  isCliReachable,
  getSetupStatus,
  cliLogin,
  cliSetMysql,
  cliListDoctors,
  cliMapDoctor,
  CLI_LOCAL_URL,
} from "@/lib/api/localCli";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── shared bits ──────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 600,
        padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
        background: copied ? "var(--lavender-600, #5c6bc0)" : "rgba(255,255,255,0.08)",
        color: "white", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ children }) {
  const text = Array.isArray(children) ? children.join("\n") : children;
  return (
    <div style={{ position: "relative", background: "var(--navy)", borderRadius: 10, padding: "14px 16px", marginTop: 10, marginBottom: 4 }}>
      <CopyButton text={text} />
      <pre style={{
        margin: 0, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5,
        lineHeight: 1.7, color: "#dbe1f7", whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: 60,
      }}>
        {text}
      </pre>
    </div>
  );
}

function StepCard({ n, title, description, done, children }) {
  return (
    <div style={{
      background: "var(--white)", border: `1.5px solid ${done ? "#bbf7d0" : "var(--lavender-100)"}`,
      borderRadius: 14, padding: "20px 22px", marginBottom: 16, opacity: done ? 0.85 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
          background: done ? "#dcfce7" : "var(--lavender-50)", color: done ? "#16a34a" : "var(--lavender-700, #4338ca)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, fontFamily: "'Sora', sans-serif",
        }}>
          {done ? "✓" : n}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14.5, fontWeight: 700, color: "var(--navy)" }}>{title}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>{description}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <input
        {...props}
        style={{
          width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--lavender-100)",
          fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
    </label>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      type="submit"
      {...props}
      style={{
        marginTop: 6, padding: "9px 16px", background: "var(--lavender-600, #5c6bc0)", color: "white",
        border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "'Sora', sans-serif",
        cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return <div className="auth-alert auth-alert--error" style={{ marginTop: 10 }}>{message}</div>;
}

// ─── main wizard ────────────────────────────────────────────────────────

export default function CliSetupWizard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState(user?.email || "");
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const [reachable, setReachable] = useState(null); // null = checking
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const refreshStatus = useCallback(async () => {
    const ok = await isCliReachable();
    setReachable(ok);
    if (!ok) return;
    setLoadingStatus(true);
    try {
      const s = await getSetupStatus();
      setStatus(s);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  // Poll until `medidata serve` is up, then keep status fresh after each step.
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(() => {
      setReachable((current) => {
        if (current === true) return current; // stop hammering once connected
        refreshStatus();
        return current;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const loggedIn = !!status?.logged_in;
  const mysqlReady = !!status?.mysql_configured && !!status?.mysql_password_set_this_session;
  const doctorMapped = !!status?.doctor_mapped;
  const allDone = loggedIn && mysqlReady && doctorMapped;

  // ── step 2: login ──
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await cliLogin({ email, password: loginPassword, base_url: API_URL });
      setLoginPassword("");
      await refreshStatus();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  }

  // ── step 3: mysql ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mysqlForm, setMysqlForm] = useState({
    host: "127.0.0.1", port: 3306, database: "medidata_local", user: "", doctors_table: "doctors",
  });
  const [mysqlPassword, setMysqlPassword] = useState("");
  const [mysqlBusy, setMysqlBusy] = useState(false);
  const [mysqlError, setMysqlError] = useState("");

  async function handleMysql(e) {
    e.preventDefault();
    setMysqlBusy(true);
    setMysqlError("");
    try {
      await cliSetMysql({ ...mysqlForm, password: mysqlPassword });
      setMysqlPassword("");
      await refreshStatus();
    } catch (err) {
      setMysqlError(err.message);
    } finally {
      setMysqlBusy(false);
    }
  }

  // ── step 4: doctor mapping ──
  const [doctors, setDoctors] = useState(null);
  const [doctorId, setDoctorId] = useState("");
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [doctorError, setDoctorError] = useState("");

  useEffect(() => {
    if (loggedIn && mysqlReady && !doctorMapped && doctors === null) {
      cliListDoctors()
        .then((d) => {
          setDoctors(d.doctors || []);
          if (d.suggested_id) setDoctorId(String(d.suggested_id));
        })
        .catch((err) => setDoctorError(err.message));
    }
  }, [loggedIn, mysqlReady, doctorMapped, doctors]);

  async function handleMapDoctor(e) {
    e.preventDefault();
    if (!doctorId) return;
    setDoctorBusy(true);
    setDoctorError("");
    try {
      await cliMapDoctor(doctorId);
      await refreshStatus();
    } catch (err) {
      setDoctorError(err.message);
    } finally {
      setDoctorBusy(false);
    }
  }

  return (
    <>
      <header style={{ padding: "16px 32px", background: "var(--white)", borderBottom: "1px solid var(--lavender-100)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>Set up case submission</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
          One-time setup on this machine. After this, submitting cases is a button click — see{" "}
          <a href="/cases/submit" style={{ color: "var(--lavender-600, #5c6bc0)" }}>Submit New Cases</a>.
        </div>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: 760 }}>
        <div style={{
          background: "var(--lavender-50)", border: "1px solid var(--lavender-100)", borderRadius: 12,
          padding: "14px 18px", fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24,
        }}>
          <strong style={{ color: "var(--navy)" }}>Why a download at all?</strong>{" "}
          Raw patient records live in your hospital's local database and are never meant to reach a browser directly.
          The CLI runs a small local-only server on this machine; this page just talks to it over{" "}
          <code>{CLI_LOCAL_URL}</code> so setup and case review happen right here instead of a terminal.
        </div>

        <StepCard n={1} title="Download & extract" done={reachable === true}
          description="Runs on the same machine that can reach your hospital's local MySQL database.">
          <a href="/downloads/medidata-cli.zip" download style={{
            display: "inline-block", marginTop: 12, marginBottom: 4, padding: "9px 16px",
            background: "var(--lavender-600, #5c6bc0)", color: "white", borderRadius: 8,
            fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'Sora', sans-serif",
          }}>
            ⬇ Download medidata-cli.zip
          </a>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>Extract it, then install and start it:</div>
          <CodeBlock>{[
            `unzip medidata-cli.zip && cd medidata-cli`,
            `pip install -e .`,
            `medidata serve --frontend-origin ${origin || "<this site>"}`,
          ]}</CodeBlock>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            Requires Python 3.10+. Keep <code>medidata serve</code> running in that terminal window — everything
            else below happens right here in the browser.
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            {reachable === null && <span style={{ color: "var(--text-muted)" }}>Checking for the local CLI server…</span>}
            {reachable === false && <span style={{ color: "#b45309" }}>● Not detected yet — waiting for <code>medidata serve</code>…</span>}
            {reachable === true && <span style={{ color: "#16a34a" }}>● Connected to the CLI on this machine</span>}
          </div>
        </StepCard>

        {reachable && (
          <StepCard n={2} title="Log in" done={loggedIn}
            description="Your MediData account password — links this machine to your verified doctor account.">
            {loggedIn ? (
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 8 }}>
                Logged in as <strong>{status.profile?.full_name || email}</strong>.
              </div>
            ) : (
              <form onSubmit={handleLogin} style={{ marginTop: 10, maxWidth: 340 }}>
                <Field label="Email" type="email" required autoComplete="username"
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.example" />
                <Field
                  label="Password" type="password" required autoComplete="current-password"
                  value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                />
                <PrimaryButton disabled={loginBusy || !email || !loginPassword}>{loginBusy ? "Logging in…" : "Log in"}</PrimaryButton>
                <ErrorNote message={loginError} />
              </form>
            )}
          </StepCard>
        )}

        {reachable && loggedIn && (
          <StepCard n={3} title="Connect to your local database" done={mysqlReady}
            description="MySQL password for a SELECT-only user — kept in the CLI's memory only, never written to disk.">
            {mysqlReady ? (
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 8 }}>
                Connected to <strong>{status.mysql_config?.user}@{status.mysql_config?.host}:{status.mysql_config?.port}/{status.mysql_config?.database}</strong>.
              </div>
            ) : (
              <form onSubmit={handleMysql} style={{ marginTop: 10, maxWidth: 340 }}>
                <Field label="Database user" required value={mysqlForm.user}
                  onChange={(e) => setMysqlForm((f) => ({ ...f, user: e.target.value }))} placeholder="select_only_user" />
                <Field
                  label="Database password" type="password" required autoComplete="new-password"
                  value={mysqlPassword} onChange={(e) => setMysqlPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{
                  background: "none", border: "none", color: "var(--lavender-600, #5c6bc0)", fontSize: 11.5,
                  cursor: "pointer", padding: 0, marginBottom: 8, fontFamily: "inherit",
                }}>
                  {showAdvanced ? "Hide" : "Show"} connection settings (host / port / database name)
                </button>
                {showAdvanced && (
                  <>
                    <Field label="Host" value={mysqlForm.host} onChange={(e) => setMysqlForm((f) => ({ ...f, host: e.target.value }))} />
                    <Field label="Port" type="number" value={mysqlForm.port} onChange={(e) => setMysqlForm((f) => ({ ...f, port: Number(e.target.value) }))} />
                    <Field label="Database name" value={mysqlForm.database} onChange={(e) => setMysqlForm((f) => ({ ...f, database: e.target.value }))} />
                    <Field label="Doctors table" value={mysqlForm.doctors_table} onChange={(e) => setMysqlForm((f) => ({ ...f, doctors_table: e.target.value }))} />
                  </>
                )}
                <PrimaryButton disabled={mysqlBusy || !mysqlForm.user || !mysqlPassword}>
                  {mysqlBusy ? "Connecting…" : "Connect"}
                </PrimaryButton>
                <ErrorNote message={mysqlError} />
              </form>
            )}
          </StepCard>
        )}

        {reachable && loggedIn && mysqlReady && (
          <StepCard n={4} title="Pick your doctor record" done={doctorMapped}
            description="Which row in your hospital's local doctors table is you — cases sync only for this doctor.">
            {doctorMapped ? (
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 8 }}>
                Mapped to local doctor id <strong>{status.doctor_mapping?.local_doctor_id}</strong>.
              </div>
            ) : (
              <form onSubmit={handleMapDoctor} style={{ marginTop: 10, maxWidth: 340 }}>
                {!doctors ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Loading doctors…</div>
                ) : (
                  <label style={{ display: "block", marginBottom: 10 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Doctor</div>
                    <select
                      value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--lavender-100)", fontSize: 13, fontFamily: "inherit" }}
                    >
                      <option value="">Select…</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name} {d.email ? `(${d.email})` : ""} — id {d.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <PrimaryButton disabled={doctorBusy || !doctorId}>{doctorBusy ? "Saving…" : "Confirm"}</PrimaryButton>
                <ErrorNote message={doctorError} />
              </form>
            )}
          </StepCard>
        )}

        {allDone && (
          <div style={{
            marginTop: 8, padding: "18px 20px", borderRadius: 12, background: "#f0fdf4",
            border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, color: "#16a34a", fontSize: 14 }}>You're all set</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
                Keep <code>medidata serve</code> running whenever you want to submit cases.
              </div>
            </div>
            <button
              onClick={() => router.push("/cases/submit")}
              style={{
                padding: "9px 18px", background: "#16a34a", color: "white", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600, fontFamily: "'Sora', sans-serif", cursor: "pointer",
              }}
            >
              Go to Submit Cases →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
"use client";

import { useEffect, useState } from "react";
import { getSyncHistory } from "@/lib/api/cliSync";
import { useAuthStore } from "@/store/useAuthStore";

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
    <div style={{
      position: "relative", background: "var(--navy)", borderRadius: 10,
      padding: "14px 16px", marginTop: 10, marginBottom: 4,
    }}>
      <CopyButton text={text} />
      <pre style={{
        margin: 0, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 12.5, lineHeight: 1.7, color: "#dbe1f7", whiteSpace: "pre-wrap",
        wordBreak: "break-word", paddingRight: 60,
      }}>
        {text}
      </pre>
    </div>
  );
}

function StepCard({ n, title, description, children }) {
  return (
    <div style={{
      background: "var(--white)", border: "1.5px solid var(--lavender-100)",
      borderRadius: 14, padding: "20px 22px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
          background: "var(--lavender-50)", color: "var(--lavender-700, #4338ca)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, fontFamily: "'Sora', sans-serif",
        }}>
          {n}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 14.5, fontWeight: 700, color: "var(--navy)" }}>
            {title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.5 }}>
            {description}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── sync history ───────────────────────────────────────────────────────

function statusChip(row) {
  if (row.rejected_count > 0 && row.accepted_count === 0) {
    return { label: "Rejected", bg: "#fee2e2", color: "#dc2626" };
  }
  if (row.accepted_count > 0) {
    return { label: "Synced", bg: "#dcfce7", color: "#16a34a" };
  }
  return { label: "No new records", bg: "var(--lavender-50)", color: "var(--text-muted)" };
}

function SyncHistory() {
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
  }, [token]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Loading sync history…</div>;
  }
  if (error) {
    return <div className="auth-alert auth-alert--error">{error}</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={{
        padding: "32px 20px", textAlign: "center", fontSize: 13, color: "var(--text-muted)",
        background: "#f8f9fc", border: "1px dashed var(--lavender-200)", borderRadius: 12,
      }}>
        No syncs yet. Once you run <code>medidata sync</code> and approve a batch, it'll show up here.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row) => {
        const chip = statusChip(row);
        return (
          <div key={row.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--white)", border: "1.5px solid var(--lavender-100)",
            borderRadius: 10, padding: "12px 16px",
          }}>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              {new Date(row.created_at).toLocaleString()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {row.accepted_count} accepted · {row.duplicate_count} duplicate · {row.rejected_count} rejected
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20,
                fontSize: 11, fontWeight: 600, background: chip.bg, color: chip.color,
              }}>
                {chip.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── platform toggle ──────────────────────────────────────────────────────

function PlatformToggle({ platform, setPlatform }) {
  const options = [
    { id: "windows", label: "Windows (PowerShell)" },
    { id: "unix", label: "macOS / Linux" },
  ];
  return (
    <div style={{ display: "inline-flex", gap: 4, background: "var(--lavender-50)", padding: 4, borderRadius: 9, marginBottom: 20 }}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setPlatform(opt.id)}
          style={{
            padding: "6px 13px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: 600, fontFamily: "'Sora', sans-serif",
            background: platform === opt.id ? "var(--white)" : "transparent",
            color: platform === opt.id ? "var(--navy)" : "var(--text-muted)",
            boxShadow: platform === opt.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────

export default function CliSyncSetup() {
  const user = useAuthStore((s) => s.user);
  const email = user?.email || "your-doctor-email@hospital.example";
  const [platform, setPlatform] = useState("windows");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const downloadUrl = `${origin}/downloads/medidata-cli.zip`;

  const installCommands = platform === "windows"
    ? [
        `Invoke-WebRequest -Uri "${downloadUrl || "<this site>/downloads/medidata-cli.zip"}" -OutFile medidata-cli.zip`,
        "Expand-Archive medidata-cli.zip -DestinationPath medidata-cli",
        "cd medidata-cli",
        "pip install -e .",
      ]
    : [
        `curl -LO "${downloadUrl || "<this site>/downloads/medidata-cli.zip"}"`,
        "unzip medidata-cli.zip -d medidata-cli && cd medidata-cli",
        "pip install -e .",
      ];

  const mysqlPasswordNote = platform === "windows"
    ? <><code>$env:MEDIDATA_MYSQL_PASSWORD = "your-password"</code> before running <code>connect</code> or <code>sync</code></>
    : <><code>export MEDIDATA_MYSQL_PASSWORD=your-password</code> before running <code>connect</code> or <code>sync</code></>;

  return (
    <>
      <header style={{
        padding: "16px 32px", background: "var(--white)", borderBottom: "1px solid var(--lavender-100)",
        position: "sticky", top: 0, zIndex: 30,
      }}>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>
          Submit New Cases
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
          Cases are synced from your hospital's local records using the MediData CLI — not this browser.
        </div>
      </header>

      <div style={{ padding: "24px 32px", maxWidth: 760 }}>
        <div style={{
          background: "var(--lavender-50)", border: "1px solid var(--lavender-100)",
          borderRadius: 12, padding: "14px 18px", fontSize: 12.5, color: "var(--text-secondary)",
          lineHeight: 1.6, marginBottom: 24,
        }}>
          <strong style={{ color: "var(--navy)" }}>Why isn't this a "Submit" button?</strong>{" "}
          Raw patient records live in your hospital's local database and are never meant to reach a browser.
          The CLI connects to that database directly on your machine, anonymizes each record locally, shows you
          a before/after preview, and asks for your explicit approval — all in your terminal — before anything
          is uploaded. This page just gets you set up and shows you the outcome afterward.
        </div>

        <PlatformToggle platform={platform} setPlatform={setPlatform} />

        <StepCard
          n={1}
          title="Download & install the CLI"
          description="Runs on the same machine that can reach your hospital's local MySQL database — typically your workstation, not a shared server. The commands below fetch it straight from your terminal; or just click the button."
        >
          <a
            href="/downloads/medidata-cli.zip"
            download
            style={{
              display: "inline-block", marginTop: 12, marginBottom: 4, padding: "9px 16px",
              background: "var(--lavender-600, #5c6bc0)", color: "white", borderRadius: 8,
              fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'Sora', sans-serif",
            }}
          >
            ⬇ Download medidata-cli.zip
          </a>
          <CodeBlock>{installCommands}</CodeBlock>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            Requires Python 3.10+ and <code>pip</code> on your PATH. The CLI only ever runs read-only{" "}
            <code>SELECT</code>s against your MySQL database — grant its DB user select-only privileges too.
          </div>
        </StepCard>

        <StepCard
          n={2}
          title="One-time setup"
          description="Log in, point the CLI at your local database, and link your account to your row in the hospital's doctors table. Only needs to be done once per machine."
        >
          <CodeBlock>{[
            `medidata login --email ${email} --base-url ${API_URL}`,
            "medidata connect --host 127.0.0.1 --port 3306 --database <your_db> --user <select_only_user>",
            "medidata map-doctor",
          ]}</CodeBlock>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            Set {mysqlPasswordNote} — it's read fresh each run and never stored on disk. Run{" "}
            <code>medidata status</code> anytime to check what's configured.
          </div>
        </StepCard>

        <StepCard
          n={3}
          title="Sync new cases"
          description="Detects new local records since your last sync, anonymizes them, and shows you a preview before asking Y/N to upload."
        >
          <CodeBlock>medidata sync</CodeBlock>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            Nothing is uploaded until you type <code>y</code> at the prompt. If you decline, nothing leaves your
            hospital's network and your sync watermark doesn't move — next run picks up the same records.
          </div>
        </StepCard>

        <div style={{ marginTop: 32, marginBottom: 12 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>
            Recent syncs
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, marginBottom: 12 }}>
            What's already been approved and uploaded from your hospital.
          </div>
          <SyncHistory />
        </div>
      </div>
    </>
  );
}
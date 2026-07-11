"use client";

import CaseForm from "@/components/cases/CaseForm";
import { createCase } from "@/lib/api/cases";
import { useRouter } from "next/navigation";

export default function NewCasePage() {
  const router = useRouter();

  const handleSubmit = async (payload) => {
    const created = await createCase(payload);
    return created;
  };

  return (
    <>
      <header
        style={{
          padding: "16px 32px",
          background: "var(--white)",
          borderBottom: "1px solid var(--lavender-100)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "1.5px solid var(--lavender-100)",
            borderRadius: 8,
            padding: "5px 10px",
            cursor: "pointer",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>
            Submit New Case
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
            Upload a discharge PDF for auto-fill, or enter details manually.
          </div>
        </div>
      </header>

      <div style={{ padding: "28px 32px", maxWidth: 780 }}>
        <CaseForm onSubmit={handleSubmit} />
      </div>
    </>
  );
}
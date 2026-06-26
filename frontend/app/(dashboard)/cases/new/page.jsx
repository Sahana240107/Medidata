"use client";

import CaseForm from "@/components/cases/CaseForm";
import { createCase } from "@/lib/api/cases";

export default function NewCasePage() {
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
        }}
      >
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 700, color: "var(--navy)" }}>
          Submit a New Case
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          De-identified case details get stored and matched against the global network.
        </div>
      </header>

      <div style={{ padding: "28px 32px", maxWidth: 760 }}>
        <CaseForm onSubmit={handleSubmit} />
      </div>
    </>
  );
}

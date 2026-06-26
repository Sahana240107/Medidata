"use client";

export default function Error({ error, reset }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      background: "#f0f1fa",
      gap: "16px",
    }}>
      <div style={{
        background: "white",
        border: "1px solid #e3e5f5",
        borderRadius: "16px",
        padding: "40px 48px",
        textAlign: "center",
        maxWidth: "420px",
        boxShadow: "0 4px 24px rgba(92,107,192,0.1)",
      }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
        <h2 style={{ color: "#1a1f4e", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
          Something went wrong
        </h2>
        <p style={{ color: "#5a5f8a", fontSize: "14px", marginBottom: "24px", lineHeight: 1.6 }}>
          {error?.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          style={{
            background: "#3d5afe",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 24px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
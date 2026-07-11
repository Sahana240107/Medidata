export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f0f1fa",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "3px solid #e3e5f5",
          borderTop: "3px solid #3d5afe",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 16px",
        }} />
        <p style={{
          color: "#5a5f8a",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
        }}>
          Loading…
        </p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
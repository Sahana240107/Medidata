import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f0f1fa",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: "white",
        border: "1px solid #e3e5f5",
        borderRadius: "16px",
        padding: "48px",
        textAlign: "center",
        maxWidth: "400px",
        boxShadow: "0 4px 24px rgba(92,107,192,0.1)",
      }}>
        <div style={{
          fontFamily: "Sora, sans-serif",
          fontSize: "64px",
          fontWeight: 800,
          color: "#c5cae9",
          lineHeight: 1,
          marginBottom: "16px",
        }}>404</div>
        <h2 style={{ color: "#1a1f4e", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
          Page not found
        </h2>
        <p style={{ color: "#5a5f8a", fontSize: "14px", marginBottom: "28px", lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" style={{
          display: "inline-block",
          background: "#3d5afe",
          color: "white",
          borderRadius: "8px",
          padding: "10px 24px",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
        }}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
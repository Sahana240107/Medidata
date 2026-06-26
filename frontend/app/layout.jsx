import "./globals.css";

export const metadata = {
  title: "MediData — Privacy-Preserving Global Medical Discovery",
  description:
    "MediData connects hospitals globally through irreversible medical fingerprints — enabling rare disease detection, research collaboration, and expert matching without exposing patient records.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
'use client';

/**
 * Shared accent palette for the Insights page. Every color here is one
 * already used elsewhere in the app (verification/validation green,
 * pending amber, collaboration purple, the lavender brand scale) so new
 * cards read as part of the same system instead of introducing new hues.
 */
export const ACCENTS = {
  lavender: { solid: 'var(--lavender-500)', tint: 'var(--lavender-100)', ink: 'var(--lavender-700)' },
  purple:   { solid: '#7c3aed', tint: 'rgba(124,58,237,0.12)', ink: '#7c3aed' },
  amber:    { solid: '#b8770e', tint: 'rgba(184,119,14,0.12)', ink: '#b8770e' },
  green:    { solid: '#1e7e34', tint: 'rgba(30,126,52,0.12)', ink: '#1e7e34' },
};

const TILES = [
  { key: 'total_hospitals', label: 'Hospitals in Network', icon: '🏥', accent: 'lavender' },
  { key: 'total_cases', label: 'Cases Contributed Globally', icon: '📋', accent: 'purple' },
  { key: 'total_discoveries', label: 'Confirmed Discoveries', icon: '🔬', accent: 'green' },
  { key: 'countries_count', label: 'Countries Represented', icon: '🌍', accent: 'amber' },
];

function hoverIn(e) {
  e.currentTarget.style.transform = 'translateY(-2px)';
  e.currentTarget.style.boxShadow = '0 10px 24px rgba(43,37,92,0.12)';
}
function hoverOut(e) {
  e.currentTarget.style.transform = 'none';
  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
}

/** Network-wide headline figures, each carrying its own accent + icon chip. */
export default function NetworkOverviewStrip({ network }) {
  if (!network) return null;

  return (
    <div>
      <SectionLabel>Network at a Glance</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {TILES.map((t) => {
          const a = ACCENTS[t.accent];
          return (
            <div
              key={t.key}
              style={{
                position: 'relative', background: 'var(--white)', border: '1px solid var(--lavender-100)',
                borderRadius: 'var(--radius-md)', padding: '18px 18px 16px', overflow: 'hidden',
                boxShadow: 'var(--shadow-card)', transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: a.solid }} />
              <div style={{
                width: 34, height: 34, borderRadius: 10, marginBottom: 12,
                background: a.tint, color: a.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>
                {t.icon}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
                {(network[t.key] ?? 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{t.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: 'var(--lavender-500)',
      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

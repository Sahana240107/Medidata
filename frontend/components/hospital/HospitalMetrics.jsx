'use client';

import { SectionLabel, ACCENTS } from './NetworkOverviewStrip';

const DUELS = [
  { key: 'discovery_score', label: 'Discovery Score', icon: '⭐', accent: 'lavender', valueOf: (h) => h.discovery_score },
  { key: 'collaboration_score', label: 'Collaboration Score', icon: '🤝', accent: 'purple', valueOf: (h) => h.metrics.collaboration_score },
  { key: 'research_impact_score', label: 'Research Impact', icon: '📈', accent: 'amber', valueOf: (h) => h.metrics.research_impact_score },
  { key: 'validation_score', label: 'Validation Score', icon: '✅', accent: 'green', valueOf: (h) => h.metrics.validation_score },
];

function hoverIn(e) {
  e.currentTarget.style.transform = 'translateY(-2px)';
  e.currentTarget.style.boxShadow = '0 10px 24px rgba(43,37,92,0.12)';
}
function hoverOut(e) {
  e.currentTarget.style.transform = 'none';
  e.currentTarget.style.boxShadow = 'var(--shadow-card)';
}

/**
 * One "yours vs. network average" duel: a big number, a plain-language
 * delta, and a mini comparison bar (your value as a filled bar, the
 * network average marked as a tick) so the gap reads at a glance
 * instead of only through text.
 */
function DuelCard({ icon, label, mine, avg, accent }) {
  const a = ACCENTS[accent];
  const diff = mine - avg;
  const isUp = diff > 0.05;
  const isDown = diff < -0.05;
  const deltaColor = isUp ? '#1e7e34' : isDown ? '#c62828' : 'var(--text-muted)';
  const deltaText = isUp ? `+${diff.toFixed(1)} above avg` : isDown ? `${diff.toFixed(1)} below avg` : 'On par with avg';
  const pctMine = Math.min(100, Math.max(0, mine));
  const pctAvg = Math.min(100, Math.max(0, avg));

  return (
    <div
      style={{
        position: 'relative', background: 'var(--white)', border: '1px solid var(--lavender-100)',
        borderRadius: 'var(--radius-md)', padding: '18px 18px 16px', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)', transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: a.solid }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: a.tint, color: a.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 27, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
          {Math.round(mine * 10) / 10}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          vs {Math.round(avg * 10) / 10} network avg
        </span>
      </div>

      <div style={{ position: 'relative', height: 6, borderRadius: 99, background: 'var(--lavender-50)', marginBottom: 10 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pctMine}%`,
          background: a.solid, borderRadius: 99, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
        }} />
        <div
          title="Network average"
          style={{
            position: 'absolute', top: -2, bottom: -2, width: 2, left: `calc(${pctAvg}% - 1px)`,
            background: 'var(--navy)', opacity: 0.3, borderRadius: 2,
          }}
        />
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: deltaColor }}>
        {isUp ? '↑ ' : isDown ? '↓ ' : '– '}{deltaText}
      </div>
    </div>
  );
}

/**
 * "You vs. the Network" — each metric as a head-to-head duel: your
 * number, the network average, and a plain delta. Quicker to read than
 * a chart and more directly answers "am I doing well?".
 */
export default function HospitalMetrics({ hospital }) {
  if (!hospital) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionLabel>Your Hospital vs. the Network</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {DUELS.map((d) => (
          <DuelCard
            key={d.key}
            icon={d.icon}
            label={d.label}
            accent={d.accent}
            mine={d.valueOf(hospital)}
            avg={hospital.network_avg[d.key] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}

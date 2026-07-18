'use client';

const TYPES = [
  { value: null, label: 'All' },
  { value: 'syndrome', label: '🔴 Emerging Syndrome' },
  { value: 'drug_response', label: '💊 Drug Response' },
  { value: 'biomarker', label: '🧬 Biomarker' },
  { value: 'disease_cluster', label: '🔬 Disease Cluster' },
];

const SORTS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'confidence', label: 'Highest Confidence' },
];

/**
 * FeedFilterBar — signal type chips + sort toggle for the /feed page.
 */
export default function FeedFilterBar({ signalType, onSignalTypeChange, sort, onSortChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TYPES.map((t) => {
          const active = signalType === t.value;
          return (
            <button
              key={t.label}
              onClick={() => onSignalTypeChange(t.value)}
              style={{
                padding: '7px 14px',
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: active ? '1.5px solid var(--lavender-600)' : '1.5px solid var(--lavender-100)',
                background: active ? 'var(--lavender-600)' : 'var(--white)',
                color: active ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        style={{
          padding: '8px 12px',
          borderRadius: 9,
          border: '1.5px solid var(--lavender-100)',
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          background: 'var(--white)',
          cursor: 'pointer',
        }}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

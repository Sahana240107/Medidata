'use client';

const COLOR_MAP = {
  green: '#2e9e5b',
  red: '#e5484d',
  orange: '#e79a3a',
  lavender: 'var(--lavender-400)',
};

export default function OutcomeSummary({ outcomeIntelligence }) {
  const {
    matched_case_count,
    breakdown = [],
    most_effective_drug,
    most_effective_drug_success_rate,
    most_effective_drug_hospital_count,
  } = outcomeIntelligence || {};

  if (!matched_case_count) return null;

  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      padding: 24,
      marginTop: 8,
    }}>
      <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif", marginBottom: 18 }}>
        Outcome Intelligence — {matched_case_count} Matched Case{matched_case_count === 1 ? '' : 's'}
      </div>

      {breakdown.map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ width: 100, fontSize: 13.5, color: 'var(--text-secondary)', flexShrink: 0 }}>{row.label}</div>
          <div style={{ flex: 1, height: 10, background: 'var(--lavender-50)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${(row.count / maxCount) * 100}%`,
              height: '100%',
              background: COLOR_MAP[row.color] || COLOR_MAP.lavender,
              borderRadius: 6,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ width: 24, textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: 'var(--navy)', flexShrink: 0 }}>
            {row.count}
          </div>
        </div>
      ))}

      {most_effective_drug && (
        <div style={{
          marginTop: 16,
          background: '#eaf7ef',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>💊</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1e7e34' }}>
              Most Effective: {most_effective_drug}
            </div>
            <div style={{ fontSize: 12.5, color: '#3a7a4e', marginTop: 2 }}>
              Observed success rate {Math.round(most_effective_drug_success_rate)}% across {most_effective_drug_hospital_count} hospital{most_effective_drug_hospital_count === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
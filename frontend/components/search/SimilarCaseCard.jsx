'use client';

import CaseTimeline from './CaseTimeline';

const TAG_STYLES = {
  default: { bg: 'var(--lavender-50)', color: 'var(--lavender-700)' },
  Recovered: { bg: '#e6f4ea', color: '#1e7e34' },
  Improved: { bg: '#e6f4ea', color: '#1e7e34' },
  Deteriorated: { bg: '#fdeaea', color: '#c62828' },
  Unresolved: { bg: '#fff4e5', color: '#b8770e' },
  'Partial Response': { bg: '#fff4e5', color: '#b8770e' },
  'Diagnosis confirmed': { bg: '#e8eaf6', color: 'var(--lavender-700)' },
  'Mixed outcomes': { bg: 'var(--lavender-50)', color: 'var(--text-secondary)' },
};

function Tag({ label }) {
  const style = TAG_STYLES[label] || TAG_STYLES.default;
  return (
    <span style={{
      padding: '4px 11px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default function SimilarCaseCard({ result }) {
  const {
    cluster_id, match_score, hospital_name, specialty, case_count,
    managing_doctor, country, country_code, outcome_tags, timeline,
    is_own_hospital,
  } = result;

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ textAlign: 'center', minWidth: 66, flexShrink: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--lavender-600)', fontFamily: "'Sora', sans-serif", lineHeight: 1 }}>
            {Math.round(match_score)}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>match</div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
                Case Cluster {cluster_id} · {hospital_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                {specialty} · {case_count} case{case_count === 1 ? '' : 's'}
                {managing_doctor ? ` · ${managing_doctor} managing` : ''}
                {country ? ` · ${country}` : ''}
                {country_code ? ` ${country_code}` : ''}
              </div>
            </div>
            <button style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              border: is_own_hospital ? '1.5px solid var(--lavender-400)' : 'none',
              background: is_own_hospital ? 'var(--white)' : 'var(--lavender-600)',
              color: is_own_hospital ? 'var(--lavender-700)' : 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {is_own_hospital ? 'View' : 'Contact'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {outcome_tags.map((tag) => <Tag key={tag} label={tag} />)}
          </div>

          <div style={{ marginTop: 14, background: 'var(--lavender-50)', borderRadius: 'var(--radius-sm)' }}>
            <CaseTimeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
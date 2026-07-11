'use client';

import { useState } from 'react';

const TYPE_PILLS = [
  { key: 'all', label: 'All Types', enabled: true },
  { key: 'similar_cases', label: 'Similar Cases', enabled: true },
  { key: 'matching_experts', label: 'Matching Experts', enabled: false },
  { key: 'research_signals', label: 'Research Signals', enabled: false },
  { key: 'clinical_trials', label: 'Clinical Trials', enabled: false },
  { key: 'biomarkers', label: 'Biomarkers', enabled: false },
];

export default function CaseSearchForm({ initialQuery = '', onSearch, loading }) {
  const [query, setQuery] = useState(initialQuery);
  const [activeType, setActiveType] = useState('all');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onSearch(query.trim());
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--white)',
          border: '1.5px solid var(--lavender-200)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Progressive muscle weakness, elevated CRP, skin lesions, neurological deterioration"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 14.5,
              color: 'var(--text-primary)',
              fontFamily: "'Inter', sans-serif",
              background: 'transparent',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            padding: '14px 28px',
            background: loading ? 'var(--lavender-300)' : 'var(--lavender-600)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 14.5,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
            boxShadow: '0 2px 12px rgba(61,90,254,0.25)',
          }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {TYPE_PILLS.map((pill) => (
          <button
            key={pill.key}
            type="button"
            disabled={!pill.enabled}
            title={pill.enabled ? undefined : 'Coming soon'}
            onClick={() => pill.enabled && setActiveType(pill.key)}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              border: `1.5px solid ${activeType === pill.key ? 'var(--lavender-600)' : 'var(--lavender-200)'}`,
              background: activeType === pill.key ? 'var(--lavender-600)' : 'var(--white)',
              color: activeType === pill.key ? 'white' : pill.enabled ? 'var(--text-secondary)' : 'var(--text-muted)',
              cursor: pill.enabled ? 'pointer' : 'not-allowed',
              opacity: pill.enabled ? 1 : 0.55,
              transition: 'all 0.15s',
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );
}
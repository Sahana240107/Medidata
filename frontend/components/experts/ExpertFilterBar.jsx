'use client';

/**
 * ExpertFilterBar — search + specialty chips + region/sort selects,
 * matching the reference mockup's filter-chip row.
 */

export default function ExpertFilterBar({ filters, onChange, filterOptions, search, onSearchChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const specialties = filterOptions?.specialties || [];
  const countries = filterOptions?.countries || [];

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'white',
          border: '1.5px solid var(--lavender-100)',
          borderRadius: 12,
          padding: '11px 16px',
          marginBottom: 14,
          boxShadow: '0 2px 8px rgba(92,107,192,0.05)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, specialty, or institution..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--navy)' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip active={!filters.specialty} onClick={() => set('specialty', '')}>All Experts</Chip>
        {specialties.slice(0, 6).map((s) => (
          <Chip key={s} active={filters.specialty === s} onClick={() => set('specialty', s)}>
            {s}
          </Chip>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Region:</span>
          <select
            value={filters.country}
            onChange={(e) => set('country', e.target.value)}
            style={selectStyle}
          >
            <option value="">All Regions</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sort:</span>
          <select
            value={filters.sort}
            onChange={(e) => set('sort', e.target.value)}
            style={selectStyle}
          >
            <option value="cases">Most Cases</option>
            <option value="publications">Most Publications</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

const selectStyle = {
  border: '1.5px solid var(--lavender-100)',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 12,
  background: 'white',
  outline: 'none',
  color: 'var(--navy)',
  fontFamily: 'inherit',
};

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 20,
        border: active ? '1.5px solid var(--lavender-600)' : '1.5px solid var(--lavender-100)',
        background: active ? 'var(--lavender-600)' : 'white',
        color: active ? 'white' : 'var(--text-secondary)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
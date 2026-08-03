'use client';

function FilterGroup({ title, options, selected, onToggle }) {
  if (!options?.length) return null;
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 14,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {title}
      </div>
      {options.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 0', cursor: 'pointer', fontSize: 13.5,
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(opt.value)}
              style={{ accentColor: 'var(--lavender-600)', width: 15, height: 15 }}
            />
            <span style={{ flex: 1 }}>{opt.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.count}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Docked, collapsible filter drawer (hidden by default). Pushes the main
 * content over when open — width animates between 0 and 264px.
 */
export default function FilterPanel({ open, facets, filters, onToggle, onClear }) {
  const hasFacets = facets && Object.values(facets).some((f) => f?.length);

  return (
    <div style={{
      width: open ? 264 : 0,
      flexShrink: 0,
      overflow: 'hidden',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
    }}>
      <div style={{ width: 264 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            Filters
          </div>
          <button
            onClick={onClear}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--lavender-600)', fontWeight: 600,
            }}
          >
            Clear all
          </button>
        </div>

        {!hasFacets ? (
          <div style={{
            fontSize: 12.5, color: 'var(--text-muted)', padding: '16px',
            border: '1px dashed var(--lavender-200)', borderRadius: 'var(--radius-md)', textAlign: 'center',
          }}>
            Filters will appear here once you run a search.
          </div>
        ) : (
          <>
            <FilterGroup
              title="Match Confidence"
              options={facets.confidence?.map((f) => ({ value: f.value, label: f.label, count: f.count })) || []}
              selected={filters.confidence_tiers}
              onToggle={(v) => onToggle('confidence_tiers', v)}
            />
            <FilterGroup
              title="Region"
              options={facets.region?.map((f) => ({ value: f.value, label: f.label, count: f.count })) || []}
              selected={filters.regions}
              onToggle={(v) => onToggle('regions', v)}
            />
            <FilterGroup
              title="Specialty"
              options={facets.specialty?.map((f) => ({ value: f.value, label: f.label, count: f.count })) || []}
              selected={filters.specialties}
              onToggle={(v) => onToggle('specialties', v)}
            />
            <FilterGroup
              title="Outcome"
              options={facets.outcome?.map((f) => ({ value: f.value, label: f.label, count: f.count })) || []}
              selected={filters.outcomes}
              onToggle={(v) => onToggle('outcomes', v)}
            />
          </>
        )}
      </div>
    </div>
  );
}

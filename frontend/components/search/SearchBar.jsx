'use client';

import { useState, useRef, useEffect } from 'react';
import { FilterIcon } from './icons';

/* Static suggestion pool — client-side only, filtered by current input.
   Swap for a live endpoint later if needed; the UI contract stays the same. */
const STATIC_SUGGESTIONS = [
  'Progressive muscle weakness, elevated CRP',
  'Skin lesions with neurological deterioration',
  'Recurrent fever with joint pain',
  'Peripheral neuropathy, elevated ESR',
  'Unexplained weight loss with night sweats',
  'Photosensitive rash, elevated ANA titer',
  'Dyspnea on exertion, elevated D-dimer',
  'Guillain-Barré syndrome',
  'Non-small cell lung carcinoma',
  'Acute STEMI with atypical presentation',
];

export default function SearchBar({
  query, onQueryChange, onSearch, loading,
  filterOpen, onToggleFilter, activeFilterCount = 0,
}) {
  const [local, setLocal] = useState(query || '');
  const [showSuggest, setShowSuggest] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => setLocal(query || ''), [query]);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSuggest(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const suggestions = local.trim()
    ? STATIC_SUGGESTIONS.filter((s) => s.toLowerCase().includes(local.trim().toLowerCase())).slice(0, 6)
    : STATIC_SUGGESTIONS.slice(0, 6);

  const submit = (value) => {
    const v = (value ?? local).trim();
    if (!v || loading) return;
    setShowSuggest(false);
    onQueryChange?.(v);
    onSearch(v);
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
      {/* Filter toggle */}
      <button
        type="button"
        onClick={onToggleFilter}
        title={filterOpen ? 'Hide filters' : 'Show filters'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 48, height: 48, flexShrink: 0,
          borderRadius: 'var(--radius-md)',
          border: `1.5px solid ${filterOpen ? 'var(--lavender-600)' : 'var(--lavender-200)'}`,
          background: filterOpen ? 'var(--lavender-600)' : 'var(--white)',
          color: filterOpen ? 'white' : 'var(--text-secondary)',
          cursor: 'pointer', position: 'relative',
          boxShadow: 'var(--shadow-card)',
          transition: 'all 0.15s',
        }}
      >
        <FilterIcon size={18} />
        {activeFilterCount > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#e5484d', color: 'white',
            fontSize: 10, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid var(--white)',
          }}>
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Search input + suggestions */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative' }}>
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--white)',
            border: '1.5px solid var(--lavender-200)',
            borderRadius: 'var(--radius-md)',
            padding: '13px 18px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onFocus={() => setShowSuggest(true)}
            placeholder="Progressive muscle weakness, elevated CRP, skin lesions, neurological deterioration"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14.5,
              color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif", background: 'transparent',
            }}
          />
        </form>

        {showSuggest && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'var(--white)', border: '1px solid var(--lavender-100)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-hover)',
            zIndex: 30, overflow: 'hidden',
          }}>
            {suggestions.map((s) => (
              <div
                key={s}
                onMouseDown={() => submit(s)}
                style={{
                  padding: '10px 16px', fontSize: 13.5, color: 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lavender-50)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => submit()}
        disabled={loading || !local.trim()}
        style={{
          padding: '14px 28px',
          background: loading ? 'var(--lavender-300)' : 'var(--lavender-600)',
          color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
          fontSize: 14.5, fontWeight: 600, fontFamily: "'Inter', sans-serif",
          cursor: loading || !local.trim() ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap', transition: 'background 0.15s',
          boxShadow: '0 2px 12px rgba(61,90,254,0.25)', flexShrink: 0,
        }}
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
    </div>
  );
}

'use client';

import { CloseIcon, PinIcon, StatsIcon } from './icons';

const COLOR_MAP = {
  green: '#2e9e5b',
  red: '#e5484d',
  orange: '#e79a3a',
  lavender: 'var(--lavender-400)',
};

function StatRow({ label, count, maxCount, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 92, fontSize: 12.5, color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 9, background: 'var(--lavender-50)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          width: `${(count / maxCount) * 100}%`, height: '100%',
          background: COLOR_MAP[color] || COLOR_MAP.lavender, borderRadius: 5,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ width: 20, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', flexShrink: 0 }}>
        {count}
      </div>
    </div>
  );
}

/**
 * True slide-in overlay from the right, with a blurred backdrop over the
 * rest of the search page. `mode` is 'stats' | 'pinned' | null — only one
 * renders at a time. Doesn't consume any layout space; it floats above
 * everything and closes on backdrop click, close button, or Escape.
 */
export default function RightPanel({ mode, onClose, outcomeIntelligence, pinnedResults, onUnpin, onFocusCase }) {
  const open = mode === 'stats' || mode === 'pinned';

  return (
    <>
      {/* Blurred backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(26,31,78,0.32)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sliding panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 360, zIndex: 65,
        background: 'var(--white)',
        borderLeft: '1px solid var(--lavender-100)',
        boxShadow: '-8px 0 40px rgba(26,31,78,0.18)',
        padding: 24,
        overflowY: 'auto',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            {mode === 'stats' ? <StatsIcon size={17} /> : <PinIcon size={17} filled />}
            {mode === 'stats' ? 'Outcome Statistics' : 'Pinned Cases'}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--lavender-50)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            padding: 7, borderRadius: 999, display: 'flex',
          }}>
            <CloseIcon size={14} />
          </button>
        </div>

        {mode === 'stats' && <StatsBody outcomeIntelligence={outcomeIntelligence} />}
        {mode === 'pinned' && (
          <PinnedBody pinnedResults={pinnedResults} onUnpin={onUnpin} onFocusCase={onFocusCase} />
        )}
      </div>
    </>
  );
}

function StatsBody({ outcomeIntelligence }) {
  const {
    matched_case_count, breakdown = [],
    most_effective_drug, most_effective_drug_success_rate, most_effective_drug_hospital_count,
  } = outcomeIntelligence || {};

  if (!matched_case_count) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
        No outcome data available for this search yet.
      </div>
    );
  }

  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
        Across {matched_case_count} matched case{matched_case_count === 1 ? '' : 's'}
      </div>
      {breakdown.map((row) => (
        <StatRow key={row.label} label={row.label} count={row.count} maxCount={maxCount} color={row.color} />
      ))}
      {most_effective_drug && (
        <div style={{
          marginTop: 14, background: '#eaf7ef', borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e7e34' }}>
            💊 Most Effective: {most_effective_drug}
          </div>
          <div style={{ fontSize: 11.5, color: '#3a7a4e', marginTop: 3, lineHeight: 1.5 }}>
            {Math.round(most_effective_drug_success_rate)}% success across {most_effective_drug_hospital_count} hospital{most_effective_drug_hospital_count === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}

function PinnedBody({ pinnedResults, onUnpin, onFocusCase }) {
  if (!pinnedResults?.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
        Pin a case from the list to keep it here for quick reference.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pinnedResults.map((r) => (
        <div
          key={r.cluster_id}
          onClick={() => onFocusCase?.(r)}
          style={{
            border: '1px solid var(--lavender-100)', borderRadius: 'var(--radius-sm)',
            padding: '10px 12px', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--lavender-300)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--lavender-100)'; }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.disease_name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {r.hospital_name} · {Math.round(r.match_score)}% match
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onUnpin(r.cluster_id); }}
              title="Unpin"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lavender-500)', flexShrink: 0, padding: 2 }}
            >
              <PinIcon size={14} filled />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
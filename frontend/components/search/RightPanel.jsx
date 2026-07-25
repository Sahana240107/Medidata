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
        width: mode === 'pinned' ? 392 : 360, zIndex: 65,
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

function tagColor(tag) {
  const t = (tag || '').toLowerCase();
  if (['recovered', 'improved', 'stable', 'resolved'].includes(t)) return 'green';
  if (['deteriorated', 'worsened', 'deceased'].includes(t)) return 'red';
  if (['unresolved', 'partial response', 'active', 'mixed outcomes'].includes(t)) return 'orange';
  return 'lavender';
}

/** Counts occurrences of each string across a list of arrays, returns top `n` desc. */
function topFrequencies(pinnedResults, field, n) {
  const counts = new Map();
  for (const r of pinnedResults) {
    for (const raw of r[field] || []) {
      const label = String(raw).trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

function MiniStat({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

function FindingChips({ items, emptyLabel }) {
  if (!items.length) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyLabel}</div>;
  }
  const maxCount = Math.max(1, ...items.map((i) => i.count));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((i) => (
        <span
          key={i.label}
          title={`${i.count} of the pinned cases`}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 500,
            background: i.count === maxCount ? 'var(--lavender-100)' : 'var(--lavender-50)',
            color: 'var(--lavender-700)', border: '1px solid var(--lavender-200)',
            whiteSpace: 'nowrap',
          }}
        >
          {i.label}
          <span style={{
            fontSize: 10, fontWeight: 700, background: 'var(--white)',
            borderRadius: 999, padding: '0 5px', color: 'var(--lavender-600)',
          }}>
            {i.count}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Cross-case analytics computed live over whatever is currently pinned:
 * average match strength, hospital/country spread, an outcome-tag
 * breakdown, and the most common symptoms / lab findings shared across
 * the pinned set — i.e. the "other common findings" among them.
 */
function PinnedAnalytics({ pinnedResults }) {
  const avgMatch = Math.round(
    pinnedResults.reduce((sum, r) => sum + (r.match_score || 0), 0) / pinnedResults.length
  );
  const hospitalCount = new Set(pinnedResults.map((r) => r.hospital_name).filter(Boolean)).size;
  const countryCount = new Set(pinnedResults.map((r) => r.country).filter(Boolean)).size;

  const tagCounts = new Map();
  for (const r of pinnedResults) {
    for (const tag of r.outcome_tags || []) {
      if (tag === 'Diagnosis confirmed') continue; // not an outcome, just a status flag
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const outcomeBreakdown = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxTagCount = Math.max(1, ...outcomeBreakdown.map(([, c]) => c));

  const topSymptoms = topFrequencies(pinnedResults, 'symptoms', 5);
  const topLabs = topFrequencies(pinnedResults, 'lab_results', 5);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', border: '1px solid var(--lavender-100)', borderRadius: 'var(--radius-sm)',
        background: 'var(--lavender-50)', marginBottom: 16, overflow: 'hidden',
      }}>
        <MiniStat label="Avg. Match" value={`${avgMatch}%`} />
        <div style={{ width: 1, background: 'var(--lavender-200)' }} />
        <MiniStat label={`Hospital${hospitalCount === 1 ? '' : 's'}`} value={hospitalCount} />
        <div style={{ width: 1, background: 'var(--lavender-200)' }} />
        <MiniStat label={`Countr${countryCount === 1 ? 'y' : 'ies'}`} value={countryCount} />
      </div>

      {outcomeBreakdown.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
            letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            Outcomes Among Pinned
          </div>
          {outcomeBreakdown.map(([label, count]) => (
            <StatRow key={label} label={label} count={count} maxCount={maxTagCount} color={tagColor(label)} />
          ))}
        </div>
      )}

      <div style={{ marginBottom: 4 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
          letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Common Findings
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Symptoms</div>
        <FindingChips items={topSymptoms} emptyLabel="No shared symptoms yet." />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 6px' }}>Lab findings</div>
        <FindingChips items={topLabs} emptyLabel="No shared lab findings yet." />
      </div>
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
    <div>
      <PinnedAnalytics pinnedResults={pinnedResults} />

      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
        letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10,
        paddingTop: 14, borderTop: '1px solid var(--lavender-50)',
      }}>
        Pinned ({pinnedResults.length})
      </div>
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
    </div>
  );
}
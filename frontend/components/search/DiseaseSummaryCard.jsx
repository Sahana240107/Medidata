'use client';

import { SparkleIcon, PinIcon, ChevronIcon } from './icons';

export default function DiseaseSummaryCard({
  query, summary, fact, keywords,
  onOpenStats, statsActive,
  onOpenPinned, pinnedActive, pinnedCount,
}) {
  return (
    <div>
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-card)',
      padding: 22,
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--lavender-500)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Summary · “{query}”
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 14 }}>
            {summary}
          </p>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'var(--lavender-50)', borderRadius: 'var(--radius-sm)',
            padding: '12px 14px', marginBottom: 16,
          }}>
            <span style={{ color: 'var(--lavender-600)', flexShrink: 0, marginTop: 1 }}>
              <SparkleIcon size={16} />
            </span>
            <div style={{ fontSize: 13, color: 'var(--lavender-700)', lineHeight: 1.55 }}>
              <strong>Did you know? </strong>{fact}
            </div>
          </div>

          {keywords?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {keywords.map((kw) => (
                <span key={kw} style={{
                  padding: '5px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 500,
                  background: 'var(--lavender-50)', color: 'var(--lavender-700)',
                  border: '1px solid var(--lavender-200)', whiteSpace: 'nowrap',
                }}>
                  {kw}
                </span>
              ))}
              <button
                onClick={onOpenStats}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700,
                  color: statsActive ? 'var(--lavender-800)' : 'var(--lavender-600)',
                  padding: '5px 4px',
                }}
              >
                More <ChevronIcon size={12} direction={statsActive ? 'left' : 'right'} />
              </button>
            </div>
          )}
        </div>
      </div>
     </div>
      {/* Pinned-cases toggle sits at the right corner of this section, before the case grid */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--lavender-50)' }}>
        <button
          onClick={onOpenPinned}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 999,
            border: `1.5px solid ${pinnedActive ? 'var(--lavender-600)' : 'var(--lavender-200)'}`,
            background: pinnedActive ? 'var(--lavender-600)' : 'var(--white)',
            color: pinnedActive ? 'white' : 'var(--lavender-700)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <PinIcon size={14} filled={pinnedActive} />
          Pinned Cases
          {pinnedCount > 0 && (
            <span style={{
              background: pinnedActive ? 'rgba(255,255,255,0.25)' : 'var(--lavender-50)',
              color: pinnedActive ? 'white' : 'var(--lavender-700)',
              fontSize: 11, fontWeight: 700, borderRadius: 8,
              padding: '1px 7px', minWidth: 18, textAlign: 'center',
            }}>
              {pinnedCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

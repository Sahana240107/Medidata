'use client';

import { SectionLabel } from './NetworkOverviewStrip';

/**
 * Global footprint by country — represented as a ranked list with dot
 * clusters sized by relative case volume instead of a bar/line chart.
 * Your own hospital's country gets a small "you're here" pin.
 */
export default function HospitalFootprint({ footprint }) {
  if (!footprint?.length) return null;
  const maxCases = Math.max(1, ...footprint.map((f) => f.case_count));

  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)', padding: 22, boxShadow: 'var(--shadow-card)',
      marginBottom: 28,
    }}>
      <SectionLabel>Global Footprint</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {footprint.map((f) => {
          const dots = Math.max(1, Math.round((f.case_count / maxCases) * 8));
          return (
            <div key={f.country} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 10px', borderRadius: 'var(--radius-sm)',
              background: f.is_mine ? 'var(--lavender-50)' : 'transparent',
            }}>
              <div style={{ width: 130, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {f.is_mine && <span title="Your hospital's country">📍</span>}
                <span style={{ fontSize: 13, fontWeight: f.is_mine ? 700 : 500, color: f.is_mine ? 'var(--lavender-700)' : 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.country}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: i < dots ? (f.is_mine ? 'var(--lavender-600)' : 'var(--lavender-300)') : 'var(--lavender-100)',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', width: 130, textAlign: 'right', flexShrink: 0 }}>
                {f.hospital_count} hospital{f.hospital_count === 1 ? '' : 's'} · {f.case_count} case{f.case_count === 1 ? '' : 's'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

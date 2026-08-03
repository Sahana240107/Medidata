'use client';

import { SectionLabel } from './NetworkOverviewStrip';
import { timeAgo } from '@/lib/utils/formatters';

const TYPE_STYLES = {
  case: { icon: '📋', bg: 'var(--lavender-100)', color: 'var(--lavender-700)' },
  collaboration: { icon: '🤝', bg: '#ede9fe', color: '#7c3aed' },
  validation: { icon: '✅', bg: '#e6f4ea', color: '#1e7e34' },
};

/**
 * Recent contributions & achievements as a vertical timeline feed
 * (cases submitted, collaborations started) — a stream of "what has this
 * hospital actually been doing lately" rather than a summary chart.
 */
export default function HospitalActivityFeed({ items }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)', padding: 22, boxShadow: 'var(--shadow-card)',
    }}>
      <SectionLabel>Recent Contributions</SectionLabel>

      {!items?.length && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
          No recent activity yet — submit a case or start a collaboration to see it here.
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {items?.map((item, i) => {
          const style = TYPE_STYLES[item.type] || TYPE_STYLES.case;
          const isLast = i === items.length - 1;
          return (
            <div key={i} style={{ display: 'flex', gap: 14, position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: style.bg, color: style.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  {style.icon}
                </div>
                {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--lavender-100)', minHeight: 20 }} />}
              </div>
              <div style={{ paddingBottom: isLast ? 0 : 18, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.4 }}>
                  {item.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  {item.detail && (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.detail}</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--lavender-400)', fontWeight: 600 }}>
                    · {timeAgo(item.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

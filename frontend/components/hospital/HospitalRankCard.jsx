'use client';

import { SectionLabel } from './NetworkOverviewStrip';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function LadderRow({ entry }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px', borderRadius: 'var(--radius-sm)',
      background: entry.is_mine ? 'var(--lavender-50)' : 'transparent',
      border: entry.is_mine ? '1.5px solid var(--lavender-400)' : '1px solid transparent',
    }}>
      <div style={{
        width: 28, textAlign: 'center', fontSize: MEDALS[entry.rank] ? 16 : 12.5,
        fontWeight: 700, color: MEDALS[entry.rank] ? undefined : 'var(--text-muted)', flexShrink: 0,
      }}>
        {MEDALS[entry.rank] || `#${entry.rank}`}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: entry.is_mine ? 700 : 600,
          color: entry.is_mine ? 'var(--lavender-700)' : 'var(--navy)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.name}{entry.is_mine && ' · You'}
        </div>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: 'var(--lavender-600)',
        fontFamily: "'Sora', sans-serif", flexShrink: 0,
      }}>
        {Math.round(entry.discovery_score)}
      </div>
    </div>
  );
}

/**
 * "Your Standing" — a ranked ladder rather than a bar chart: the top 5
 * hospitals network-wide, plus (if your hospital falls outside that top
 * 5) a small contextual window around your own rank so you can see who
 * you're just ahead of and just behind.
 */
export default function HospitalRankCard({ leaderboard }) {
  if (!leaderboard?.length) return null;

  const top5 = leaderboard.slice(0, Math.min(5, leaderboard.length));
  const rest = leaderboard.slice(top5.length);
  const showGap = rest.length > 0 && rest[0].rank > (top5[top5.length - 1]?.rank || 0) + 1;

  return (
    <div style={{
      position: 'relative', background: 'var(--white)', border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)', padding: 22, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#b8770e' }} />
      <SectionLabel>Your Standing</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {top5.map((entry) => <LadderRow key={entry.id} entry={entry} />)}
        {rest.length > 0 && (
          <>
            {showGap && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '2px 0', letterSpacing: '2px' }}>
                ⋮
              </div>
            )}
            {rest.map((entry) => <LadderRow key={entry.id} entry={entry} />)}
          </>
        )}
      </div>
    </div>
  );
}

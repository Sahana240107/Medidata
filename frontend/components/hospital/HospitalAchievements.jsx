'use client';

import { SectionLabel } from './NetworkOverviewStrip';

function Badge({ achievement }) {
  const { label, description, icon, unlocked, progress_label } = achievement;
  return (
    <div
      title={description}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: 8, padding: '16px 10px', borderRadius: 'var(--radius-md)',
        background: unlocked ? 'linear-gradient(160deg, var(--lavender-50), var(--white))' : 'var(--lavender-50)',
        border: `1.5px solid ${unlocked ? 'var(--lavender-300)' : 'var(--lavender-100)'}`,
        opacity: unlocked ? 1 : 0.6,
        transition: 'transform 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{
        fontSize: 26, width: 48, height: 48, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: unlocked ? 'var(--white)' : 'var(--lavender-100)',
        filter: unlocked ? 'none' : 'grayscale(1)',
        boxShadow: unlocked ? '0 2px 10px rgba(92,107,192,0.18)' : 'none',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: unlocked ? 'var(--navy)' : 'var(--text-muted)', lineHeight: 1.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
        {unlocked ? 'Unlocked' : progress_label ? progress_label : 'Locked'}
      </div>
    </div>
  );
}

/**
 * Gamified achievement badges — unlocked/locked based on live metrics
 * thresholds. A different (and more skimmable) way of surfacing
 * milestones than another chart would be.
 */
export default function HospitalAchievements({ achievements }) {
  if (!achievements?.length) return null;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div style={{
      position: 'relative', background: 'var(--white)', border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)', padding: 22, boxShadow: 'var(--shadow-card)',
      marginBottom: 28, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--lavender-500)' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel>Achievements</SectionLabel>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {unlockedCount} of {achievements.length} unlocked
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {achievements.map((a) => <Badge key={a.key} achievement={a} />)}
      </div>
    </div>
  );
}

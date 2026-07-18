'use client';

import { useState } from 'react';

/**
 * ExpertCard — one expert in the directory grid.
 * Mirrors the reference layout: avatar + badge, specialty/hospital, a
 * two-stat row, topic tags, then Connect / Request Collaboration /
 * Invite to Study actions that adapt to the live connection_status.
 */

const BADGE = {
  verified: { label: 'VERIFIED', bg: 'var(--lavender-600)', color: 'white' },
  contributor: { label: 'CONTRIBUTOR', bg: 'var(--lavender-100)', color: 'var(--lavender-700)' },
  rising_star: { label: 'RISING STAR', bg: '#fce4ec', color: '#c2185b' },
};

function badgeFor(expert) {
  if (expert.verification_status === 'verified') return BADGE.verified;
  if (expert.cases_managed >= 50) return BADGE.contributor;
  return BADGE.rising_star;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0D9488,#0EA5E9)',
  'linear-gradient(135deg,#7C3AED,#EC4899)',
  'linear-gradient(135deg,#0EA5E9,#06B6D4)',
  'linear-gradient(135deg,#16A34A,#0D9488)',
  'linear-gradient(135deg,#D97706,#F59E0B)',
  'linear-gradient(135deg,#7C3AED,#0EA5E9)',
  'linear-gradient(135deg,#DC2626,#F97316)',
];

function gradientFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ExpertCard({ expert, index = 0, onConnect, onCollaborate, onInviteToStudy, onMessage, busy }) {
  const [hovered, setHovered] = useState(false);
  const badge = badgeFor(expert);
  const location = [expert.hospital?.name, expert.hospital?.country].filter(Boolean).join(' \u00b7 ');

  const isPending = expert.connection_status === 'pending_sent';
  const isIncoming = expert.connection_status === 'pending_received';
  const isConnected = expert.connection_status === 'connected';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: '1px solid var(--lavender-100)',
        borderRadius: 18,
        padding: 20,
        boxShadow: hovered ? '0 14px 40px rgba(92,107,192,0.18)' : '0 2px 10px rgba(92,107,192,0.06)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        animation: 'slideUp 0.5s ease both',
        animationDelay: `${Math.min(index * 0.05, 0.6)}s`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: gradientFor(expert.id),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {initials(expert.full_name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>{expert.full_name}</span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: 20,
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--lavender-600)', fontWeight: 600, marginTop: 3 }}>
            {expert.specialty || 'Specialty not listed'}
          </div>
          {location && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{location}</div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 0',
          borderTop: '1px solid var(--lavender-50)',
          borderBottom: '1px solid var(--lavender-50)',
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            {expert.cases_managed}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Cases Managed</div>
        </div>
        <div style={{ width: 1, background: 'var(--lavender-100)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            {expert.publications}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Publications</div>
        </div>
      </div>

      {expert.topics?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Discovery Contributions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {expert.topics.slice(0, 3).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  background: 'var(--lavender-50)',
                  color: 'var(--lavender-700)',
                  borderRadius: 20,
                  padding: '3px 9px',
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isConnected ? (
          <button
            onClick={() => onMessage(expert)}
            style={btnStyle('primary')}
          >
            Message
          </button>
        ) : isIncoming ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
            Sent you a request &mdash; check Collaborations
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => onConnect(expert)}
                disabled={isPending || busy}
                style={{ ...btnStyle('primary'), flex: 1, opacity: isPending ? 0.6 : 1, cursor: isPending ? 'default' : 'pointer' }}
              >
                {isPending ? 'Requested' : 'Connect'}
              </button>
              <button onClick={() => onCollaborate(expert)} disabled={busy} style={{ ...btnStyle('secondary'), flex: 1 }}>
                Request Collaboration
              </button>
            </div>
            <button onClick={() => onInviteToStudy(expert)} disabled={busy} style={btnStyle('secondary')}>
              Invite to Study
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btnStyle(variant) {
  const base = {
    padding: '9px 12px',
    borderRadius: 9,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    textAlign: 'center',
  };
  if (variant === 'primary') {
    return { ...base, background: 'var(--lavender-600)', color: 'white', border: 'none', boxShadow: '0 3px 12px rgba(61,90,254,0.25)' };
  }
  return { ...base, background: 'white', color: 'var(--lavender-700)', border: '1.5px solid var(--lavender-200)' };
}
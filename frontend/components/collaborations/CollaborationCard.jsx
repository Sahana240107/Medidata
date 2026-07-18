'use client';

import { useState } from 'react';
import { formatRelativeTime } from '@/lib/utils/formatters';

/**
 * CollaborationCard — one row in the contacts list: pending request
 * (Accept/Decline), or an active/connected contact (opens chat).
 */

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
  return (name || '?').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function CollaborationCard({ collab, variant = 'active', onAccept, onDecline, onOpenChat, busy, selected }) {
  const [hovered, setHovered] = useState(false);
  const { counterpart } = collab;
  const roleLine = [counterpart.specialty, counterpart.hospital_name, counterpart.country].filter(Boolean).join(' \u00b7 ');

  return (
    <div
      onClick={variant === 'active' ? () => onOpenChat(collab) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderBottom: '1px solid var(--lavender-50)',
        cursor: variant === 'active' ? 'pointer' : 'default',
        background: selected ? 'var(--lavender-50)' : hovered && variant === 'active' ? 'var(--lavender-50)' : 'white',
        transition: 'background 0.15s',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: gradientFor(counterpart.id),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {initials(counterpart.full_name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)' }}>{counterpart.full_name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {roleLine || '\u2014'}
        </div>
      </div>

      {variant === 'incoming' ? (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(collab); }}
              disabled={busy}
              style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--lavender-600)', color: 'white', border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Accept
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDecline(collab); }}
              disabled={busy}
              style={{ padding: '6px 12px', borderRadius: 7, background: 'white', color: 'var(--text-secondary)', border: '1.5px solid var(--lavender-100)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Decline
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Requested {formatRelativeTime(collab.created_at)}
          </div>
        </div>
      ) : variant === 'outgoing' ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          Awaiting response
        </div>
      ) : (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />
            <span style={{ fontSize: 11, color: '#16A34A' }}>Connected</span>
          </div>
          {collab.project_title && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{collab.project_title}</div>
          )}
        </div>
      )}
    </div>
  );
}
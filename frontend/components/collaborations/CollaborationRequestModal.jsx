'use client';

import { useState } from 'react';

/**
 * CollaborationRequestModal — used from the Experts page for "Request
 * Collaboration" and "Invite to Study" (both need a custom message; plain
 * "Connect" fires instantly without a modal).
 */

const KIND_META = {
  collaborate: {
    title: 'Request Collaboration',
    placeholder: 'Describe the collaboration you have in mind (shared cases, joint analysis, co-authorship...)',
    showProjectTitle: false,
  },
  invite_to_study: {
    title: 'Invite to Study',
    placeholder: 'Describe the study and what you\u2019d like their involvement to be...',
    showProjectTitle: true,
  },
};

export default function CollaborationRequestModal({ open, expert, kind = 'collaborate', onClose, onSubmit, submitting }) {
  const [message, setMessage] = useState('');
  const [projectTitle, setProjectTitle] = useState('');

  if (!open || !expert) return null;
  const meta = KIND_META[kind] || KIND_META.collaborate;

  const handleSubmit = () => {
    onSubmit({ message: message.trim() || undefined, projectTitle: projectTitle.trim() || undefined });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,31,78,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.15s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 20,
          width: 460,
          maxWidth: '95vw',
          boxShadow: '0 24px 70px rgba(26,31,78,0.25)',
          padding: 28,
          animation: 'modalPop 0.2s cubic-bezier(.34,1.56,.64,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
              {meta.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              to {expert.full_name}{expert.specialty ? ` \u00b7 ${expert.specialty}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--lavender-50)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: 6, display: 'flex' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {meta.showProjectTitle && (
          <input
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="Study / project title"
            style={inputStyle}
          />
        )}

        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={meta.placeholder}
          style={{ ...inputStyle, resize: 'none', marginTop: meta.showProjectTitle ? 12 : 0 }}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '12px',
            background: submitting ? 'var(--lavender-300)' : 'var(--lavender-600)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          {submitting ? 'Sending\u2026' : 'Send Request'}
        </button>
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid var(--lavender-100)',
  borderRadius: 10,
  fontSize: 13.5,
  fontFamily: 'inherit',
  color: 'var(--navy)',
  outline: 'none',
  marginBottom: 0,
};
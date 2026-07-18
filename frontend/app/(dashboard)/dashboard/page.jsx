'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fetchSignals, fetchStats } from '@/lib/api/feed';

/* ── tiny helpers ── */
const Tag = ({ color, children }) => {
  const palettes = {
    red:    { bg: '#fee2e2', color: '#dc2626' },
    blue:   { bg: 'var(--lavender-100)', color: 'var(--lavender-700)' },
    teal:   { bg: '#ccfbf1', color: '#0d9488' },
    violet: { bg: '#ede9fe', color: '#7c3aed' },
    amber:  { bg: '#fef3c7', color: '#d97706' },
    green:  { bg: '#dcfce7', color: '#16a34a' },
    gray:   { bg: 'var(--lavender-50)', color: 'var(--text-secondary)' },
  };
  const p = palettes[color] || palettes.gray;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: p.bg, color: p.color,
    }}>
      {children}
    </span>
  );
};

const ConfBar = ({ pct, color = 'var(--lavender-600)' }) => (
  <div style={{ marginTop: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
      <span>Confidence</span><span>{pct}%</span>
    </div>
    <div style={{ background: 'var(--lavender-100)', borderRadius: 20, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 20, background: color, transition: 'width 1.2s ease' }} />
    </div>
  </div>
);

/* ── Animated counter ── */
function AnimatedNumber({ target, prefix = '', suffix = '' }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    started.current = false; // allow re-animation when target changes after fetch resolves
    started.current = true;
    const duration = 1400;
    const start = Date.now();
    const isNum = typeof target === 'number';
    if (!isNum) { setVal(target); return; }
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  if (typeof target !== 'number') return <>{target}</>;
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

/* ── signal_type -> card presentation (DB has no styling info, so this maps it) ── */
const SIGNAL_TYPE_META = {
  emerging_syndrome: {
    tagLabel: '🔴 Emerging Syndrome', tagColor: 'red', confColor: '#dc2626',
    headerBg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  },
  drug_response: {
    tagLabel: '💊 Drug Response', tagColor: 'blue', confColor: 'var(--lavender-600)',
    headerBg: 'linear-gradient(135deg, var(--lavender-500) 0%, var(--lavender-700) 100%)',
  },
  biomarker: {
    tagLabel: '🧬 Novel Biomarker', tagColor: 'teal', confColor: '#0d9488',
    headerBg: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
  },
  research_opportunity: {
    tagLabel: '🔬 Research Opportunity', tagColor: 'violet', confColor: '#7c3aed',
    headerBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  },
};

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildMeta(signal) {
  const count = signal.patient_count ?? signal.case_count;
  const countLabel = signal.patient_count ? 'patients' : 'cases';
  const parts = [`${count} ${countLabel}`];
  if (signal.hospital_count) parts.push(`${signal.hospital_count} hospitals`);
  else if (signal.countries?.length) parts.push(`${signal.countries.length} countries`);
  parts.push(`Updated ${timeAgo(signal.updated_at)}`);
  return parts.join(' · ');
}

/* ── Stat card definitions — icon + color chrome stay static, values come from the API ── */
const STAT_ICONS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    iconBg: 'var(--lavender-50)', iconColor: 'var(--lavender-600)',
    label: 'Matched Cases Globally', key: 'matched_cases_global',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    iconBg: '#ccfbf1', iconColor: '#0d9488',
    label: 'Discovery Signals Active', key: 'active_signals',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    iconBg: '#ede9fe', iconColor: '#7c3aed',
    label: 'Active Collaborations', key: 'active_collaborations',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    iconBg: '#fef3c7', iconColor: '#d97706',
    label: 'Hospital Global Rank', key: 'hospital_rank', prefix: '#',
  },
];

/* ── AI Chat modal (unchanged — demo content, not part of the data wiring) ── */
function AIChatModal({ open, onClose }) {
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello. I've analysed your recent case submissions. Based on the symptom profile, one of your active signals looks highly relevant. Want me to summarise the key findings?" },
  ]);
  if (!open) return null;
  const send = () => {
    if (!msg.trim()) return;
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setMsg('');
  };
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,31,78,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 20, width: 480, maxWidth: '95vw',
          boxShadow: '0 20px 60px rgba(26,31,78,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '80vh',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px',
          borderBottom: '1px solid var(--lavender-100)',
          background: 'linear-gradient(135deg, var(--lavender-700), var(--lavender-500))',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="12" rx="2" />
              <path d="M8 19h8M12 15v4" />
              <circle cx="9" cy="9" r="1" fill="white" /><circle cx="15" cy="9" r="1" fill="white" />
              <path d="M9 12c0-1 1-2 3-2s3 1 3 2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>MediData AI</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>● Active · Medical intelligence assistant</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'var(--lavender-600)' : 'var(--lavender-50)',
                color: m.role === 'user' ? 'white' : 'var(--navy)',
                fontSize: 13, lineHeight: 1.6,
              }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--lavender-100)', display: 'flex', gap: 8 }}>
          <textarea
            rows={2}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about cases, signals, experts..."
            style={{
              flex: 1, resize: 'none', border: '1.5px solid var(--lavender-100)', borderRadius: 10,
              padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--navy)',
              outline: 'none',
            }}
          />
          <button
            onClick={send}
            style={{
              alignSelf: 'flex-end', padding: '9px 16px',
              background: 'var(--lavender-600)', color: 'white', border: 'none',
              borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── New Case Modal (unchanged) ── */
function NewCaseModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,31,78,0.45)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 20, width: 460, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(26,31,78,0.2)', padding: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>Submit a New Case</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Match your patient against the global network</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--lavender-50)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: 6, display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {['Primary symptoms (e.g. muscle weakness, fever)', 'Lab findings (e.g. elevated CRP, low platelet)', 'Imaging summary (optional)', 'Clinical notes (optional)'].map((p, i) => (
          <input key={i} placeholder={p} className="form-input" style={{
            width: '100%', padding: '11px 14px', border: '1.5px solid var(--lavender-100)',
            borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: 'var(--navy)', marginBottom: 12, outline: 'none',
          }} />
        ))}
        <Link href="/search" onClick={onClose}>
          <button style={{
            width: '100%', padding: '12px', background: 'var(--lavender-600)', color: 'white',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Find Similar Cases →
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   MAIN DASHBOARD PAGE
══════════════════════════════════ */
export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [notifCount] = useState(0);

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [signals, setSignals] = useState(null);
  const [signalsError, setSignalsError] = useState(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(e => setStatsError(e.message));
    fetchSignals(4).then(setSignals).catch(e => setSignalsError(e.message));
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <AIChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
      <NewCaseModal open={newCaseOpen} onClose={() => setNewCaseOpen(false)} />

      {/* ── HEADER ── */}
      <header style={{
        padding: '16px 32px',
        background: 'var(--white)',
        borderBottom: '1px solid var(--lavender-100)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 1px 8px rgba(92,107,192,0.06)',
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            {greeting} 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {stats?.hospital_name ? ` · ${stats.hospital_name}` : ''}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setNewCaseOpen(true)}
            title="Add new case"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px',
              background: 'var(--lavender-600)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-700)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--lavender-600)'; e.currentTarget.style.transform = 'none'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Case
          </button>

          <button
            onClick={() => setChatOpen(true)}
            title="Open MediData AI"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--white)',
              border: '1.5px solid var(--lavender-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-600)'; e.currentTarget.querySelector('svg').style.stroke = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.querySelector('svg').style.stroke = 'var(--lavender-600)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lavender-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="8" width="18" height="11" rx="2" />
              <path d="M12 3v5M9 8V6M15 8V6" />
              <circle cx="9" cy="14" r="1.5" fill="currentColor" /><circle cx="15" cy="14" r="1.5" fill="currentColor" />
              <path d="M9 18c0-1 1-2 3-2s3 1 3 2" />
            </svg>
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8, background: '#0d9488',
              borderRadius: '50%', border: '2px solid white',
            }} />
          </button>

          <button
            title="Notifications"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--white)',
              border: '1.5px solid var(--lavender-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-50)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--white)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lavender-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: '#dc2626', color: 'white',
                fontSize: 9, fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', border: '2px solid white',
              }}>
                {notifCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <div style={{ padding: '28px 32px' }}>

        {/* ── SEARCH BAR ── */}
        <Link href="/search" style={{ textDecoration: 'none', display: 'block', marginBottom: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--white)',
            border: '1.5px solid var(--lavender-100)',
            borderRadius: 12, padding: '13px 18px',
            cursor: 'pointer', transition: 'all 0.15s',
            boxShadow: '0 2px 8px rgba(92,107,192,0.06)',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lavender-400)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(92,107,192,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lavender-100)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(92,107,192,0.06)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ fontSize: 15, color: 'var(--text-muted)', flex: 1 }}>
              Search cases, experts, signals, biomarkers…
            </span>
            <span style={{
              fontSize: 11, color: 'var(--text-muted)',
              border: '1px solid var(--lavender-100)', borderRadius: 5,
              padding: '2px 7px', background: 'var(--lavender-50)',
            }}>
              ⌘ K
            </span>
          </div>
        </Link>

        {/* ── STATS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          gap: 16, marginBottom: 28,
        }}>
          {STAT_ICONS.map((s, i) => {
            const raw = stats?.[s.key];
            const value = raw == null ? '—' : (s.prefix ? `${s.prefix}${raw}` : raw);
            return (
              <div key={i} style={{
                background: 'var(--white)',
                border: '1px solid var(--lavender-100)',
                borderRadius: 14, padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(92,107,192,0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(92,107,192,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(92,107,192,0.05)'; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: s.iconBg, color: s.iconColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
                  {!stats && !statsError ? (
                    <span style={{ opacity: 0.35 }}>···</span>
                  ) : (
                    <AnimatedNumber target={value} />
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
        {statsError && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: -20, marginBottom: 20 }}>
            Couldn't load stats: {statsError}
          </div>
        )}

        {/* ── DISCOVERY FEED SECTION ── */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
              Discovery Feed
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              AI-detected signals from the global case network
            </div>
          </div>
          <Link href="/feed" style={{
            fontSize: 13, color: 'var(--lavender-600)', fontWeight: 600, textDecoration: 'none',
          }}>
            Explore all →
          </Link>
        </div>

        {/* ── HORIZONTAL FEED CARDS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 16,
        }}>
          {!signals && !signalsError && [0, 1, 2, 3].map(i => (
            <div key={i} style={{
              background: 'var(--lavender-50)', borderRadius: 16, minHeight: 260,
              border: '1px solid var(--lavender-100)',
            }} />
          ))}
          {signals?.map(item => (
            <FeedDiscoveryCard key={item.id} item={item} />
          ))}
        </div>
        {signalsError && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 12 }}>
            Couldn't load the discovery feed: {signalsError}
          </div>
        )}
        {signals && signals.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
            No active signals yet — run the discovery scan or check back later.
          </div>
        )}
      </div>
    </>
  );
}

/* ── Discovery Card: color band on top, content below ── */
function FeedDiscoveryCard({ item }) {
  const [hovered, setHovered] = useState(false);
  const meta = SIGNAL_TYPE_META[item.signal_type] || SIGNAL_TYPE_META.research_opportunity;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--white)',
        border: '1px solid var(--lavender-100)',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(92,107,192,0.18)' : '0 2px 10px rgba(92,107,192,0.07)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Colored top band */}
      <div style={{
        background: meta.headerBg,
        padding: '18px 18px 16px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 80,
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
        }} />
        <div style={{
          position: 'absolute', right: 20, bottom: -30,
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          display: 'inline-block', background: 'rgba(255,255,255,0.22)',
          backdropFilter: 'blur(4px)',
          padding: '4px 10px', borderRadius: 20,
          fontSize: 11, fontWeight: 700, color: 'white',
          position: 'relative', zIndex: 1,
        }}>
          {meta.tagLabel}
        </div>
        <div style={{
          marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.75)',
          fontWeight: 500, position: 'relative', zIndex: 1,
        }}>
          {buildMeta(item)}
        </div>
      </div>

      {/* Content below */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.4, marginBottom: 8 }}>
          {item.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
          {item.summary}
        </div>

        <ConfBar pct={item.confidence} color={meta.confColor} />

        {/* Explore More button */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--lavender-50)' }}>
          <Link href={`/feed/${item.id}`} style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%', padding: '8px 0',
              background: 'var(--lavender-50)', color: 'var(--lavender-700)',
              border: '1.5px solid var(--lavender-100)',
              borderRadius: 9, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--lavender-600)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'var(--lavender-600)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--lavender-50)'; e.currentTarget.style.color = 'var(--lavender-700)'; e.currentTarget.style.borderColor = 'var(--lavender-100)'; }}
            >
              Explore More →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

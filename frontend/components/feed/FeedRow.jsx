'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils/formatters';

const TYPE_META = {
  emerging_syndrome: { label: 'Emerging Syndrome', icon: '🔴', color: '#dc2626' },
  drug_response: { label: 'Drug Response', icon: '💊', color: '#4d5aa6' },
  biomarker: { label: 'Novel Biomarker', icon: '🧬', color: '#0d9488' },
  research_opportunity: { label: 'Research Opportunity', icon: '🔬', color: '#7c3aed' },
};

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/** Small ring built for a WHITE background — colored progress arc + number
 * in the center, sized to sit at the left edge of a row. */
function MiniRing({ value = 0, color, size = 54 }) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const duration = 1100;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setDisplay(Math.round(easeOutCubic(t) * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  const offset = circumference * (1 - display / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--lavender-100)" strokeWidth="4.5" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="4.5"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.28, fontWeight: 800, color: 'var(--navy)', fontFamily: "'Sora', sans-serif",
      }}>
        {display}
      </div>
    </div>
  );
}

/**
 * FeedRow — a single Discovery Feed signal as a horizontal list row
 * (replaces the old boxed-card grid). A thin colored bar on the left edge
 * carries the signal-type color instead of a full-width banner, keeping
 * rows compact enough to scan six at a time down a page.
 */
export default function FeedRow({ signal, index = 0 }) {
  const [hovered, setHovered] = useState(false);
  const meta = TYPE_META[signal.signal_type] || TYPE_META.research_opportunity;
  const primaryStat = signal.patient_count ? `${signal.patient_count} patients` : `${signal.case_count} cases`;
  const secondaryStat = signal.countries?.length ? `${signal.countries.length} countries` : `${signal.hospital_count} hospitals`;

  return (
    <Link href={`/feed/${signal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="feed-row"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          animationDelay: `${Math.min(index, 8) * 0.06}s`,
          background: hovered ? 'var(--lavender-50)' : 'var(--white)',
        }}
      >
        <div className="row-accent" style={{ background: meta.color }} />
        <MiniRing value={signal.confidence} color={meta.color} />

        <div className="row-main">
          <div className="row-title">{signal.title}</div>
          <div className="row-meta">
            <span className="type-chip" style={{ color: meta.color, background: `${meta.color}1a` }}>
              {meta.icon} {meta.label}
            </span>
            <span className="dot">·</span>
            <span>{primaryStat}</span>
            <span className="dot">·</span>
            <span>{secondaryStat}</span>
            <span className="dot">·</span>
            <span>Updated {formatRelativeTime(signal.updated_at)}</span>
          </div>
        </div>

        <div className="row-actions">
          <div className="conf-pill" style={{ color: meta.color }}>
            {signal.confidence}% confidence
          </div>
          <div className="chevron" style={{ background: hovered ? meta.color : 'var(--lavender-50)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hovered ? 'white' : 'var(--lavender-500)'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>

      <style jsx>{`
        .feed-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 20px 14px 24px;
          border-radius: 14px;
          border: 1px solid var(--lavender-100);
          cursor: pointer;
          overflow: hidden;
          opacity: 0;
          animation: rowIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: background 0.15s, box-shadow 0.2s, transform 0.2s;
        }
        .feed-row:hover { box-shadow: 0 8px 28px rgba(92,107,192,0.14); transform: translateX(2px); }
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .row-accent {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
        }
        .row-main { flex: 1; min-width: 0; }
        .row-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-meta {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
          font-size: 11.5px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .type-chip {
          padding: 2px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }
        .dot { color: var(--lavender-200); }
        .row-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }
        .conf-pill {
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          display: none;
        }
        @media (min-width: 720px) {
          .conf-pill { display: block; }
        }
        .chevron {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.18s, transform 0.18s;
        }
        .feed-row:hover .chevron { transform: translateX(2px); }
      `}</style>
    </Link>
  );
}
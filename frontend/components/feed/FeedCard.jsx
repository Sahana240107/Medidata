'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils/formatters';

/* ── signal_type → visual treatment (real enum: syndrome | biomarker | drug_response | disease_cluster) ── */
const TYPE_META = {
  syndrome: {
    label: '🔴 Emerging Syndrome',
    headerBg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    confColor: '#dc2626',
  },
  drug_response: {
    label: '💊 Drug Response',
    headerBg: 'linear-gradient(135deg, var(--lavender-500) 0%, var(--lavender-700) 100%)',
    confColor: 'var(--lavender-600)',
  },
  biomarker: {
    label: '🧬 Novel Biomarker',
    headerBg: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    confColor: '#0d9488',
  },
  disease_cluster: {
    label: '🔬 Disease Cluster',
    headerBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    confColor: '#7c3aed',
  },
};

function buildMeta(signal) {
  const primary = `${signal.matching_case_count} cases`;
  const secondary = signal.countries?.length
    ? `${signal.countries.length} countries`
    : `${signal.participating_hospital_count} hospitals`;
  return `${primary} · ${secondary} · Updated ${formatRelativeTime(signal.updated_at)}`;
}

function ConfBar({ pct, color }) {
  const value = pct ?? 0;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        <span>Confidence</span><span>{Math.round(value)}%</span>
      </div>
      <div style={{ background: 'var(--lavender-100)', borderRadius: 20, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 20, background: color, transition: 'width 1.2s ease' }} />
      </div>
    </div>
  );
}

/**
 * FeedCard — a single Discovery Feed signal.
 * Used on both the dashboard preview strip and the full /feed page.
 */
export default function FeedCard({ signal }) {
  const [hovered, setHovered] = useState(false);
  const meta = TYPE_META[signal.signal_type] || TYPE_META.disease_cluster;

  return (
    <Link href={`/feed/${signal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
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
          height: '100%',
        }}
      >
        <div style={{ background: meta.headerBg, padding: '18px 18px 16px', position: 'relative', overflow: 'hidden', minHeight: 80 }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ position: 'absolute', right: 20, bottom: -30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{
            display: 'inline-block', background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(4px)',
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'white',
            position: 'relative', zIndex: 1,
          }}>
            {meta.label}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 500, position: 'relative', zIndex: 1 }}>
            {buildMeta(signal)}
          </div>
        </div>

        <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.4, marginBottom: 8 }}>
            {signal.title}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
            {signal.description}
          </div>

          <ConfBar pct={signal.confidence_score} color={meta.confColor} />

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--lavender-50)' }}>
            <button style={{
              width: '100%', padding: '8px 0',
              background: 'var(--lavender-50)', color: 'var(--lavender-700)',
              border: '1.5px solid var(--lavender-100)',
              borderRadius: 9, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
              Explore More →
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

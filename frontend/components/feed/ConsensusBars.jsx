'use client';

import { useEffect, useRef, useState } from 'react';

const METRICS = [
  { key: 'evidence_score', label: 'Evidence', hint: 'Strength of the underlying clinical data' },
  { key: 'reproducibility_score', label: 'Reproducibility', hint: 'Consistency of the pattern across cases' },
  { key: 'hospital_diversity_score', label: 'Hospital Diversity', hint: 'Spread across independent hospitals' },
  { key: 'data_quality_score', label: 'Data Quality', hint: 'Completeness of the records involved' },
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * ConsensusBars — animated horizontal bars for the 4 consensus metrics.
 *
 * Replaces the old radar/spider chart: bars read left-to-right at a glance,
 * compare cleanly against each other (a radar's polygon area distorts
 * comparisons depending on axis order), and stay legible on narrow screens
 * where a radar chart cramps up. Each bar counts up and fills in on mount,
 * staggered by row so the panel reads top-to-bottom instead of firing all
 * at once.
 */
export default function ConsensusBars({ scores, color = '#5c6bc0' }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const DURATION = 900;

  const values = METRICS.map((m) => {
    const raw = scores?.[m.key];
    const n = typeof raw === 'string' ? parseFloat(raw) : raw;
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  });
  const hasAnyScore = values.some((v) => v !== null && v > 0);
  const overall = hasAnyScore
    ? Math.round(values.reduce((a, v) => a + (v || 0), 0) / values.filter((v) => v !== null).length)
    : null;

  useEffect(() => {
    if (!hasAnyScore) return undefined;
    startRef.current = null;
    const tick = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / DURATION);
      setProgress(easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyScore, JSON.stringify(values)]);

  if (!hasAnyScore) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
        No consensus scores recorded yet for this signal.
      </div>
    );
  }

  return (
    <div className="bars-wrap">
      {overall !== null && (
        <div className="overall-row">
          <div className="overall-num" style={{ color }}>{Math.round(overall * progress)}</div>
          <div className="overall-label">Overall consensus score</div>
        </div>
      )}

      {METRICS.map((m, i) => {
        const target = values[i] ?? 0;
        const shown = Math.round(target * progress);
        const rowDelay = i * 0.09;
        return (
          <div key={m.key} className="bar-row" style={{ animationDelay: `${rowDelay}s` }} title={m.hint}>
            <div className="bar-head">
              <span className="bar-label">{m.label}</span>
              <span className="bar-value" style={{ color }}>{shown}</span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(target * progress)}%`, background: color }}
              >
                <div className="bar-shine" />
              </div>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .bars-wrap { display: flex; flex-direction: column; gap: 14px; }
        .overall-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding-bottom: 14px;
          margin-bottom: 2px;
          border-bottom: 1px dashed var(--lavender-100);
        }
        .overall-num {
          font-family: 'Sora', sans-serif;
          font-size: 30px;
          font-weight: 800;
          line-height: 1;
        }
        .overall-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .bar-row {
          opacity: 0;
          animation: rowIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .bar-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 5px;
        }
        .bar-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .bar-value {
          font-size: 13px;
          font-weight: 800;
          font-family: 'Sora', sans-serif;
        }
        .bar-track {
          height: 8px;
          border-radius: 20px;
          background: var(--lavender-50);
          overflow: hidden;
        }
        .bar-fill {
          position: relative;
          height: 100%;
          border-radius: 20px;
          overflow: hidden;
        }
        .bar-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0));
        }
      `}</style>
    </div>
  );
}
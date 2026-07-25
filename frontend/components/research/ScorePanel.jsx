'use client';

import { useEffect, useState } from 'react';
import styles from './research.module.css';

const DIMENSIONS = [
  { key: 'evidence_strength', label: 'Evidence strength' },
  { key: 'falsification_resistance', label: 'Falsification resistance' },
  { key: 'generalizability', label: 'Generalizability' },
  { key: 'confounding_risk', label: 'Confounding risk', invert: true },
];

function barColor(value, invert) {
  const good = 'var(--lavender-500)';
  const mid = '#f2ab4d';
  const bad = '#e57373';
  if (invert) return value >= 4 ? bad : value >= 3 ? mid : good;
  return value >= 4 ? good : value >= 3 ? mid : bad;
}

export default function ScorecardPanel({ scorecard, animate }) {
  // when `animate` is set, bars fill from 0 -> value on mount, for the reveal moment
  const [filled, setFilled] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setFilled(true), 80);
    return () => clearTimeout(t);
  }, [animate]);

  const overall = scorecard.overall ?? round4(scorecard);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelLabel}>Scorecard</span>
        <span className={styles.scoreOverall}>
          {overall}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>/5 overall</span>
        </span>
      </div>

      {DIMENSIONS.map((d, i) => (
        <div key={d.key} className={styles.scoreRow}>
          <div className={styles.scoreTopRow}>
            <span className={styles.scoreLabel}>{d.label}</span>
            <span className={styles.scoreValue}>{scorecard[d.key]}/5</span>
          </div>
          <div className={styles.scoreBarTrack}>
            <div
              className={styles.scoreBarFill}
              style={{
                width: filled ? `${(scorecard[d.key] / 5) * 100}%` : '0%',
                background: barColor(scorecard[d.key], d.invert),
                transition: `width 0.7s cubic-bezier(.2,.8,.2,1) ${i * 0.09}s`,
              }}
            />
          </div>
          <div className={styles.scoreReason}>{scorecard[`${d.key}_reason`]}</div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>rubric {scorecard.rubric_version}</div>
    </div>
  );
}

function round4(s) {
  return Math.round(((s.evidence_strength + s.falsification_resistance + s.generalizability + (6 - s.confounding_risk)) / 4) * 100) / 100;
}

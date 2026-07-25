'use client';

import styles from './research.module.css';

const VERDICT_LABEL = {
  robust: 'Robust',
  fragile: 'Fragile',
  insufficient_data: 'Insufficient data',
};
const VERDICT_CLASS = {
  robust: styles.verdictRobust,
  fragile: styles.verdictFragile,
  insufficient_data: styles.verdictInsufficient,
};

export default function FalsificationSummaryCard({ result, simulated }) {
  const { baseline, overall_verdict, fragility_reasons, family_size } = result;

  return (
    <div className={`${styles.panel} ${styles.fadeInUp}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelLabel}>
          Falsification Result
          {simulated && <span className={styles.simBadge}>Simulated</span>}
        </span>
        <span className={`${styles.verdictBadge} ${VERDICT_CLASS[overall_verdict]}`}>
          {VERDICT_LABEL[overall_verdict] ?? overall_verdict}
        </span>
      </div>

      <div className={styles.summaryRow}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Odds ratio</div>
          <div className={styles.summaryValue}>{baseline.odds_ratio ?? '—'}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>95% CI</div>
          <div className={styles.summaryValue} style={{ fontSize: 15 }}>
            {baseline.ci_low ?? '—'} to {baseline.ci_high ?? '—'}
          </div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>p-value</div>
          <div className={styles.summaryValue}>{baseline.p_value ?? '—'}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Checks (corrected)</div>
          <div className={styles.summaryValue}>{family_size}</div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        n<sub>intervention</sub> = {baseline.n_intervention} · n<sub>control</sub> = {baseline.n_control} ·{' '}
        {baseline.test_used.replace(/_/g, ' ')}
      </div>

      {fragility_reasons.length > 0 && (
        <div className={styles.warnBox}>
          <div className={styles.warnBoxTitle}>Why this is flagged fragile</div>
          <ul className={styles.warnBoxList}>
            {fragility_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
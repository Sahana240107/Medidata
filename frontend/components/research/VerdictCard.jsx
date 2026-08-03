'use client';

import styles from './research.module.css';

const VERDICT_LABEL = {
  supported: 'Supported',
  fragile_support: 'Fragile support',
  no_significant_association: 'No significant association',
  contradicted_by_falsification: 'Contradicted',
  insufficient_evidence: 'Insufficient evidence',
};
const VERDICT_CLASS = {
  supported: styles.verdictSupported,
  fragile_support: styles.verdictFragileSupport,
  no_significant_association: styles.verdictNoSignificant,
  contradicted_by_falsification: styles.verdictContradicted,
  insufficient_evidence: styles.verdictInsufficient,
};

export default function VerdictCard({ verdict, justRevealed, simulated }) {
  return (
    <div className={`${styles.panel} ${styles.verdictPanel} ${justRevealed ? styles.verdictRevealAnim : ''}`}>
      <div className={styles.hypoTopRow}>
        <div className={styles.hypoTags}>
          <span className={`${styles.pill} ${styles.pillNeutral}`}>Verdict</span>
          {simulated && <span className={styles.simBadge}>Simulated</span>}
        </div>
        <span className={`${styles.verdictBadge} ${styles.verdictBadgeBig} ${VERDICT_CLASS[verdict.verdict]}`}>
          {VERDICT_LABEL[verdict.verdict] ?? verdict.verdict}
        </span>
      </div>

      <p className={styles.hypoStatement} style={{ fontSize: 15, fontWeight: 500 }}>
        {verdict.narrative}
      </p>

      {verdict.restricted_to && (
        <div className={styles.warnBox}>
          <div className={styles.warnBoxTitle}>Scope restriction</div>
          <p style={{ fontSize: 12.5, color: '#8a5000', lineHeight: 1.6, margin: 0 }}>
            {verdict.restricted_to}
          </p>
        </div>
      )}

      <div className={styles.ruleFired}>rule: {verdict.rule_fired}</div>
    </div>
  );
}
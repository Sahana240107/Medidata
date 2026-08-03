'use client';

import styles from './research.module.css';

const FAMILY_LABELS = {
  leave_one_hospital_out: 'Leave-one-hospital-out',
  leave_one_country_out: 'Leave-one-country-out',
  leave_one_demographic_out: 'Leave-one-demographic-out',
  bootstrap_stability: 'Bootstrap stability',
  time_split: 'Record-date split',
  stratified_interaction: 'Stratified interaction',
};

const STATUS_LABEL = {
  passed: 'Passed',
  failed: 'Failed',
  insufficient_data: 'Insufficient data',
  not_applicable: 'N/A',
};
const STATUS_CLASS = {
  passed: styles.statusPassed,
  failed: styles.statusFailed,
  insufficient_data: styles.statusInsufficient,
  not_applicable: styles.statusNotApplicable,
};

export default function PerturbationCheckList({ checks, revealCount }) {
  const total = checks.length;
  const reveal = revealCount == null ? total : revealCount;

  // stable index across groups so stagger order matches the reveal order
  const indexed = checks.map((c, i) => ({ ...c, _i: i }));
  const grouped = indexed.reduce((acc, c) => {
    (acc[c.check_family] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelLabel}>Robustness Checks</span>
        {reveal < total && (
          <span className={styles.checkProgress}>{reveal} / {total} complete</span>
        )}
      </div>

      {Object.entries(grouped).map(([family, familyChecks]) => (
        <div key={family} className={styles.checkFamilyGroup}>
          <div className={styles.checkFamilyLabel}>{FAMILY_LABELS[family] ?? family}</div>
          {familyChecks.map((c) => {
            const isRevealed = c._i < reveal;
            return (
              <div
                key={c._i}
                className={`${styles.checkRow} ${isRevealed ? styles.checkRowIn : styles.checkRowPending}`}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.checkName}>{c.check_name}</div>
                  {isRevealed && c.detail && <div className={styles.checkDetail}>{c.detail}</div>}
                  {isRevealed && c.verdict_flipped && c.significant_after_correction && (
                    <div className={styles.checkFlipNote}>Direction flipped — significant after correction</div>
                  )}
                </div>
                {isRevealed ? (
                  <span className={`${styles.statusPill} ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                ) : (
                  <span className={styles.statusPillPending}>
                    <span className={styles.miniSpinner} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
'use client';

import { useState } from 'react';
import styles from './research.module.css';

export default function EvidenceCaseCard({ caseData, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const outcomeClass = caseData.outcome === 'Positive' ? styles.outcomePositive : styles.outcomeMixed;

  return (
    <div className={styles.caseCard}>
      <button className={styles.caseHeaderRow} onClick={() => setOpen((o) => !o)}>
        <div className={styles.caseHeaderLeft}>
          <span className={styles.caseId}>{caseData.id}</span>
          <span className={styles.caseInst}>{caseData.institution}</span>
        </div>
        <div className={styles.caseHeaderRight}>
          <span className={styles.matchPill}>{caseData.match}% match</span>
          <span className={outcomeClass}>{caseData.outcome}</span>
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <div className={styles.caseBody}>
          {caseData.summary && (
            <>
              <div className={styles.caseSubLabel}>Summary</div>
              <p className={styles.caseSummary}>{caseData.summary}</p>
            </>
          )}

          {caseData.timeline && (
            <>
              <div className={styles.caseSubLabel}>Clinical timeline</div>
              <div className={styles.timeline}>
                {caseData.timeline.map((t, i) => (
                  <div key={i} className={styles.timelineStep}>
                    <div className={styles.timelineLabel}>{t.label}</div>
                    <div className={styles.timelineText}>{t.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {caseData.medications && (
            <>
              <div className={styles.caseSubLabel}>Medications</div>
              <div className={styles.chipsRow}>
                {caseData.medications.map((m) => (
                  <span key={m} className={styles.medChip}>{m}</span>
                ))}
              </div>
            </>
          )}

          {caseData.observations && (
            <>
              <div className={styles.caseSubLabel}>Supporting observations</div>
              <ul className={styles.bulletList}>
                {caseData.observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

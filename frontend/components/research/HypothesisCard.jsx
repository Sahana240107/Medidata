'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './research.module.css';
import { HYPOTHESIS, OBSERVATIONS } from '@/lib/researchMockData';

const strengthClass = {
  Strong: styles.strengthStrong,
  Moderate: styles.strengthModerate,
  Limited: styles.strengthLimited,
};

export default function HypothesisCard({ onToast }) {
  const [saved, setSaved] = useState(false);

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.hypoTopRow}>
          <div className={styles.hypoTags}>
            <span className={`${styles.pill} ${styles.pillNeutral}`}>Hypothesis</span>
            <span className={`${styles.pill} ${styles.pillDraft}`}>{HYPOTHESIS.status}</span>
          </div>
          <div className={styles.hypoActions}>
            <button
              className={styles.iconBtn}
              onClick={() => { setSaved(true); onToast?.('Hypothesis saved'); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {saved ? 'Saved' : 'Save'}
            </button>
            <button className={styles.iconBtn} onClick={() => onToast?.('Findings exported')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          </div>
        </div>

        <p className={styles.hypoStatement}>{HYPOTHESIS.statement}</p>

        <p className={styles.hypoMeta}>
          Generated from structured clinical evidence · <b>{HYPOTHESIS.meta.supportingCases}</b> supporting cases ·{' '}
          <b>{HYPOTHESIS.meta.institutions}</b> institutions. Traceable to source dataset IDs.
        </p>
      </div>

      <div className={styles.sectionHead}>
        <div className={styles.sectionTitle}>Evidence-backed observations</div>
        <div className={styles.sectionSub}>Every claim here traces back to the patient-level data it was derived from.</div>
      </div>

      <div className={styles.obsGrid}>
        {OBSERVATIONS.map((obs) => (
          <div key={obs.id} className={styles.obsCard}>
            <div className={styles.obsTopRow}>
              <span className={`${styles.strengthPill} ${strengthClass[obs.strength]}`}>{obs.strength}</span>
              <span className={styles.obsCases}>{obs.supportingCases} supporting cases</span>
            </div>
            <div className={styles.obsTitle}>{obs.title}</div>
            <p className={styles.obsSummary}>{obs.summary}</p>
            <div className={styles.obsFooter}>
              <span className={styles.obsVerified}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Provenance verified
              </span>
              <a href="#evidence-explorer" className={styles.linkBtn}>Trace evidence →</a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

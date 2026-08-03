'use client';

import styles from './research.module.css';
import { SAVED_STUDY } from '@/lib/researchMockData';

export default function SavedStudyCard({ onToast }) {
  return (
    <div className={styles.savedCard}>
      <div className={styles.panelLabel}>Saved Study</div>
      <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginTop: 6 }}>
        {SAVED_STUDY.title}
      </div>

      <div className={styles.savedGrid}>
        <div>
          <div className={styles.savedMetaLabel}>Timestamp</div>
          <div className={styles.savedMetaValue}>{SAVED_STUDY.timestamp}</div>
        </div>
        <div>
          <div className={styles.savedMetaLabel}>Dataset version</div>
          <div className={styles.savedMetaValue}>{SAVED_STUDY.datasetVersion}</div>
        </div>
        <div>
          <div className={styles.savedMetaLabel}>Hypotheses generated</div>
          <div className={styles.savedMetaValue}>{SAVED_STUDY.hypothesesGenerated}</div>
        </div>
        <div>
          <div className={styles.savedMetaLabel}>Hypotheses saved</div>
          <div className={styles.savedMetaValue}>{SAVED_STUDY.hypothesesSaved}</div>
        </div>
      </div>

      <div className={styles.savedActions}>
        <button className={styles.btnSecondary} onClick={() => onToast?.('Findings exported')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export findings
        </button>
        <button className={styles.btnSecondary} onClick={() => onToast?.('Study duplicated')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Duplicate study
        </button>
      </div>
    </div>
  );
}

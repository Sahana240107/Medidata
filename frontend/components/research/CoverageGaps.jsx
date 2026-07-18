'use client';

import styles from './research.module.css';
import { COVERAGE_GAPS } from '@/lib/researchMockData';

const severityClass = {
  High: styles.severityHigh,
  Moderate: styles.severityModerate,
  Low: styles.severityLow,
};
const severityColor = {
  High: '#e57373',
  Moderate: '#f2ab4d',
  Low: 'var(--lavender-400)',
};

export default function CoverageGaps() {
  return (
    <div className={styles.panel}>
      <div className={styles.panelLabel} style={{ marginBottom: 4 }}>Coverage Gaps</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Identified limitations in dataset coverage
      </div>
      <div>
        {COVERAGE_GAPS.map((gap) => (
          <div key={gap.id} className={styles.gapRow}>
            <span className={`${styles.gapSeverity} ${severityClass[gap.severity]}`}>{gap.severity}</span>
            <span className={styles.gapLabel}>{gap.label}</span>
            <div className={styles.gapBarTrack}>
              <div
                className={styles.gapBarFill}
                style={{ width: `${gap.coverage}%`, background: severityColor[gap.severity] }}
              />
            </div>
            <span className={styles.gapPercent}>{gap.coverage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

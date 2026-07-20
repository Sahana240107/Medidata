'use client';

import Link from 'next/link';
import styles from './research.module.css';

export default function CrossDatasetCard({ finding }) {
  return (
    <div className={styles.discoveryCard}>
      <div className={styles.discoveryTopRow}>
        <div className={styles.datasetTags}>
          {finding.datasets.map((d) => (
            <span key={d} className={styles.datasetTag}>{d}</span>
          ))}
        </div>
        <span className={styles.confidenceBadge}>{finding.confidence}% confidence</span>
      </div>

      <div className={styles.discoveryPatternLabel}>Pattern</div>
      <p className={styles.discoveryDesc}>{finding.description}</p>

      <div className={styles.discoveryFooter}>
        <div className={styles.discoveryStats}>
          <div className={styles.discoveryStat}>
            <div className={styles.discoveryStatVal}>{finding.cases}</div>
            <div className={styles.discoveryStatLabel}>Cases</div>
          </div>
          <div className={styles.discoveryStat}>
            <div className={styles.discoveryStatVal}>{finding.institutions}</div>
            <div className={styles.discoveryStatLabel}>Sites</div>
          </div>
        </div>
        <Link href={`/research/evidence/${finding.id}`} className={styles.btnEvidence}>
          View Supporting Evidence
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

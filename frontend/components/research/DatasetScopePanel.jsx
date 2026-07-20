'use client';

import { useRouter } from 'next/navigation';
import styles from './research.module.css';
import { DATASETS, DATASET_SUMMARY } from '@/lib/researchMockData';

export default function DatasetScopePanel({ variant = 'collapsed' }) {
  const router = useRouter();

  // "Change dataset" is a demo control — there's no dataset picker screen yet,
  // so it just returns to the workspace entry point.
  const handleChangeDataset = () => router.push('/research');

  if (variant === 'collapsed') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelLabel} style={{ marginBottom: 12 }}>Dataset Scope</div>
        <div className={styles.scopeCollapsedRow}>
          <div className={styles.scopeCollapsedLeft}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>
              Selected clinical datasets
            </span>
            <span className={styles.scopeCount}>{DATASETS.length} selected</span>
          </div>
          <div className={styles.scopeCollapsedActions}>
            <button className={styles.linkBtn} onClick={handleChangeDataset}>
              Change dataset
            </button>
            <button className={styles.btnUpload} onClick={handleChangeDataset}>
              Upload
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Selected clinical datasets</div>
          <div className={styles.scopeCount} style={{ display: 'inline-block', marginTop: 6 }}>
            {DATASETS.length} selected
          </div>
        </div>
      </div>

      <div className={styles.datasetGrid}>
        {DATASETS.map((d) => (
          <div key={d.id} className={styles.datasetCard}>
            <span className={styles.datasetDot} />
            <div className={styles.datasetName}>{d.name}</div>
            <div className={styles.datasetMeta}>{d.cases} cases · {d.institutions} institutions</div>
          </div>
        ))}
      </div>

      <div className={styles.summaryRow}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Total cases</div>
          <div className={styles.summaryValue}>{DATASET_SUMMARY.totalCases}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Institutions</div>
          <div className={styles.summaryValue}>{DATASET_SUMMARY.institutions}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Countries</div>
          <div className={styles.summaryValue}>{DATASET_SUMMARY.countries}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Date range</div>
          <div className={styles.summaryValue} style={{ fontSize: 15 }}>{DATASET_SUMMARY.dateRange}</div>
        </div>
      </div>

      <button className={styles.btnFullChange} onClick={handleChangeDataset}>
        Change Dataset
      </button>
    </div>
  );
}

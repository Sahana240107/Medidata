'use client';

import { useState, useEffect } from 'react';
import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import DatasetScopePanel from '@/components/research/DatasetScopePanel';
import TabSwitcher from '@/components/research/TabSwitcher';
import CrossDatasetCard from '@/components/research/CrossDatasetCard';
import CoverageGaps from '@/components/research/CoverageGaps';
import SavedStudyCard from '@/components/research/SavedStudyCard';
import Toast from '@/components/research/Toast';
import { CROSS_DATASET_FINDINGS } from '@/lib/researchMockData';

export default function DiscoveryPage() {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className={styles.page}>
      <WorkspaceHeader />
      <DatasetScopePanel variant="expanded" />
      <TabSwitcher active="discovery" />

      <div className={styles.panel}>
        <div className={styles.panelLabel} style={{ marginBottom: 4 }}>Cross-Dataset Discovery</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Automatically discovered signals across multiple datasets
        </div>
        {CROSS_DATASET_FINDINGS.map((f) => (
          <CrossDatasetCard key={f.id} finding={f} />
        ))}
      </div>

      <CoverageGaps />
      <SavedStudyCard onToast={setToast} />

      <Toast message={toast} />
    </div>
  );
}

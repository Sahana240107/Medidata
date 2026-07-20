'use client';

import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import DatasetScopePanel from '@/components/research/DatasetScopePanel';

export default function DatasetPage() {
  return (
    <div className={styles.page}>
      <WorkspaceHeader />
      <DatasetScopePanel variant="expanded" />
    </div>
  );
}

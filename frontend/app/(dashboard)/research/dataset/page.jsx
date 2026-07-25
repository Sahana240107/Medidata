'use client';

import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import DatasetUploadPanel from '@/components/research/DatasetUploadPanel';

export default function DatasetPage() {
  return (
    <div className={styles.page}>
      <WorkspaceHeader />
      <DatasetUploadPanel variant="expanded" />
    </div>
  );
}
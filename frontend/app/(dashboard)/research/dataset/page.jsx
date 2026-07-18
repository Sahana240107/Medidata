'use client';

import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import DatasetDownloadPanel from '@/components/research/DatasetDownloadPanel';

export default function DatasetPage() {
  return (
    <div className={styles.page}>
      <WorkspaceHeader />
      <DatasetDownloadPanel />
    </div>
  );
}
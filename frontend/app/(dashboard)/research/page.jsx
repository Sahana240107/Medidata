'use client';

import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import ResearchQuestionBar from '@/components/research/ResearchQuestionBar';

export default function ResearchWorkspacePage() {
  return (
    <div className={styles.page}>
      <WorkspaceHeader />
      <ResearchQuestionBar showTemplates />
    </div>
  );
}

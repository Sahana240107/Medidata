'use client';

import { useState, useEffect } from 'react';
import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import DatasetScopePanel from '@/components/research/DatasetScopePanel';
import TabSwitcher from '@/components/research/TabSwitcher';
import HypothesisCard from '@/components/research/HypothesisCard';
import EvidenceCaseCard from '@/components/research/EvidenceCaseCard';
import ResearchQuestionBar from '@/components/research/ResearchQuestionBar';
import Toast from '@/components/research/Toast';
import { EVIDENCE_CASES } from '@/lib/researchMockData';

export default function HypothesisPage() {
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
      <TabSwitcher active="hypothesis" />

      <HypothesisCard onToast={setToast} />

      <div id="evidence-explorer" className={styles.sectionHead}>
        <div className={styles.sectionTitle}>Evidence Explorer</div>
        <div className={styles.sectionSub}>Detailed case-level evidence supporting this hypothesis, de-identified per patient.</div>
      </div>

      {EVIDENCE_CASES.map((c, i) => (
        <EvidenceCaseCard key={c.id} caseData={c} defaultOpen={i === 0} />
      ))}

      <div style={{ marginTop: 24 }}>
        <ResearchQuestionBar showTemplates={false} />
      </div>

      <Toast message={toast} />
    </div>
  );
}

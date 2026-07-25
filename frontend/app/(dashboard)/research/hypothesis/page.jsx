'use client';

import { useState, useEffect } from 'react';
import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import DatasetUploadPanel from '@/components/research/DatasetUploadPanel';
import TabSwitcher from '@/components/research/TabSwitcher';
import HypothesisCard from '@/components/research/HypothesisCard';
import EvidenceCaseCard from '@/components/research/EvidenceCaseCard';
import EngineRunPanel from '@/components/research/EngineRunPanel';
import ResearchQuestionBar from '@/components/research/ResearchQuestionBar';
import Toast from '@/components/research/Toast';
import { EVIDENCE_CASES, RESEARCH_QUESTION } from '@/lib/researchMockData';

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
      <DatasetUploadPanel variant="expanded" />
      <TabSwitcher active="hypothesis" />

      <HypothesisCard onToast={setToast} />

      <div id="evidence-explorer" className={styles.sectionHead}>
        <div className={styles.sectionTitle}>Evidence Explorer</div>
        <div className={styles.sectionSub}>Detailed case-level evidence supporting this hypothesis, de-identified per patient.</div>
      </div>

      {EVIDENCE_CASES.map((c, i) => (
        <EvidenceCaseCard key={c.id} caseData={c} defaultOpen={i === 0} />
      ))}

      <div id="engine-lab-section" className={styles.sectionHead}>
        <div className={styles.sectionTitle}>Falsification, Verdict &amp; Audit</div>
        <div className={styles.sectionSub}>
          Stress-test the hypothesis with pure-statistics robustness checks, then issue a rule-based,
          fully auditable verdict — no LLM in the loop.
        </div>
      </div>

      <EngineRunPanel hypothesisQuestion={RESEARCH_QUESTION} onToast={setToast} />

      <div style={{ marginTop: 24 }}>
        <ResearchQuestionBar showTemplates={false} />
      </div>

      <Toast message={toast} />
    </div>
  );
}
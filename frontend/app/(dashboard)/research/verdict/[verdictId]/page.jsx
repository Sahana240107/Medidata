import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import { getVerdict, getAuditPack } from '@/lib/api/verdict';
import VerdictCard from '@/components/research/VerdictCard';
import ScorecardPanel from '@/components/research/ScorecardPanel';
import FalsificationSummaryCard from '@/components/research/FalsificationSummaryCard';
import PerturbationCheckList from '@/components/research/PerturbationCheckList';
import AuditPackViewer from '@/components/research/AuditPackViewer';

export default async function VerdictPage({ params }) {
  const [verdict, auditPack] = await Promise.all([
    getVerdict(params.verdictId),
    getAuditPack(params.verdictId),
  ]);

  return (
    <div className={styles.page}>
      <Link href="/research/hypothesis" className={styles.backLink}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to hypothesis
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Verdict</h1>
          <p className={styles.subtitle}>{verdict.evidence.hypothesis_question}</p>
        </div>
      </div>

      <VerdictCard verdict={verdict} />
      <ScorecardPanel scorecard={verdict.scorecard} />
      <FalsificationSummaryCard result={verdict.falsification} />
      <PerturbationCheckList checks={verdict.falsification.checks} />
      <AuditPackViewer auditPack={auditPack} verdictId={params.verdictId} />
    </div>
  );
}
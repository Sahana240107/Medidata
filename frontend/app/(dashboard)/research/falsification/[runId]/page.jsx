import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import { getFalsificationRun } from '@/lib/api/falsification';
import FalsificationSummaryCard from '@/components/research/FalsificationSummaryCard';
import PerturbationCheckList from '@/components/research/PerturbationCheckList';

export default async function FalsificationRunPage({ params }) {
  const result = await getFalsificationRun(params.runId);

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
          <h1 className={styles.title}>Falsification <span className={styles.titleAccent}>Run</span></h1>
          <p className={styles.subtitle}>
            {result.filters.disease ?? result.filters.domain} × {result.filters.intervention_medication}
          </p>
        </div>
      </div>

      <FalsificationSummaryCard result={result} />
      <PerturbationCheckList checks={result.checks} />
    </div>
  );
}
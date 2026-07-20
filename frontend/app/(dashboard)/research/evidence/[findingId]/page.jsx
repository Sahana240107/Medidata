import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import EvidenceCaseCard from '@/components/research/EvidenceCaseCard';
import { CROSS_DATASET_FINDINGS } from '@/lib/researchMockData';

export default function EvidenceDetailPage({ params }) {
  const finding = CROSS_DATASET_FINDINGS.find((f) => f.id === params.findingId);

  return (
    <div className={styles.page}>
      <WorkspaceHeader />

      <Link href="/research/discovery" className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Cross-Dataset Discovery
      </Link>

      {!finding ? (
        <div className={styles.panel}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
            Finding not found
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            This finding may have been removed or the link is out of date.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.panel}>
            <div className={styles.discoveryTopRow}>
              <div className={styles.datasetTags}>
                {finding.datasets.map((d) => (
                  <span key={d} className={styles.datasetTag}>{d}</span>
                ))}
              </div>
              <span className={styles.confidenceBadge}>{finding.confidence}% confidence</span>
            </div>

            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 19, fontWeight: 800, color: 'var(--navy)', margin: '4px 0 10px' }}>
              {finding.title}
            </div>
            <p className={styles.discoveryDesc} style={{ marginBottom: 16 }}>{finding.description}</p>

            <div className={styles.discoveryStats}>
              <div className={styles.discoveryStat}>
                <div className={styles.discoveryStatVal}>{finding.cases}</div>
                <div className={styles.discoveryStatLabel}>Cases</div>
              </div>
              <div className={styles.discoveryStat}>
                <div className={styles.discoveryStatVal}>{finding.institutions}</div>
                <div className={styles.discoveryStatLabel}>Sites</div>
              </div>
            </div>
          </div>

          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>Supporting Evidence</div>
            <div className={styles.sectionSub}>Case-level records contributing to this cross-dataset signal.</div>
          </div>

          {finding.supportingCases.map((c, i) => (
            <EvidenceCaseCard key={c.id} caseData={c} defaultOpen={i === 0} />
          ))}
        </>
      )}
    </div>
  );
}

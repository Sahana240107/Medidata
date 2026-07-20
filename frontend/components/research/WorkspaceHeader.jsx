'use client';

import styles from './research.module.css';

export default function WorkspaceHeader() {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowDot} />
          AI Research · Session Live
        </div>
        <h1 className={styles.title}>
          AI Research <span className={styles.titleAccent}>Workspace</span>
        </h1>
        <p className={styles.subtitle}>
          Generate evidence-backed hypotheses from structured clinical datasets. Every claim is
          traceable to its source, validated across institutions, and privacy-preserving by construction.
        </p>
      </div>
      <div className={styles.complianceBadge}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6z" />
        </svg>
        Federated · aggregate only · audit-logged
      </div>
    </div>
  );
}

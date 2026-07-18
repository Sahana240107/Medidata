'use client';

import Link from 'next/link';
import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import { SAVED_HYPOTHESES } from '@/lib/researchMockData';

export default function SavedHypothesisPage() {
  return (
    <div className={styles.page}>
      <WorkspaceHeader />

      <div className={styles.panel}>
        <div className={styles.panelLabel} style={{ marginBottom: 4 }}>Saved Hypothesis</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Hypotheses you've saved from previous research sessions
        </div>

        <div>
          {SAVED_HYPOTHESES.map((h) => (
            <Link key={h.id} href={h.href} className={styles.listRow} style={{ textDecoration: 'none' }}>
              <span className={styles.listIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{h.statement}</div>
                <div className={styles.listSub}>
                  {h.status} · {h.supportingCases} supporting cases · {h.institutions} institutions
                </div>
              </div>
              <span className={styles.listMeta}>{h.savedAt}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

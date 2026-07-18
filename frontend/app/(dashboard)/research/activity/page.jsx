'use client';

import styles from '@/components/research/research.module.css';
import WorkspaceHeader from '@/components/research/WorkspaceHeader';
import { RECENT_ACTIVITY } from '@/lib/researchMockData';

const ICONS = {
  hypothesis: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  discovery: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="12" cy="18" r="3" /><path d="M8.6 7.4 10.6 16M15.4 7.4 13.4 16M8.6 6h6.8" />
    </svg>
  ),
  dataset: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    </svg>
  ),
  save: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  export: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
};

export default function RecentActivityPage() {
  return (
    <div className={styles.page}>
      <WorkspaceHeader />

      <div className={styles.panel}>
        <div className={styles.panelLabel} style={{ marginBottom: 4 }}>Recent Activity</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
          A timeline of what's happened in this workspace
        </div>

        <div>
          {RECENT_ACTIVITY.map((a) => (
            <div key={a.id} className={styles.listRow}>
              <span className={styles.listIcon}>{ICONS[a.type]}</span>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{a.text}</div>
              </div>
              <span className={styles.listMeta}>{a.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

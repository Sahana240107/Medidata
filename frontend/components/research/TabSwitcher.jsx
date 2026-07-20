'use client';

import Link from 'next/link';
import styles from './research.module.css';

export default function TabSwitcher({ active }) {
  return (
    <div className={styles.tabSwitcher}>
      <Link
        href="/research/hypothesis"
        className={`${styles.tabItem} ${active === 'hypothesis' ? styles.tabItemActive : ''}`}
      >
        Hypothesis
      </Link>
      <Link
        href="/research/discovery"
        className={`${styles.tabItem} ${active === 'discovery' ? styles.tabItemActive : ''}`}
      >
        more
      </Link>
    </div>
  );
}

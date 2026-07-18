'use client';

import styles from './research.module.css';

export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div className={styles.toast}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {message}
    </div>
  );
}

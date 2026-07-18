'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './research.module.css';

const NAV_ITEMS = [
  {
    href: '/research',
    label: 'Workspace',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/research/dataset',
    label: 'Dataset',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      </svg>
    ),
  },
  {
    href: '/research/discovery',
    label: 'Cross-dataset discovery',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="12" cy="18" r="3" />
        <path d="M8.6 7.4 10.6 16M15.4 7.4 13.4 16M8.6 6h6.8" />
      </svg>
    ),
  },
  {
    href: '/research/saved',
    label: 'Saved hypothesis',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/research/activity',
    label: 'Recent activity',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
      </svg>
    ),
  },
];

export default function QuickNavFab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {open && <div className={styles.fabBackdrop} onClick={() => setOpen(false)} />}

      <div className={styles.fabRoot}>
        {NAV_ITEMS.slice().reverse().map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`${styles.fabItem} ${open ? styles.fabItemOpen : ''} ${isActive ? styles.fabItemActive : ''}`}
            >
              <span className={styles.fabItemLabel}>{item.label}</span>
              <span className={styles.fabItemDot}>{item.icon}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`${styles.fabMain} ${open ? styles.fabMainOpen : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close quick navigation' : 'Open quick navigation'}
          aria-expanded={open}
        >
          <svg className={styles.fabMainIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" />
          </svg>
        </button>
      </div>
    </>
  );
}

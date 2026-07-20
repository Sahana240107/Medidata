'use client';

import QuickNavFab from '@/components/research/QuickNavFab';

export default function ResearchLayout({ children }) {
  return (
    <>
      {children}
      <QuickNavFab />
    </>
  );
}

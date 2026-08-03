'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import CaseCard from './CaseCard';
import CaseDetailPanel from './CaseDetailPanel';
import { ChevronIcon } from './icons';

const PAGE_SIZE = 4; // vertical list — 4 case rows per page
const HOVER_CLOSE_DELAY = 150; // ms grace period so moving mouse row -> modal doesn't flicker-close

export default function CaseGrid({ results, pinnedIds, focusedId, onAction, onPin }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  // Preview (hover) vs locked (clicked) case + which tab is active in the modal
  const [hoveredCase, setHoveredCase] = useState(null);
  const [lockedCase, setLockedCase] = useState(null);
  const [activeTab, setActiveTab] = useState('status');
  const closeTimer = useRef(null);

  useEffect(() => setPage(1), [results]);

  const pageResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [results, page]);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleHover = useCallback((result, tab) => {
    if (lockedCase) return; // locked modal takes priority, ignore row hovers
    clearCloseTimer();
    setHoveredCase(result);
    setActiveTab(tab);
  }, [lockedCase]);

  const handleLeave = useCallback(() => {
    if (lockedCase) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setHoveredCase(null), HOVER_CLOSE_DELAY);
  }, [lockedCase]);

  const handleLock = useCallback((result, tab) => {
    clearCloseTimer();
    setHoveredCase(null);
    setLockedCase(result);
    setActiveTab(tab);
  }, []);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    setLockedCase(null);
    setHoveredCase(null);
  }, []);

  // Keep the modal open while the cursor is over it (only matters for the hover-preview case)
  const handleModalMouseEnter = useCallback(() => clearCloseTimer(), []);
  const handleModalMouseLeave = useCallback(() => {
    if (lockedCase) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setHoveredCase(null), HOVER_CLOSE_DELAY);
  }, [lockedCase]);

  const activeCase = lockedCase || hoveredCase;
  const isLocked = !!lockedCase;
  const panelFocusedId = activeCase?.cluster_id ?? focusedId;

  if (!results.length) {
    return (
      <div style={{
        background: 'var(--white)', border: '1px solid var(--lavender-100)',
        borderRadius: 'var(--radius-md)', padding: 40, textAlign: 'center',
        color: 'var(--text-muted)', fontSize: 14,
      }}>
        No cases match the current filters. Try widening your selection.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pageResults.map((r) => (
          <CaseCard
            key={r.cluster_id}
            result={r}
            isPinned={pinnedIds.has(r.cluster_id)}
            isFocused={panelFocusedId === r.cluster_id}
            onHover={(tab) => handleHover(r, tab)}
            onLeave={handleLeave}
            onLock={(tab) => handleLock(r, tab)}
            onPin={() => onPin(r)}
          />
        ))}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}

      <CaseDetailPanel
        open={!!activeCase}
        activeCase={activeCase}
        activeTab={activeTab}
        isLocked={isLocked}
        onClose={handleClose}
        onTabChange={setActiveTab}
        onMouseEnter={handleModalMouseEnter}
        onMouseLeave={handleModalMouseLeave}
      />
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  const pages = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) arr.push(i);
      else if (arr[arr.length - 1] !== '…') arr.push('…');
    }
    return arr;
  }, [page, totalPages]);

  const btnStyle = (active) => ({
    minWidth: 32, height: 32, padding: '0 8px',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${active ? 'var(--lavender-600)' : 'var(--lavender-200)'}`,
    background: active ? 'var(--lavender-600)' : 'var(--white)',
    color: active ? 'white' : 'var(--text-secondary)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 }}>
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{ ...btnStyle(false), opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
      >
        <ChevronIcon size={13} direction="left" />
      </button>

      {pages.map((p, i) => p === '…' ? (
        <span key={`e${i}`} style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 2px' }}>…</span>
      ) : (
        <button key={p} onClick={() => onChange(p)} style={btnStyle(p === page)}>
          {p}
        </button>
      ))}

      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        style={{ ...btnStyle(false), opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
      >
        <ChevronIcon size={13} direction="right" />
      </button>
    </div>
  );
}
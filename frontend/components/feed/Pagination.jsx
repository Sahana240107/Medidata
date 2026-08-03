'use client';

/**
 * Pagination — "‹ 1 2 3 … 8 ›" style page nav.
 * Always shows first, last, current ±1, with an ellipsis when the range
 * doesn't cover everything, so it stays compact even with many pages.
 */
export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const items = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push('ellipsis-' + p);
    items.push(p);
    prev = p;
  }

  return (
    <div className="pagination">
      <button
        className="page-arrow"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {items.map((it) =>
        typeof it === 'number' ? (
          <button
            key={it}
            className={`page-num ${it === page ? 'page-num--active' : ''}`}
            onClick={() => onChange(it)}
          >
            {it}
          </button>
        ) : (
          <span key={it} className="page-ellipsis">···</span>
        )
      )}

      <button
        className="page-arrow"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <style jsx>{`
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 28px;
        }
        .page-arrow, .page-num {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 32px;
          padding: 0 6px;
          border-radius: 9px;
          border: 1.5px solid var(--lavender-100);
          background: var(--white);
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .page-arrow:hover:not(:disabled), .page-num:hover:not(.page-num--active) {
          border-color: var(--lavender-400);
          color: var(--lavender-700);
          background: var(--lavender-50);
        }
        .page-arrow:disabled {
          opacity: 0.35;
          cursor: default;
        }
        .page-num--active {
          background: var(--lavender-600);
          border-color: var(--lavender-600);
          color: white;
        }
        .page-ellipsis {
          color: var(--text-muted);
          font-size: 12px;
          padding: 0 2px;
        }
      `}</style>
    </div>
  );
}
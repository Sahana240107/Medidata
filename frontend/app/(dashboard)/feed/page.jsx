'use client';

import { useMemo, useState } from 'react';
import { useFeedPaged } from '@/lib/hooks/useFeed';
import { triggerScan } from '@/lib/api/feed';
import FeedRow from '@/components/feed/FeedRow';
import FeedFilterBar from '@/components/feed/FeedFilterBar';
import Pagination from '@/components/feed/Pagination';

const PAGE_SIZE = 6;

function SkeletonRow({ delay = 0 }) {
  return (
    <div className="skel-row" style={{ animationDelay: `${delay}s` }}>
      <div className="skel-circle" />
      <div style={{ flex: 1 }}>
        <div className="skel-block" style={{ height: 13, width: '45%', borderRadius: 4, marginBottom: 8 }} />
        <div className="skel-block" style={{ height: 10, width: '70%', borderRadius: 4 }} />
      </div>
      <style jsx>{`
        .skel-row {
          display: flex; align-items: center; gap: 16px; padding: 14px 20px;
          background: var(--white); border: 1px solid var(--lavender-100); border-radius: 14px;
          opacity: 0; animation: fadeIn 0.4s forwards;
        }
        @keyframes fadeIn { to { opacity: 1; } }
        .skel-circle { width: 54px; height: 54px; border-radius: 50%; flex-shrink: 0; background: var(--lavender-50); }
        .skel-block, .skel-circle {
          background: linear-gradient(90deg, var(--lavender-50) 25%, var(--lavender-100) 37%, var(--lavender-50) 63%);
          background-size: 400% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        @keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      `}</style>
    </div>
  );
}

function matchesSearch(signal, query) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    signal.title,
    signal.summary,
    ...(signal.tags || []),
    ...(signal.countries || []),
    ...(signal.participating_hospitals || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

export default function FeedPage() {
  const [signalType, setSignalType] = useState(null);
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  const { items, total, totalPages, page, goToPage, loading, error, refresh } = useFeedPaged({
    pageSize: PAGE_SIZE,
    signalType,
    sort,
  });

  const visibleItems = useMemo(
    () => items.filter((signal) => matchesSearch(signal, search)),
    [items, search]
  );
  const isSearching = search.trim().length > 0;

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = await triggerScan();
      setScanResult(result);
      refresh();
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="feed-header">
        <div>
          <div className="feed-title">Discovery Feed</div>
          <div className="feed-subtitle">
            AI-detected signals from the global case network
            {total > 0 && ` · ${total} active`}
          </div>
        </div>
        <button onClick={handleScan} disabled={scanning} className="scan-btn">
          {scanning ? (<><span className="spin" />Scanning cases…</>) : (<>🔬 Run Discovery Scan</>)}
        </button>
        <button onClick={refresh} className="refresh-btn">Refresh</button>
      </header>

      <div style={{ padding: '28px 32px' }}>
        {scanResult && (
          <div className="banner banner--ok">
            <span>✓ Scan complete</span>
            <span>{scanResult.cases_scanned} cases scanned</span>
            <span>{scanResult.clusters_found} clusters found</span>
            <span>{scanResult.signals_created} new signals</span>
            <span>{scanResult.signals_updated} signals updated</span>
          </div>
        )}
        {scanError && <div className="banner banner--err">Scan failed: {scanError}</div>}

        <FeedFilterBar
          signalType={signalType}
          onSignalTypeChange={setSignalType}
          sort={sort}
          onSortChange={setSort}
          search={search}
          onSearchChange={setSearch}
        />

        {error && <div className="banner banner--err">{error}</div>}

        {isSearching && !loading && (
          <div className="search-result-count">
            {visibleItems.length} result{visibleItems.length === 1 ? '' : 's'} for “{search}” on this page
          </div>
        )}

        {!error && !loading && visibleItems.length === 0 && (
          <div className="empty-state">
            {isSearching
              ? <>No signals on this page match “{search}”. Try another page, or clear the search.</>
              : <>No signals match this filter yet. Try a different category, or check back as more cases are submitted to the network.</>}
          </div>
        )}

        <div className="row-list" key={page}>
          {loading
            ? Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonRow key={`s-${i}`} delay={i * 0.05} />)
            : visibleItems.map((signal, i) => <FeedRow key={signal.id} signal={signal} index={i} />)
          }
        </div>

        {!loading && !isSearching && (
          <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
        )}
      </div>

      <style jsx>{`
        .feed-header {
          padding: 16px 32px; background: var(--white); border-bottom: 1px solid var(--lavender-100);
          display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 30;
          box-shadow: 0 1px 8px rgba(92,107,192,0.06);
        }
        .feed-title { font-size: 17px; font-weight: 700; color: var(--navy); font-family: 'Sora', sans-serif; }
        .feed-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 1px; }
        .scan-btn {
          margin-left: auto; padding: 8px 14px; background: var(--lavender-600); color: white; border: none;
          border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 6px; transition: background 0.15s, transform 0.15s;
        }
        .scan-btn:hover:not(:disabled) { background: var(--lavender-700); transform: translateY(-1px); }
        .scan-btn:disabled { background: var(--lavender-300); cursor: default; }
        .spin {
          width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white; border-radius: 50%; display: inline-block;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .refresh-btn {
          padding: 8px 14px; background: var(--lavender-50); color: var(--lavender-700);
          border: 1.5px solid var(--lavender-100); border-radius: 9px; font-size: 12.5px;
          font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .refresh-btn:hover { background: var(--lavender-100); }

        .banner {
          padding: 12px 18px; border-radius: 10px; font-size: 13px; margin-bottom: 20px;
          display: flex; gap: 16px; flex-wrap: wrap;
          animation: bannerIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes bannerIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .banner--ok { background: #e8f5e9; color: #2e7d32; }
        .banner--err { background: #fee2e2; color: #dc2626; }

        .search-result-count { font-size: 12.5px; color: var(--text-muted); margin: -8px 0 16px; font-weight: 500; }

        .empty-state {
          padding: 48px 24px; text-align: center; color: var(--text-muted);
          background: var(--lavender-50); border-radius: 16px; font-size: 13.5px;
          animation: bannerIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .row-list { display: flex; flex-direction: column; gap: 10px; }
      `}</style>
    </div>
  );
}
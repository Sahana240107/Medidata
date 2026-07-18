'use client';

import { useState } from 'react';
import { useFeed } from '@/lib/hooks/useFeed';
import { triggerScan } from '@/lib/api/feed';
import FeedCard from '@/components/feed/FeedCard';
import FeedFilterBar from '@/components/feed/FeedFilterBar';

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--lavender-100)',
      borderRadius: 16, height: 260, overflow: 'hidden',
    }}>
      <div style={{ height: 80, background: 'var(--lavender-50)' }} />
      <div style={{ padding: 18 }}>
        <div style={{ height: 14, width: '80%', background: 'var(--lavender-50)', borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 10, width: '100%', background: 'var(--lavender-50)', borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 10, width: '60%', background: 'var(--lavender-50)', borderRadius: 4 }} />
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [signalType, setSignalType] = useState(null);
  const [sort, setSort] = useState('recent');

  const { items, total, loading, error, hasMore, loadMore, refresh } = useFeed({
    limit: 12,
    signalType,
    sort,
  });

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);

  const runScan = async () => {
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
      <header style={{
        padding: '16px 32px', background: 'var(--white)', borderBottom: '1px solid var(--lavender-100)',
        display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 30,
        boxShadow: '0 1px 8px rgba(92,107,192,0.06)',
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Sora', sans-serif" }}>
            Discovery Feed
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>
            AI-detected signals from the global case network
            {total > 0 && ` · ${total} active`}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={refresh}
            style={{
              padding: '8px 14px', background: 'var(--lavender-50)',
              color: 'var(--lavender-700)', border: '1.5px solid var(--lavender-100)',
              borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            style={{
              padding: '8px 14px',
              background: scanning ? 'var(--lavender-300)' : 'var(--lavender-600)',
              color: 'white', border: 'none',
              borderRadius: 9, fontSize: 12.5, fontWeight: 600,
              cursor: scanning ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {scanning && (
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white',
                animation: 'spin 0.7s linear infinite',
              }} />
            )}
            {scanning ? 'Scanning cases…' : 'Run Discovery Scan'}
          </button>
        </div>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </header>

      <div style={{ padding: '28px 32px' }}>
        <FeedFilterBar
          signalType={signalType}
          onSignalTypeChange={setSignalType}
          sort={sort}
          onSortChange={setSort}
        />

        {scanResult && (
          <div style={{
            padding: '14px 18px', background: '#ecfdf5', color: '#047857',
            border: '1px solid #a7f3d0', borderRadius: 10, fontSize: 13, marginBottom: 20,
            display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <strong>Scan complete —</strong>
            <span>{scanResult.cases_scanned} cases scanned</span>
            <span>·</span>
            <span>{scanResult.clusters_found} clusters found</span>
            <span>·</span>
            <span>{scanResult.signals_created} signals created</span>
            <span>·</span>
            <span>{scanResult.signals_updated} updated</span>
            <button
              onClick={() => setScanResult(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}

        {scanError && (
          <div style={{
            padding: '14px 18px', background: '#fee2e2', color: '#dc2626',
            borderRadius: 10, fontSize: 13, marginBottom: 20,
          }}>
            Scan failed: {scanError}
          </div>
        )}

        {error && (
          <div style={{
            padding: '14px 18px', background: '#fee2e2', color: '#dc2626',
            borderRadius: 10, fontSize: 13, marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {!error && !loading && items.length === 0 && (
          <div style={{
            padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)',
            background: 'var(--lavender-50)', borderRadius: 16, fontSize: 13.5,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 6, fontSize: 14 }}>
              No signals yet
            </div>
            No active signals in the network yet. Signals appear once at least 3 similar
            cases from your case database cluster together. Click <strong>Run Discovery Scan</strong> above
            to scan current cases, or submit more cases first if you're just getting started.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {items.map((signal) => (
            <FeedCard key={signal.id} signal={signal} />
          ))}
          {loading && Array.from({ length: items.length ? 4 : 8 }).map((_, i) => <SkeletonCard key={`s-${i}`} />)}
        </div>

        {!loading && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <button
              onClick={loadMore}
              style={{
                padding: '10px 24px', background: 'var(--lavender-600)', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
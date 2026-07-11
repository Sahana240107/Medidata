'use client';

import { useState, useCallback, useMemo } from 'react';
import SearchBar from '@/components/search/SearchBar';
import FilterPanel from '@/components/search/FilterPanel';
import DiseaseSummaryCard from '@/components/search/DiseaseSummaryCard';
import CaseDetailPanel from '@/components/search/CaseDetailPanel';
import RightPanel from '@/components/search/RightPanel';
import CaseGrid from '@/components/search/CaseGrid';
import { searchCases } from '@/lib/api/search';
import { enrichResult, getDiseaseSummary } from '@/lib/utils/searchMockData';

const EMPTY_FILTERS = { regions: [], specialties: [], outcomes: [], confidence_tiers: [] };

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Left: collapsible filter drawer (hidden by default)
  const [filterOpen, setFilterOpen] = useState(false);

  // Left: docked case-detail panel (timeline / symptom / lab / procedure)
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');

  // Right: docked panel, mutually exclusive between 'stats' | 'pinned' | null
  const [rightMode, setRightMode] = useState(null);

  // Pinned cases persist across searches, keyed by cluster_id
  const [pinnedMap, setPinnedMap] = useState({});

  const runSearch = useCallback(async (q, activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchCases({
        query: q,
        regions: activeFilters.regions,
        specialties: activeFilters.specialties,
        outcomes: activeFilters.outcomes,
        confidenceTiers: activeFilters.confidence_tiers,
      });
      setData(result);
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (q) => {
    setQuery(q);
    setFilters(EMPTY_FILTERS);
    setDetailOpen(false);
    setActiveCaseId(null);
    runSearch(q, EMPTY_FILTERS);
  };

  const handleFilterChange = (key, values) => {
    const next = { ...filters, [key]: values };
    setFilters(next);
    if (query) runSearch(query, next);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    if (query) runSearch(query, EMPTY_FILTERS);
  };

  const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

  // Enrich raw API results with disease name + symptom/lab/procedure detail
  const enrichedResults = useMemo(() => {
    if (!data?.results) return [];
    return data.results.map((r) => enrichResult(r, query));
  }, [data, query]);

  const diseaseSummary = useMemo(() => {
    if (!data) return null;
    return getDiseaseSummary(query, data.shared_signature, data.total_cases_found, data.countries_count);
  }, [data, query]);

  const activeCase = useMemo(
    () => enrichedResults.find((r) => r.cluster_id === activeCaseId) || null,
    [enrichedResults, activeCaseId]
  );

  const pinnedIds = useMemo(() => new Set(Object.keys(pinnedMap)), [pinnedMap]);
  const pinnedResults = useMemo(() => Object.values(pinnedMap), [pinnedMap]);

  const handleCaseAction = (result, tab) => {
    setActiveCaseId(result.cluster_id);
    setActiveTab(tab);
    setDetailOpen(true);
  };

  const handlePin = (result) => {
    setPinnedMap((prev) => {
      const next = { ...prev };
      if (next[result.cluster_id]) delete next[result.cluster_id];
      else next[result.cluster_id] = result;
      return next;
    });
  };

  const handleUnpin = (clusterId) => {
    setPinnedMap((prev) => {
      const next = { ...prev };
      delete next[clusterId];
      return next;
    });
  };

  const toggleStats = () => setRightMode((m) => (m === 'stats' ? null : 'stats'));
  const togglePinned = () => setRightMode((m) => (m === 'pinned' ? null : 'pinned'));

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1520, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: 'var(--navy)',
          fontFamily: "'Sora', sans-serif", marginBottom: 6,
        }}>
          Global Case Search
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>
          Submit anonymized clinical signals to find matching cases worldwide
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          loading={loading}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {error && (
        <div style={{
          background: '#fdeaea', color: '#c62828', borderRadius: 'var(--radius-sm)',
          padding: '12px 16px', fontSize: 13.5, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
          Searching the global case network…
        </div>
      )}

      {!loading && !data && !error && (
        <div style={{
          color: 'var(--text-muted)', fontSize: 14, padding: '60px 0',
          textAlign: 'center', border: '1px dashed var(--lavender-200)',
          borderRadius: 'var(--radius-md)',
        }}>
          Search for symptoms, lab findings, or a clinical case description to find matching cases across the network.
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <FilterPanel
            open={filterOpen}
            facets={data.facets}
            filters={filters}
            onToggle={(key, v) => {
              const current = filters[key] || [];
              const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
              handleFilterChange(key, next);
            }}
            onClear={handleClearFilters}
          />

          <CaseDetailPanel
            open={detailOpen}
            activeCase={activeCase}
            activeTab={activeTab}
            onClose={() => setDetailOpen(false)}
            onTabChange={setActiveTab}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
              <div style={{ fontSize: 15, color: 'var(--navy)' }}>
                <span style={{ fontWeight: 700 }}>
                  {data.total_cases_found} similar case{data.total_cases_found === 1 ? '' : 's'} found
                </span>
                {data.countries_count > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}across {data.countries_count} countr{data.countries_count === 1 ? 'y' : 'ies'}
                  </span>
                )}
              </div>
            </div>

            {diseaseSummary && (
              <DiseaseSummaryCard
                query={query}
                summary={diseaseSummary.summary}
                fact={diseaseSummary.fact}
                keywords={diseaseSummary.keywords}
                onOpenStats={toggleStats}
                statsActive={rightMode === 'stats'}
                onOpenPinned={togglePinned}
                pinnedActive={rightMode === 'pinned'}
                pinnedCount={pinnedResults.length}
              />
            )}

            <CaseGrid
              results={enrichedResults}
              pinnedIds={pinnedIds}
              focusedId={activeCaseId}
              onAction={handleCaseAction}
              onPin={handlePin}
            />
          </div>

          <RightPanel
            mode={rightMode}
            onClose={() => setRightMode(null)}
            outcomeIntelligence={data.outcome_intelligence}
            pinnedResults={pinnedResults}
            onUnpin={handleUnpin}
            onFocusCase={(r) => handleCaseAction(r, 'timeline')}
          />
        </div>
      )}
    </div>
  );
}

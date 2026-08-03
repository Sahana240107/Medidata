'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from './research.module.css';
import { getDiseaseCatalog, getDatasetSummary, downloadDataset, reloadSchemaCache } from '@/lib/api/dataset';

const GROUP_MODES = [
  { key: 'domain', label: 'By Domain' },
  { key: 'disease', label: 'By Disease' },
  { key: 'location', label: 'By Location' },
];

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupList(catalog, mode) {
  if (!catalog) return [];
  if (mode === 'domain') return catalog.domains.map((d) => ({ key: d.domain, title: d.domain, sub: `${d.case_count.toLocaleString()} cases · ${d.institution_count} institutions`, meta: `${d.disease_count} disease types` }));
  if (mode === 'location') return catalog.locations.map((l) => ({ key: l.country, title: l.country, sub: `${l.case_count.toLocaleString()} cases · ${l.institution_count} institutions`, meta: `${l.disease_count} disease types` }));
  return catalog.diseases.map((d) => ({ key: d.disease, title: d.disease, sub: `${d.case_count.toLocaleString()} cases · ${d.institution_count} institutions`, meta: d.domain }));
}

export default function DatasetDownloadPanel() {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(null);

  const [groupBy, setGroupBy] = useState('domain');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [search, setSearch] = useState('');

  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  const [reloading, setReloading] = useState(false);
  const [reloadMessage, setReloadMessage] = useState(null);

  const loadCatalog = () => {
    setCatalogError(null);
    return getDiseaseCatalog()
      .then((data) => { setCatalog(data); setSummary(data.summary); })
      .catch((e) => setCatalogError(e.message));
  };

  useEffect(() => { loadCatalog(); }, []);

  const filters = useMemo(() => ({
    disease: groupBy === 'disease' ? selectedGroup || undefined : undefined,
    domain: groupBy === 'domain' ? selectedGroup || undefined : undefined,
    location: groupBy === 'location' ? selectedGroup || undefined : undefined,
    gender: gender || undefined,
    ageRange: ageRange || undefined,
  }), [groupBy, selectedGroup, gender, ageRange]);

  const hasFilters = !!(filters.disease || filters.domain || filters.location || filters.gender || filters.ageRange);
  const debouncedKey = useDebounced(JSON.stringify(filters));

  useEffect(() => {
    if (!catalog) return;
    if (!hasFilters) { setSummary(catalog.summary); return; }
    setSummaryLoading(true);
    getDatasetSummary(JSON.parse(debouncedKey))
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey, catalog]);

  const changeGroupMode = (mode) => { setGroupBy(mode); setSelectedGroup(''); setSearch(''); };

  const clearAll = () => { setSelectedGroup(''); setGender(''); setAgeRange(''); setSearch(''); };

  const handleDownload = async (format) => {
    setDownloading(format);
    setDownloadError(null);
    try {
      await downloadDataset({ ...filters, format });
    } catch (e) {
      setDownloadError(e.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    setReloadMessage(null);
    try {
      await reloadSchemaCache();
      await loadCatalog();
      setReloadMessage({ type: 'ok', text: 'Schema cache reloaded and data refreshed.' });
    } catch (e) {
      setReloadMessage({ type: 'error', text: e.message });
    } finally {
      setReloading(false);
      setTimeout(() => setReloadMessage(null), 5000);
    }
  };

  const selectStyle = {
    width: '100%', padding: '10px 12px', border: '1.5px solid var(--lavender-100)',
    borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13.5,
    color: 'var(--navy)', background: 'var(--white)', outline: 'none',
    textTransform: 'capitalize',
  };

  const chipStyle = (active) => ({
    padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: active ? '1.5px solid var(--lavender-600)' : '1.5px solid var(--lavender-100)',
    background: active ? 'var(--lavender-600)' : 'var(--white)',
    color: active ? 'white' : 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
  });

  const groupsRaw = groupList(catalog, groupBy);
  const groups = search.trim()
    ? groupsRaw.filter((g) => g.title.toLowerCase().includes(search.trim().toLowerCase()))
    : groupsRaw;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Build &amp; Download a Dataset</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            Group your real case data by domain, disease, or location, filter by gender/age, then export.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasFilters && <button className={styles.linkBtn} onClick={clearAll}>Clear filters</button>}
          <button
            onClick={handleReload}
            disabled={reloading}
            title="Reload PostgREST's schema cache and refresh this page's data"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              border: '1.5px solid var(--lavender-100)', background: 'var(--lavender-50)',
              color: 'var(--lavender-700)', cursor: reloading ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.6s', transform: reloading ? 'rotate(360deg)' : 'none' }}>↻</span>
            {reloading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {reloadMessage && (
        <div style={{
          fontSize: 12, marginBottom: 12, padding: '8px 12px', borderRadius: 8,
          background: reloadMessage.type === 'ok' ? '#ecfdf5' : '#fee2e2',
          color: reloadMessage.type === 'ok' ? '#047857' : '#c62828',
        }}>
          {reloadMessage.text}
        </div>
      )}

      {catalogError && (
        <div style={{ fontSize: 13, color: '#c62828', padding: '12px 0' }}>
          Couldn't load dataset info: {catalogError}
        </div>
      )}

      {!catalog && !catalogError && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>Loading your case data…</div>
      )}

      {catalog && (
        <>
          {/* Group-by switcher */}
          <div className={styles.tabSwitcher}>
            {GROUP_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => changeGroupMode(m.key)}
                className={`${styles.tabItem} ${groupBy === m.key ? styles.tabItemActive : ''}`}
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Search within the active grouping mode */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${groupBy === 'domain' ? 'domains' : groupBy === 'disease' ? 'diseases' : 'locations'}…`}
              style={{
                width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid var(--lavender-100)',
                borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13.5,
                color: 'var(--navy)', outline: 'none',
              }}
            />
          </div>

          {/* Selectable group cards */}
          <div
            className={styles.datasetGrid}
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', maxHeight: 360, overflowY: 'auto', paddingRight: 4, marginBottom: 20 }}
          >
            {groups.map((g) => {
              const isSelected = selectedGroup === g.key;
              return (
                <div
                  key={g.key}
                  onClick={() => setSelectedGroup(isSelected ? '' : g.key)}
                  className={styles.datasetCard}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'var(--lavender-100)' : 'var(--lavender-50)',
                    border: isSelected ? '1.5px solid var(--lavender-500)' : '1px solid var(--lavender-100)',
                    transition: 'all 0.15s',
                  }}
                >
                  {isSelected && <span className={styles.datasetDot} />}
                  <div className={styles.datasetName}>{g.title}</div>
                  <div className={styles.datasetMeta}>{g.sub}</div>
                  <div className={styles.datasetMeta} style={{ opacity: 0.7 }}>{g.meta}</div>
                </div>
              );
            })}
            {groups.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {search ? `No matches for "${search}".` : 'No groups found for this mode.'}
              </div>
            )}
          </div>

          {/* Gender chips + age select */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div>
              <div className={styles.templatesLabel}>Gender</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={chipStyle(gender === '')} onClick={() => setGender('')}>All</button>
                {catalog.genders.map((g) => (
                  <button key={g} style={chipStyle(gender === g)} onClick={() => setGender(gender === g ? '' : g)}>
                    {capitalize(g)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={styles.templatesLabel}>Age range</div>
              <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} style={selectStyle}>
                <option value="">All ages</option>
                {catalog.age_ranges.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Live summary */}
          <div className={styles.summaryRow} style={{ opacity: summaryLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Total cases</div>
              <div className={styles.summaryValue}>{summary ? summary.total_cases.toLocaleString() : '···'}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Institutions</div>
              <div className={styles.summaryValue}>{summary ? summary.institutions : '···'}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Countries</div>
              <div className={styles.summaryValue}>{summary ? summary.countries : '···'}</div>
            </div>
            <div className={styles.summaryItem}>
              <div className={styles.summaryLabel}>Date range</div>
              <div className={styles.summaryValue} style={{ fontSize: 15 }}>{summary?.date_range || '—'}</div>
            </div>
          </div>

          {summary && summary.total_cases === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              No cases match this combination of filters.
            </div>
          )}

          {downloadError && (
            <div style={{ fontSize: 12.5, color: '#c62828', marginBottom: 12 }}>{downloadError}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className={styles.btnSecondary}
              disabled={!!downloading || (summary && summary.total_cases === 0)}
              onClick={() => handleDownload('csv')}
              style={{ flex: 1 }}
            >
              {downloading === 'csv' ? 'Preparing CSV…' : 'Download CSV'}
            </button>
            <button
              className={styles.btnFullChange}
              disabled={!!downloading || (summary && summary.total_cases === 0)}
              onClick={() => handleDownload('xlsx')}
              style={{ flex: 1, opacity: downloading === 'xlsx' ? 0.7 : 1 }}
            >
              {downloading === 'xlsx' ? 'Preparing Excel…' : 'Download Excel'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
'use client';

import SimilarCaseCard from './SimilarCaseCard';
import OutcomeSummary from './OutcomeSummary';

function FilterGroup({ title, options, selected, onToggle }) {
  if (!options.length) return null;
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--lavender-100)',
      borderRadius: 'var(--radius-md)',
      padding: 18,
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        {title}
      </div>
      {options.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 0', cursor: 'pointer', fontSize: 13.5,
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(opt.value)}
              style={{ accentColor: 'var(--lavender-600)', width: 15, height: 15 }}
            />
            <span style={{ flex: 1 }}>{opt.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.count}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function SearchResultsList({ data, filters, onFilterChange }) {
  if (!data) return null;

  const {
    total_cases_found, countries_count, results, shared_signature,
    outcome_intelligence, facets,
  } = data;

  const toggle = (key, value) => {
    const current = filters[key] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFilterChange(key, next);
  };

  const hasSignature = shared_signature && (
    shared_signature.symptoms.length || shared_signature.lab_findings.length || shared_signature.treatment_outcomes.length
  );

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* ── Filter sidebar ── */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <FilterGroup
          title="Match Confidence"
          options={facets.confidence.map((f) => ({ value: f.value, label: f.label, count: f.count }))}
          selected={filters.confidence_tiers}
          onToggle={(v) => toggle('confidence_tiers', v)}
        />
        <FilterGroup
          title="Region"
          options={facets.region.map((f) => ({ value: f.value, label: f.label, count: f.count }))}
          selected={filters.regions}
          onToggle={(v) => toggle('regions', v)}
        />
        <FilterGroup
          title="Specialty"
          options={facets.specialty.map((f) => ({ value: f.value, label: f.label, count: f.count }))}
          selected={filters.specialties}
          onToggle={(v) => toggle('specialties', v)}
        />
        <FilterGroup
          title="Outcome"
          options={facets.outcome.map((f) => ({ value: f.value, label: f.label, count: f.count }))}
          selected={filters.outcomes}
          onToggle={(v) => toggle('outcomes', v)}
        />
      </div>

      {/* ── Results ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div style={{ fontSize: 15, color: 'var(--navy)' }}>
            <span style={{ fontWeight: 700 }}>{total_cases_found} similar case{total_cases_found === 1 ? '' : 's'} found</span>
            {countries_count > 0 && (
              <span style={{ color: 'var(--text-muted)' }}> across {countries_count} countr{countries_count === 1 ? 'y' : 'ies'}</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Sort by:
            <select
              defaultValue="match_score"
              style={{
                border: '1px solid var(--lavender-200)', borderRadius: 8,
                padding: '6px 10px', fontSize: 13, color: 'var(--text-secondary)',
                background: 'var(--white)',
              }}
            >
              <option value="match_score">Match Score</option>
            </select>
          </div>
        </div>

        {hasSignature && (
          <div style={{
            background: 'var(--lavender-50)',
            border: '1px solid var(--lavender-200)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
            marginBottom: 20,
          }}>
            <div style={{
              fontSize: 12.5, fontWeight: 700, color: 'var(--lavender-700)',
              letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 14,
            }}>
              Shared Clinical Signature Across All Matches
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <SignatureColumn title="Symptoms" items={shared_signature.symptoms} />
              <SignatureColumn title="Lab Findings" items={shared_signature.lab_findings} />
              <SignatureColumn title="Treatment Outcomes" items={shared_signature.treatment_outcomes} />
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <div style={{
            background: 'var(--white)', border: '1px solid var(--lavender-100)',
            borderRadius: 'var(--radius-md)', padding: 40, textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            No cases match the current filters. Try widening your selection.
          </div>
        ) : (
          results.map((r) => <SimilarCaseCard key={r.cluster_id + r.representative_case_id} result={r} />)
        )}

        <OutcomeSummary outcomeIntelligence={outcome_intelligence} />
      </div>
    </div>
  );
}

function SignatureColumn({ title, items }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item) => (
          <span key={item} style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 12.5,
            background: 'var(--white)', color: 'var(--lavender-700)',
            border: '1px solid var(--lavender-200)', whiteSpace: 'nowrap',
          }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
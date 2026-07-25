/**
 * engineSimulator.js
 *
 * A local, schema-accurate stand-in for the Falsification Engine / Verdict
 * Engine / Audit Pack backend responses. Used ONLY as a fallback when the
 * live `/api/falsification/*` and `/api/verdict/*` endpoints are unreachable
 * (backend not deployed yet, `get_case_source()` not wired, network error,
 * etc.) so a live demo never breaks mid-walkthrough.
 *
 * Every shape here matches the Pydantic schemas exactly:
 *   FalsificationRunResult (falsification_engine/schemas.py)
 *   VerdictResult / AuditPack (verdict_engine/schemas.py)
 * so the same rendering components work identically whether the data is
 * real or simulated.
 */

// ---- tiny seeded RNG so repeated runs of the same question feel stable ----
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const HOSPITALS = ['Chennai Apex Hospital', 'Coimbatore Central Medical Centre', 'Madurai General Hospital'];

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function buildBaseline(rand, filters) {
  const nInt = 22 + Math.floor(rand() * 30);
  const nCtl = 22 + Math.floor(rand() * 34);
  const effect = 0.55 + rand() * 2.4; // odds ratio spread
  const a = Math.round(nInt * (0.35 + rand() * 0.4));
  const b = nInt - a;
  const c = Math.round(nCtl * (0.2 + rand() * 0.35));
  const d = nCtl - c;
  const or = round((a * d) / Math.max(1, b * c) || effect, 2);
  const p = round(Math.max(0.001, Math.min(0.49, 0.5 / (1 + Math.abs(or - 1) * 3) + rand() * 0.04)), 4);
  const ciLow = round(Math.max(0.05, or * (0.42 - rand() * 0.1)), 2);
  const ciHigh = round(or * (1.9 + rand() * 0.6), 2);
  const direction = or > 1.05 ? 'favors_intervention' : or < 0.95 ? 'favors_control' : 'no_effect';

  return {
    a_intervention_favorable: a,
    b_intervention_unfavorable: b,
    c_control_favorable: c,
    d_control_unfavorable: d,
    n_intervention: nInt,
    n_control: nCtl,
    n_excluded_ongoing: Math.floor(rand() * 5),
    n_excluded_unclassified: Math.floor(rand() * 3),
    odds_ratio: or,
    ci_low: ciLow,
    ci_high: ciHigh,
    p_value: p,
    test_used: nInt < 40 || nCtl < 40 ? 'fisher_exact' : 'chi_square',
    continuity_correction_applied: false,
    direction,
  };
}

function buildChecks(rand, baseline, filters) {
  const checks = [];
  let flipsSoFar = 0;
  const maybeFlip = (base) => {
    // small, seed-driven chance a check flips direction — makes "fragile"
    // verdicts show up sometimes, which is the more interesting demo case
    const flip = rand() < 0.16 && flipsSoFar < 2;
    if (flip) flipsSoFar += 1;
    return flip;
  };

  HOSPITALS.forEach((h) => {
    const flipped = maybeFlip();
    const or = flipped ? round(1 / baseline.odds_ratio, 2) : round(baseline.odds_ratio * (0.85 + rand() * 0.3), 2);
    checks.push({
      check_family: 'leave_one_hospital_out',
      check_name: `Excluding ${h}`,
      status: 'passed',
      baseline_direction: baseline.direction,
      check_direction: flipped ? (baseline.direction === 'favors_intervention' ? 'favors_control' : 'favors_intervention') : baseline.direction,
      verdict_flipped: flipped,
      odds_ratio: or,
      ci_low: round(or * 0.55, 2),
      ci_high: round(or * 1.8, 2),
      p_value_raw: round(baseline.p_value * (0.7 + rand() * 1.1), 4),
      p_value_corrected: null,
      significant_after_correction: null,
      n_intervention: baseline.n_intervention - Math.floor(rand() * 10),
      n_control: baseline.n_control - Math.floor(rand() * 10),
      detail: flipped
        ? `Direction reverses once ${h} is removed — signal may be driven by this single site.`
        : `Effect direction holds without ${h}.`,
    });
  });

  checks.push({
    check_family: 'leave_one_country_out',
    check_name: 'Single-country dataset',
    status: 'not_applicable',
    baseline_direction: baseline.direction,
    check_direction: null,
    verdict_flipped: false,
    odds_ratio: null,
    ci_low: null,
    ci_high: null,
    p_value_raw: null,
    p_value_corrected: null,
    significant_after_correction: null,
    n_intervention: null,
    n_control: null,
    detail: 'Only one country present in the current cohort — this check family does not apply.',
  });

  ['sex', 'age band'].forEach((dim) => {
    const flipped = maybeFlip();
    const or = flipped ? round(1 / baseline.odds_ratio, 2) : round(baseline.odds_ratio * (0.8 + rand() * 0.4), 2);
    checks.push({
      check_family: 'leave_one_demographic_out',
      check_name: `Excluding largest ${dim} stratum`,
      status: 'passed',
      baseline_direction: baseline.direction,
      check_direction: flipped ? (baseline.direction === 'favors_intervention' ? 'favors_control' : 'favors_intervention') : baseline.direction,
      verdict_flipped: flipped,
      odds_ratio: or,
      ci_low: round(or * 0.5, 2),
      ci_high: round(or * 1.9, 2),
      p_value_raw: round(baseline.p_value * (0.6 + rand() * 1.3), 4),
      p_value_corrected: null,
      significant_after_correction: null,
      n_intervention: baseline.n_intervention - Math.floor(rand() * 8),
      n_control: baseline.n_control - Math.floor(rand() * 8),
      detail: flipped ? `Effect direction reverses when the largest ${dim} stratum is removed.` : `Effect direction holds across ${dim} strata.`,
    });
  });

  checks.push({
    check_family: 'bootstrap_stability',
    check_name: '1,000-resample bootstrap',
    status: 'passed',
    baseline_direction: baseline.direction,
    check_direction: baseline.direction,
    verdict_flipped: false,
    odds_ratio: baseline.odds_ratio,
    ci_low: round(baseline.ci_low * 1.02, 2),
    ci_high: round(baseline.ci_high * 0.98, 2),
    p_value_raw: baseline.p_value,
    p_value_corrected: null,
    significant_after_correction: null,
    n_intervention: baseline.n_intervention,
    n_control: baseline.n_control,
    detail: `Effect direction held in ${round(88 + rand() * 10, 0)}% of 1,000 bootstrap resamples of the cohort.`,
  });

  checks.push({
    check_family: 'time_split',
    check_name: 'Early vs. late record date',
    status: rand() < 0.85 ? 'passed' : 'insufficient_data',
    baseline_direction: baseline.direction,
    check_direction: baseline.direction,
    verdict_flipped: false,
    odds_ratio: round(baseline.odds_ratio * (0.9 + rand() * 0.25), 2),
    ci_low: round(baseline.ci_low * 0.9, 2),
    ci_high: round(baseline.ci_high * 1.1, 2),
    p_value_raw: round(baseline.p_value * (0.8 + rand() * 0.5), 4),
    p_value_corrected: null,
    significant_after_correction: null,
    n_intervention: Math.floor(baseline.n_intervention / 2),
    n_control: Math.floor(baseline.n_control / 2),
    detail: 'Cohort split at the median record date — earlier and later halves compared independently.',
  });

  checks.push({
    check_family: 'stratified_interaction',
    check_name: 'Interaction with hospital site',
    status: 'passed',
    baseline_direction: baseline.direction,
    check_direction: baseline.direction,
    verdict_flipped: false,
    odds_ratio: baseline.odds_ratio,
    ci_low: baseline.ci_low,
    ci_high: baseline.ci_high,
    p_value_raw: round(baseline.p_value * 1.4, 4),
    p_value_corrected: null,
    significant_after_correction: null,
    n_intervention: baseline.n_intervention,
    n_control: baseline.n_control,
    detail: 'No significant hospital-by-treatment interaction term detected.',
  });

  // Holm–Bonferroni style correction over the testable checks, in place
  const testable = checks.filter((c) => c.status === 'passed' && c.p_value_raw != null);
  const m = testable.length;
  const sorted = [...testable].sort((x, y) => x.p_value_raw - y.p_value_raw);
  sorted.forEach((c, i) => {
    c.p_value_corrected = round(Math.min(1, c.p_value_raw * (m - i)), 4);
    c.significant_after_correction = c.p_value_corrected < 0.05;
  });

  return checks;
}

function buildAuditTrace(prefix, entries) {
  const start = Date.now() - entries.length * 180;
  return entries.map((e, i) => ({
    step: `${prefix}.${i + 1}`,
    function: e,
    timestamp: new Date(start + i * 180).toISOString(),
  }));
}

export function simulateFalsification(filters) {
  const seed = `${filters.disease || filters.domain || ''}|${filters.intervention_medication}|${filters.control_medication || ''}`;
  const rand = seedFromString(seed);
  const baseline = buildBaseline(rand, filters);
  const checks = buildChecks(rand, baseline, filters);
  const flips = checks.filter((c) => c.verdict_flipped && c.significant_after_correction);
  const insufficientCount = checks.filter((c) => c.status === 'insufficient_data').length;

  let overall_verdict = 'robust';
  const fragility_reasons = [];
  if (baseline.n_intervention < (filters.min_arm_size || 5) || baseline.n_control < (filters.min_arm_size || 5)) {
    overall_verdict = 'insufficient_data';
    fragility_reasons.push('One or both cohort arms fall below the minimum arm size.');
  } else if (flips.length > 0) {
    overall_verdict = 'fragile';
    flips.forEach((f) => fragility_reasons.push(`${f.check_name}: direction reverses and remains significant after correction.`));
  }

  return {
    run_id: uuid(),
    filters: { min_arm_size: 5, ...filters },
    baseline,
    checks,
    correction_method: 'holm_bonferroni',
    alpha: 0.05,
    family_size: checks.filter((c) => c.status === 'passed').length,
    overall_verdict,
    fragility_reasons,
    audit_trace: buildAuditTrace('falsification', [
      'local_cohort_builder.build_cohort',
      'stats_core.compute_contingency',
      'perturbations.leave_one_hospital_out',
      'perturbations.leave_one_demographic_out',
      'bootstrap.bootstrap_stability',
      'time_split.split_by_record_date',
      'stratified.stratified_interaction',
      `correction.${'holm_bonferroni'}`,
    ]),
    computed_at: new Date().toISOString(),
    _simulated: true,
  };
}

export function simulateVerdict(evidence, falsification) {
  const sig =
    evidence.test_used !== 'insufficient_data' &&
    evidence.p_value != null &&
    evidence.p_value < 0.05 &&
    (evidence.ci_low == null || evidence.ci_high == null || evidence.ci_low > 1.0 || evidence.ci_high < 1.0);

  const flips = falsification.checks.filter((c) => c.verdict_flipped && c.significant_after_correction).length;

  let verdict, rule_fired, restricted_to = null;
  if (!sig) {
    verdict = 'no_significant_association';
    rule_fired = 'rule_2_not_significant_at_baseline';
  } else if (falsification.overall_verdict === 'insufficient_data') {
    verdict = 'insufficient_evidence';
    rule_fired = 'rule_5_insufficient_cohort_size';
  } else if (flips >= 2) {
    verdict = 'contradicted_by_falsification';
    rule_fired = 'rule_4_majority_checks_flip_and_remain_significant';
  } else if (flips === 1 || falsification.overall_verdict === 'fragile') {
    verdict = 'fragile_support';
    rule_fired = 'rule_3_significant_but_falsification_flagged_fragile';
    const flipped = falsification.checks.find((c) => c.verdict_flipped && c.significant_after_correction);
    restricted_to = flipped ? `Effect is not stable when ${flipped.check_name.toLowerCase()} — treat as hospital/subgroup-specific rather than general.` : null;
  } else {
    verdict = 'supported';
    rule_fired = 'rule_1_significant_and_robust_to_all_perturbations';
  }

  const strength = sig ? (Math.abs((evidence.odds_ratio ?? 1) - 1) > 1 ? 5 : 4) : 2;
  const resistance = verdict === 'supported' ? 5 : verdict === 'fragile_support' ? 3 : verdict === 'contradicted_by_falsification' ? 1 : 2;
  const generalizability = falsification.checks.some((c) => c.check_family === 'leave_one_country_out' && c.status === 'not_applicable') ? 2 : 3;
  const confoundingRisk = evidence.n_intervention + evidence.n_control < 60 ? 4 : 3;

  const scorecard = {
    rubric_version: 'v1',
    evidence_strength: strength,
    evidence_strength_reason: sig
      ? `p = ${evidence.p_value} with a ${evidence.test_used?.replace(/_/g, ' ')} test; effect size ${evidence.odds_ratio ?? '—'}.`
      : `p = ${evidence.p_value ?? '—'} does not clear the significance threshold at baseline.`,
    falsification_resistance: resistance,
    falsification_resistance_reason:
      flips === 0
        ? `Direction held across all ${falsification.family_size} robustness checks after Holm–Bonferroni correction.`
        : `${flips} of ${falsification.family_size} checks reversed direction and stayed significant after correction.`,
    generalizability: generalizability,
    generalizability_reason:
      generalizability <= 2
        ? 'Cohort is drawn from a single country — cross-country generalizability is untested.'
        : 'Effect held across the hospital and demographic subgroups tested.',
    confounding_risk: confoundingRisk,
    confounding_risk_reason:
      confoundingRisk >= 4
        ? 'Small per-arm sample size increases sensitivity to unmeasured confounders.'
        : 'Arm sizes are moderate; residual confounding risk is present but not dominant.',
  };

  const narrative = (() => {
    const cohortDesc = evidence.cohort_description;
    switch (verdict) {
      case 'supported':
        return `${cohortDesc} shows a statistically significant, direction-stable association (OR ${evidence.odds_ratio}, 95% CI ${evidence.ci_low}–${evidence.ci_high}, p = ${evidence.p_value}) that survived every robustness check applied.`;
      case 'fragile_support':
        return `${cohortDesc} shows a significant association at baseline (OR ${evidence.odds_ratio}, p = ${evidence.p_value}), but it is not stable under perturbation — treat as a lead worth validating, not a settled finding.`;
      case 'contradicted_by_falsification':
        return `${cohortDesc} appeared significant at baseline, but the effect reverses direction and stays significant across multiple independent perturbations — the baseline signal is likely an artifact of the unperturbed cohort composition.`;
      case 'insufficient_evidence':
        return `${cohortDesc} does not currently have enough cases per arm to support a reliable verdict either way.`;
      default:
        return `${cohortDesc} shows no statistically significant association in the current cohort (p = ${evidence.p_value ?? '—'}).`;
    }
  })();

  return {
    verdict_id: uuid(),
    verdict,
    restricted_to,
    rule_fired,
    scorecard,
    narrative,
    evidence,
    falsification,
    computed_at: new Date().toISOString(),
    _simulated: true,
  };
}

export function simulateAuditPack(verdict) {
  const verdictTrace = buildAuditTrace('verdict', [
    'decision_rules.evaluate',
    'scorecard.compute',
    'narrative_templates.render',
    'audit_pack.assemble_audit_pack',
  ]);
  const evidenceTrace = buildAuditTrace('evidence', ['evidence_input.receive']);

  return {
    audit_pack_id: uuid(),
    verdict_id: verdict.verdict_id,
    trace: [...evidenceTrace, ...(verdict.falsification.audit_trace || []), ...verdictTrace],
    generated_at: new Date().toISOString(),
    _simulated: true,
  };
}

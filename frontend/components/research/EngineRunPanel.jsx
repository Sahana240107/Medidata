'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './research.module.css';
import { runFalsification } from '@/lib/api/falsification';
import { computeVerdict, getAuditPack, downloadAuditPackUrl } from '@/lib/api/verdict';
import { simulateFalsification, simulateVerdict, simulateAuditPack } from '@/lib/engineSimulator';
import { useUploadedDataset } from '@/lib/hooks/useUploadedDataset';
import FalsificationSummaryCard from './FalsificationSummaryCard';
import PerturbationCheckList from './PerturbationCheckList';
import VerdictCard from './VerdictCard';
import ScorePanel from './ScorePanel';
import AuditPackViewer from './AuditPackViewer';

const STAGES = [
  { key: 'cohort', label: 'Cohort' },
  { key: 'checks', label: 'Falsification' },
  { key: 'verdict', label: 'Verdict' },
  { key: 'audit', label: 'Audit Pack' },
];

const DEFAULT_FILTERS = {
  disease: 'Prostate Cancer',
  intervention_medication: 'Enzalutamide',
  control_medication: 'Abiraterone',
  country: '',
  hospital: '',
  sex: '',
  age_range: '',
  min_arm_size: 5,
};

function stageIndex(key) {
  return STAGES.findIndex((s) => s.key === key);
}

export default function EngineRunPanel({ hypothesisQuestion, onToast }) {
  const { dataset } = useUploadedDataset();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [stage, setStage] = useState('idle'); // idle | cohort | checks | verdict | audit | done
  const [falsification, setFalsification] = useState(null);
  const [revealCount, setRevealCount] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const [auditPack, setAuditPack] = useState(null);
  const [simulatedParts, setSimulatedParts] = useState({ falsification: false, verdict: false, audit: false });
  const [errorNote, setErrorNote] = useState('');

  const revealTimer = useRef(null);

  useEffect(() => () => clearInterval(revealTimer.current), []);

  const setField = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  async function handleRun() {
    if (!filters.intervention_medication.trim() || (!filters.disease.trim() && !filters.domain)) return;
    if (!dataset?.datasetId) {
      setErrorNote('Upload a dataset above before running the engines.');
      return;
    }

    // reset
    clearInterval(revealTimer.current);
    setFalsification(null);
    setVerdict(null);
    setAuditPack(null);
    setRevealCount(0);
    setErrorNote('');
    setSimulatedParts({ falsification: false, verdict: false, audit: false });

    setStage('cohort');
    await new Promise((r) => setTimeout(r, 450));

    const runFilters = { ...filters, dataset_id: dataset.datasetId };

    // ── Step 1: Falsification ──────────────────────────────────────────
    let fResult;
    let fSimulated = false;
    try {
      fResult = await runFalsification(runFilters);
    } catch (err) {
      fSimulated = true;
      fResult = simulateFalsification(filters);
      setErrorNote(
        err?.status === 501
          ? 'Live case source is not wired yet — showing a simulated run with realistic statistics.'
          : 'Could not reach the falsification engine — showing a simulated run with realistic statistics.'
      );
    }
    setFalsification(fResult);
    setSimulatedParts((s) => ({ ...s, falsification: fSimulated }));
    setStage('checks');

    // stagger-reveal each check for the "wow" moment
    const total = fResult.checks.length;
    await new Promise((resolve) => {
      let i = 0;
      revealTimer.current = setInterval(() => {
        i += 1;
        setRevealCount(i);
        if (i >= total) {
          clearInterval(revealTimer.current);
          resolve();
        }
      }, 230);
    });
    await new Promise((r) => setTimeout(r, 350));

    // ── Step 2: Verdict ─────────────────────────────────────────────────
    setStage('verdict');
    const evidenceInput = {
      hypothesis_question: hypothesisQuestion || `Does ${filters.intervention_medication} improve outcomes vs ${filters.control_medication || 'standard care'} in ${filters.disease || filters.domain}?`,
      cohort_description: `${filters.disease || filters.domain} — ${filters.intervention_medication}${filters.control_medication ? ` vs. ${filters.control_medication}` : ' vs. everyone else'}`,
      n_intervention: fResult.baseline.n_intervention,
      n_control: fResult.baseline.n_control,
      odds_ratio: fResult.baseline.odds_ratio,
      ci_low: fResult.baseline.ci_low,
      ci_high: fResult.baseline.ci_high,
      p_value: fResult.baseline.p_value,
      test_used: fResult.baseline.test_used,
      direction: fResult.baseline.direction,
    };

    let vResult;
    let vSimulated = false;
    try {
      vResult = await computeVerdict(evidenceInput, fResult);
    } catch {
      vSimulated = true;
      vResult = simulateVerdict(evidenceInput, fResult);
    }
    setVerdict(vResult);
    setSimulatedParts((s) => ({ ...s, verdict: vSimulated }));
    await new Promise((r) => setTimeout(r, 200));

    // ── Step 3: Audit pack ──────────────────────────────────────────────
    setStage('audit');
    let aResult;
    let aSimulated = false;
    if (!vSimulated) {
      try {
        aResult = await getAuditPack(vResult.verdict_id);
      } catch {
        aSimulated = true;
        aResult = simulateAuditPack(vResult);
      }
    } else {
      aSimulated = true;
      aResult = simulateAuditPack(vResult);
    }
    setAuditPack(aResult);
    setSimulatedParts((s) => ({ ...s, audit: aSimulated }));
    setStage('done');
    onToast?.(`Verdict computed: ${vResult.verdict.replace(/_/g, ' ')}`);
  }

  const currentIdx = stage === 'idle' ? -1 : stage === 'done' ? STAGES.length - 1 : stageIndex(stage);
  const running = stage !== 'idle' && stage !== 'done';

  return (
    <div className={styles.panel} id="engine-lab">
      <div className={styles.panelHead}>
        <span className={styles.panelLabel}>Evidence Verification Lab</span>
        <span className={styles.eyebrow} style={{ marginBottom: 0 }}>
          <span className={styles.eyebrowDot} />
          Falsification → Verdict → Audit Pack
        </span>
      </div>
      <p className={styles.qFooterLeft} style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '-4px 0 16px', lineHeight: 1.6 }}>
        Runs the hypothesis through pure-statistics robustness checks (no LLM) before a rule-based verdict is issued —
        every step is logged to a downloadable audit trail.
      </p>

      {/* Cohort form */}
      <div className={styles.engineFormGrid}>
        <label className={styles.engineField}>
          <span>Disease</span>
          <input value={filters.disease} onChange={setField('disease')} placeholder="e.g. Prostate Cancer" disabled={running} />
        </label>
        <label className={styles.engineField}>
          <span>Intervention medication</span>
          <input value={filters.intervention_medication} onChange={setField('intervention_medication')} placeholder="e.g. Enzalutamide" disabled={running} />
        </label>
        <label className={styles.engineField}>
          <span>Control medication <em>(optional)</em></span>
          <input value={filters.control_medication} onChange={setField('control_medication')} placeholder="everyone else, if blank" disabled={running} />
        </label>
      </div>

      <button type="button" className={styles.linkBtn} style={{ marginBottom: 10 }} onClick={() => setAdvancedOpen((o) => !o)}>
        {advancedOpen ? 'Hide' : 'Show'} advanced filters
      </button>

      {advancedOpen && (
        <div className={styles.engineFormGrid} style={{ marginBottom: 4 }}>
          <label className={styles.engineField}>
            <span>Country</span>
            <input value={filters.country} onChange={setField('country')} disabled={running} />
          </label>
          <label className={styles.engineField}>
            <span>Hospital</span>
            <input value={filters.hospital} onChange={setField('hospital')} disabled={running} />
          </label>
          <label className={styles.engineField}>
            <span>Sex</span>
            <input value={filters.sex} onChange={setField('sex')} disabled={running} />
          </label>
          <label className={styles.engineField}>
            <span>Age range</span>
            <input value={filters.age_range} onChange={setField('age_range')} disabled={running} />
          </label>
          <label className={styles.engineField}>
            <span>Min. arm size</span>
            <input type="number" min={1} value={filters.min_arm_size} onChange={(e) => setFilters((f) => ({ ...f, min_arm_size: Number(e.target.value) || 1 }))} disabled={running} />
          </label>
        </div>
      )}

      {/* Stepper */}
      <div className={styles.engineStepper}>
        {STAGES.map((s, i) => (
          <div key={s.key} className={styles.engineStep}>
            <div
              className={`${styles.engineStepDot} ${i < currentIdx ? styles.engineStepDone : ''} ${i === currentIdx && running ? styles.engineStepActive : ''} ${stage === 'done' ? styles.engineStepDone : ''}`}
            >
              {(i < currentIdx || stage === 'done') ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={styles.engineStepLabel}>{s.label}</span>
            {i < STAGES.length - 1 && <div className={`${styles.engineStepLine} ${i < currentIdx || stage === 'done' ? styles.engineStepLineDone : ''}`} />}
          </div>
        ))}
      </div>

      {!dataset?.datasetId && (
        <div className={styles.simulatedNote} style={{ marginBottom: 10 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Upload a dataset above to run the engines against your own cases.
        </div>
      )}

      <button type="button" className={styles.btnGenerate} onClick={handleRun} disabled={running || !dataset?.datasetId} style={{ width: '100%', justifyContent: 'center' }}>
        {running ? (
          <>
            <span className={styles.spinner} />
            {stage === 'cohort' && 'Building cohort…'}
            {stage === 'checks' && `Running robustness checks… (${revealCount}/${falsification?.checks.length || 0})`}
            {stage === 'verdict' && 'Computing verdict…'}
            {stage === 'audit' && 'Assembling audit pack…'}
          </>
        ) : (
          <>
            {stage === 'done' ? 'Run again' : 'Run Falsification & Verdict'}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </>
        )}
      </button>

      {errorNote && (
        <div className={styles.simulatedNote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v5" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorNote}
        </div>
      )}

      {falsification && (
        <div className={styles.engineResultBlock}>
          <FalsificationSummaryCard result={falsification} simulated={simulatedParts.falsification} />
          <PerturbationCheckList checks={falsification.checks} revealCount={stage === 'checks' ? revealCount : falsification.checks.length} />
        </div>
      )}

      {verdict && stage !== 'checks' && (
        <div className={`${styles.engineResultBlock} ${styles.verdictReveal}`}>
          <VerdictCard verdict={verdict} justRevealed simulated={simulatedParts.verdict} />
          <ScorePanel scorecard={verdict.scorecard} animate />
        </div>
      )}

      {auditPack && stage === 'done' && (
        <div className={styles.engineResultBlock}>
          <AuditPackViewer auditPack={auditPack} verdictId={verdict.verdict_id} simulated={simulatedParts.audit} />
        </div>
      )}
    </div>
  );
}
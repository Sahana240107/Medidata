// Static mock data for the AI Research Workspace.
// No backend calls — everything here is fixture data used to drive the
// client-side demo of the workspace UI.

export const DATASETS = [
  {
    id: 'prostate-cancer',
    name: 'Prostate Cancer Dataset',
    cases: '18,204',
    institutions: 8,
  },
  {
    id: 'breast-cancer',
    name: 'Breast Cancer Dataset',
    cases: '14,839',
    institutions: 9,
  },
  {
    id: 'diabetes-t2',
    name: 'Diabetes Cohort · Type II',
    cases: '12,187',
    institutions: 6,
  },
];

export const DATASET_SUMMARY = {
  totalCases: '45,230',
  institutions: 23,
  countries: 12,
  dateRange: '2015–2024',
};

export const RESEARCH_QUESTION =
  'Does Enzalutamide reduce recurrence compared with Abiraterone in patients over 60?';

export const TEMPLATES = [
  'Compare two treatments',
  'Discover biomarkers',
  'Outcome prediction',
  'Rare disease pattern',
  'Drug effectiveness',
];

export const HYPOTHESIS = {
  status: 'Draft',
  confirmations: 0,
  statement:
    'Enzalutamide is associated with reduced biochemical recurrence versus Abiraterone in patients over 60.',
  meta: {
    supportingCases: 32,
    institutions: 3,
  },
};

export const OBSERVATIONS = [
  {
    id: 'recurrence-rate-reduction',
    title: 'Recurrence rate reduction',
    strength: 'Strong',
    supportingCases: 18,
    summary:
      'Patients receiving Enzalutamide demonstrated a lower biochemical recurrence rate compared to Abiraterone in the matched cohort.',
  },
  {
    id: 'time-to-event-delta',
    title: 'Time-to-event delta',
    strength: 'Moderate',
    supportingCases: 11,
    summary:
      'Median time-to-recurrence was extended by 4.7 months (95% CI: 2.1–7.3) among Enzalutamide-treated patients within matched strata.',
  },
  {
    id: 'adverse-event-profile',
    title: 'Adverse event profile',
    strength: 'Limited',
    supportingCases: 3,
    summary:
      'Fatigue-related discontinuation was marginally higher in the Enzalutamide subgroup — not statistically significant here.',
  },
];

export const EVIDENCE_CASES = [
  {
    id: 'DS-001-PCa',
    institution: 'Mayo Clinic',
    match: 92,
    outcome: 'Positive',
    summary:
      'Patient cohort aged 60–72 receiving Enzalutamide showed 34% lower recurrence rate compared to Abiraterone over a 24-month follow-up.',
    timeline: [
      { label: 'Month 0', text: 'Treatment initiation' },
      { label: 'Month 6', text: 'First assessment' },
      { label: 'Month 12', text: 'Mid-term evaluation' },
      { label: 'Month 24', text: 'Final outcome' },
    ],
    medications: ['Enzalutamide', 'Prednisone', 'Leuprolide'],
    observations: [
      'PSA decline observed within 3 months',
      'No significant adverse events reported',
      'Treatment adherence >90%',
    ],
  },
  {
    id: 'DS-002-PCa',
    institution: 'MD Anderson Cancer Center',
    match: 87,
    outcome: 'Positive',
    summary:
      'Matched cohort of 14 patients over 60 showed extended time-to-recurrence with Enzalutamide relative to Abiraterone.',
    timeline: [
      { label: 'Month 0', text: 'Treatment initiation' },
      { label: 'Month 6', text: 'First assessment' },
      { label: 'Month 18', text: 'Recurrence check' },
    ],
    medications: ['Enzalutamide', 'Leuprolide'],
    observations: [
      'Time-to-recurrence extended by ~5 months',
      'Mild fatigue reported in 2 of 14 patients',
      'Treatment adherence 86%',
    ],
  },
  {
    id: 'DS-003-PCa',
    institution: 'Memorial Sloan Kettering',
    match: 81,
    outcome: 'Positive',
    summary:
      'Retrospective review of 9 age-matched patients found consistent biochemical recurrence reduction versus Abiraterone.',
    timeline: [
      { label: 'Month 0', text: 'Treatment initiation' },
      { label: 'Month 9', text: 'Interim review' },
      { label: 'Month 20', text: 'Final outcome' },
    ],
    medications: ['Enzalutamide', 'Prednisone'],
    observations: [
      'PSA nadir reached earlier than Abiraterone comparator group',
      'One patient discontinued due to fatigue',
      'Treatment adherence 91%',
    ],
  },
];

export const CROSS_DATASET_FINDINGS = [
  {
    id: 'shared-biomarker-elevation',
    title: 'Shared biomarker elevation before recurrence',
    datasets: ['Prostate Cancer', 'Bladder Cancer'],
    confidence: 88,
    cases: 42,
    institutions: 9,
    description:
      'A shared biomarker signature rises consistently in the months preceding recurrence across both cohorts, independent of primary treatment.',
    supportingCases: [
      { id: 'DS-014-PCa', institution: 'Johns Hopkins', match: 90, outcome: 'Positive' },
      { id: 'DS-021-BLC', institution: 'Cleveland Clinic', match: 84, outcome: 'Positive' },
      { id: 'DS-033-PCa', institution: 'UCSF Medical Center', match: 79, outcome: 'Positive' },
    ],
  },
  {
    id: 'similar-treatment-response',
    title: 'Similar treatment response profiles in patients >60',
    datasets: ['Prostate Cancer', 'Colorectal Cancer'],
    confidence: 85,
    cases: 29,
    institutions: 6,
    description:
      'Patients over 60 in both cohorts show comparable response trajectories to androgen-pathway and targeted therapies, suggesting a shared age-related treatment response pattern.',
    supportingCases: [
      { id: 'DS-045-PCa', institution: 'Mount Sinai Hospital', match: 88, outcome: 'Positive' },
      { id: 'DS-052-CRC', institution: 'Duke University Hospital', match: 83, outcome: 'Positive' },
      { id: 'DS-058-CRC', institution: 'Cedars-Sinai Medical Center', match: 77, outcome: 'Mixed' },
    ],
  },
];

export const COVERAGE_GAPS = [
  { id: 'pediatric', label: 'Few pediatric patients', severity: 'High', coverage: 12 },
  { id: 'asian-rep', label: 'Limited Asian representation', severity: 'High', coverage: 18 },
  { id: 'followup', label: 'Insufficient long-term follow-up', severity: 'Moderate', coverage: 40 },
  { id: 'sample-size', label: 'Low isolated sample size', severity: 'Low', coverage: 63 },
];

export const SAVED_HYPOTHESES = [
  {
    id: 'enzalutamide-recurrence',
    statement: HYPOTHESIS.statement,
    status: 'Draft',
    savedAt: '2026-07-08 · 14:22',
    supportingCases: 32,
    institutions: 3,
    href: '/research/hypothesis',
  },
  {
    id: 'metformin-glycemic-control',
    statement:
      'Early Metformin initiation is associated with more stable long-term glycemic control in newly diagnosed Type II patients.',
    status: 'Confirmed',
    savedAt: '2026-07-05 · 09:47',
    supportingCases: 51,
    institutions: 5,
    href: '/research/hypothesis',
  },
  {
    id: 'her2-response-biomarker',
    statement:
      'Elevated HER2 expression correlates with faster response onset to targeted therapy in the breast cancer cohort.',
    status: 'Draft',
    savedAt: '2026-06-29 · 18:03',
    supportingCases: 24,
    institutions: 4,
    href: '/research/hypothesis',
  },
];

export const RECENT_ACTIVITY = [
  {
    id: 'act-1',
    type: 'hypothesis',
    text: 'Generated hypothesis on Enzalutamide vs Abiraterone recurrence',
    timestamp: '2026-07-11 · 10:12',
  },
  {
    id: 'act-2',
    type: 'discovery',
    text: 'Cross-dataset discovery surfaced a shared biomarker signal (88% confidence)',
    timestamp: '2026-07-10 · 16:40',
  },
  {
    id: 'act-3',
    type: 'dataset',
    text: 'Diabetes Cohort · Type II dataset added to workspace scope',
    timestamp: '2026-07-09 · 08:55',
  },
  {
    id: 'act-4',
    type: 'save',
    text: 'Saved study "Q4 Comparative Review"',
    timestamp: '2026-07-08 · 14:22',
  },
  {
    id: 'act-5',
    type: 'hypothesis',
    text: 'Confirmed hypothesis on Metformin and glycemic control',
    timestamp: '2026-07-05 · 09:47',
  },
  {
    id: 'act-6',
    type: 'export',
    text: 'Exported findings for HER2 biomarker discovery',
    timestamp: '2026-06-29 · 18:10',
  },
];

export const SAVED_STUDY = {
  title: 'Q4 Comparative Review',
  timestamp: '2026-07-08 · 14:22',
  datasetVersion: 'v2026.Q3-a',
  hypothesesGenerated: 4,
  hypothesesSaved: 2,
};

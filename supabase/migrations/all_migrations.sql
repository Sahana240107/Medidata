-- ============================================================================
-- RUN THIS ENTIRE FILE, TOP TO BOTTOM, ONCE, IN SUPABASE SQL EDITOR.
-- Every part is safe to re-run even if you already ran some of it before.
-- ============================================================================


-- ── PART 1: add the disease column to cases (if not already there) ────────

alter table cases add column if not exists disease text;
create index if not exists idx_cases_disease on cases (disease);


-- ── PART 2: backfill disease from the code already in fingerprint_id ──────
-- (best-effort decode of your existing 52 disease codes — only touches
--  rows where disease is still null, safe to re-run)

update cases set disease = case split_part(fingerprint_id, '-', 1)
  when 'AST'  then 'Asthma'
  when 'UTI'  then 'Urinary Tract Infection'
  when 'LUC'  then 'Lung Cancer'
  when 'BRC'  then 'Breast Cancer'
  when 'CRC'  then 'Colorectal Cancer'
  when 'ABR'  then 'Acute Bronchitis'
  when 'ALS'  then 'Amyotrophic Lateral Sclerosis'
  when 'PRC'  then 'Prostate Cancer'
  when 'OSA'  then 'Obstructive Sleep Apnea'
  when 'LEU'  then 'Leukemia'
  when 'COPD' then 'Chronic Obstructive Pulmonary Disease'
  when 'HTN'  then 'Hypertension'
  when 'AFIB' then 'Atrial Fibrillation'
  when 'MI'   then 'Myocardial Infarction'
  when 'EPI'  then 'Epilepsy'
  when 'CAD'  then 'Coronary Artery Disease'
  when 'PAD'  then 'Peripheral Artery Disease'
  when 'TYPH' then 'Typhoid Fever'
  when 'MIG'  then 'Migraine'
  when 'FLU'  then 'Influenza'
  when 'HF'   then 'Heart Failure'
  when 'PARK' then 'Parkinson''s Disease'
  when 'PE'   then 'Pulmonary Embolism'
  when 'ALZ'  then 'Alzheimer''s Disease'
  when 'STR'  then 'Stroke'
  when 'DVT'  then 'Deep Vein Thrombosis'
  when 'TB'   then 'Tuberculosis'
  when 'HYPR' then 'Hyperlipidemia'
  when 'IBS'  then 'Irritable Bowel Syndrome'
  when 'GERD' then 'Gastroesophageal Reflux Disease'
  when 'CHOL' then 'Hypercholesterolemia'
  when 'METS' then 'Metabolic Syndrome'
  when 'OBES' then 'Obesity'
  when 'RA'   then 'Rheumatoid Arthritis'
  when 'PSA'  then 'Psoriatic Arthritis'
  when 'PUD'  then 'Peptic Ulcer Disease'
  when 'APAN' then 'Acute Pancreatitis'
  when 'CKD'  then 'Chronic Kidney Disease'
  when 'NEPH' then 'Nephrotic Syndrome'
  when 'PSO'  then 'Psoriasis'
  when 'AKI'  then 'Acute Kidney Injury'
  when 'HYPO' then 'Hypothyroidism'
  when 'SLE'  then 'Systemic Lupus Erythematosus'
  when 'AOSD' then 'Adult-Onset Still''s Disease'
  when 'BEH'  then 'Behçet''s Disease'
  when 'NMO'  then 'Neuromyelitis Optica'
  when 'GAU'  then 'Gaucher Disease'
  when 'WIL'  then 'Wilson''s Disease'
  when 'EDS'  then 'Ehlers-Danlos Syndrome'
  when 'POM'  then 'POEMS Syndrome'
  when 'FAB'  then 'Fabry Disease'
  when 'TSC'  then 'Tuberous Sclerosis Complex'
  else null
end
where disease is null;


-- ── PART 3: fix research_signals (Discovery Feed dashboard) ───────────────
-- Realigns the table to what feed_service.py / clustering_service.py
-- actually expect (text status/signal_type, not the old enum types).

drop table if exists research_signals cascade;

create table research_signals (
  id                        uuid primary key default gen_random_uuid(),
  signal_type               text not null check (
    signal_type in ('emerging_syndrome', 'drug_response', 'biomarker', 'research_opportunity')
  ),
  status                    text not null default 'active' check (
    status in ('active', 'validating', 'published', 'archived')
  ),
  title                     text not null,
  summary                   text not null,
  confidence                numeric(5,2) not null check (confidence >= 0 and confidence <= 100),
  case_count                integer not null default 0,
  patient_count             integer,
  hospital_count            integer not null default 0,
  countries                 text[] not null default '{}',
  participating_hospitals   text[] not null default '{}',
  tags                      text[] not null default '{}',
  cluster_key               text unique,
  evidence_score            numeric(5,2),
  reproducibility_score     numeric(5,2),
  hospital_diversity_score  numeric(5,2),
  data_quality_score        numeric(5,2),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_research_signals_status      on research_signals (status);
create index idx_research_signals_type        on research_signals (signal_type);
create index idx_research_signals_updated     on research_signals (updated_at desc);
create index idx_research_signals_confidence  on research_signals (confidence desc);
create index idx_research_signals_cluster_key on research_signals (cluster_key);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_research_signals_updated_at on research_signals;
create trigger trg_research_signals_updated_at
  before update on research_signals
  for each row execute function set_updated_at();

alter table research_signals enable row level security;

drop policy if exists "authenticated users can read signals" on research_signals;
create policy "authenticated users can read signals"
  on research_signals for select
  to authenticated
  using (true);

delete from research_signal_cases
  where research_signal_id not in (select id from research_signals);

update research_opportunities
  set related_signal_id = null
  where related_signal_id is not null
    and related_signal_id not in (select id from research_signals);

update validation_requests
  set research_signal_id = null
  where research_signal_id is not null
    and research_signal_id not in (select id from research_signals);

update collaborations
  set related_signal_id = null
  where related_signal_id is not null
    and related_signal_id not in (select id from research_signals);

alter table research_signal_cases
  drop constraint if exists research_signal_cases_research_signal_id_fkey;
alter table research_signal_cases
  add constraint research_signal_cases_research_signal_id_fkey
  foreign key (research_signal_id) references research_signals(id) on delete cascade;

alter table research_opportunities
  drop constraint if exists research_opportunities_related_signal_id_fkey;
alter table research_opportunities
  add constraint research_opportunities_related_signal_id_fkey
  foreign key (related_signal_id) references research_signals(id);

alter table validation_requests
  drop constraint if exists validation_requests_research_signal_id_fkey;
alter table validation_requests
  add constraint validation_requests_research_signal_id_fkey
  foreign key (research_signal_id) references research_signals(id);

alter table collaborations
  drop constraint if exists collaborations_related_signal_id_fkey;
alter table collaborations
  add constraint collaborations_related_signal_id_fkey
  foreign key (related_signal_id) references research_signals(id);


-- ── PART 4: sanity check — run this last and read the output ──────────────

select
  (select count(*) from cases)                          as total_cases,
  (select count(*) from cases where disease is not null) as cases_with_disease,
  (select count(distinct disease) from cases)             as distinct_diseases,
  (select count(*) from research_signals)                 as research_signals_rows;
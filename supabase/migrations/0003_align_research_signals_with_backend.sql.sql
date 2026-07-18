-- ============================================================================
-- 0003_align_research_signals_with_backend.sql
--
-- Same fix as before (realigns research_signals to the columns feed_service.py
-- / clustering_service.py / schemas/feed.py actually use) — this version
-- skips the seed rows entirely. The table starts empty; real rows only
-- appear once POST /feed/scan (or the "Run Discovery Scan" button) finds
-- actual clusters in your `cases` table.
-- ============================================================================

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

-- ── Clean up orphaned references, then re-attach FKs (same as before) ──────

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

-- No seed data. Table is empty until a real scan runs.
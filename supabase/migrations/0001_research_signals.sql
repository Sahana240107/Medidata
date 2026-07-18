-- ============================================================================
-- RESTORE research_signals to its real schema + re-attach the FKs that
-- `drop table ... cascade` removed from research_signal_cases,
-- research_opportunities, validation_requests, and collaborations.
--
-- research_signals is recreated with fresh UUIDs, so any existing rows in
-- the dependent tables that still reference old (now-gone) signal ids are
-- orphaned. This script cleans those up BEFORE re-attaching the FKs, so the
-- constraint can actually be added.
-- ============================================================================

drop table if exists research_signals cascade;

create table research_signals (
  id                            uuid primary key default gen_random_uuid(),

  title                         text not null,
  signal_type                   signal_type not null,          -- syndrome | biomarker | drug_response | disease_cluster
  description                   text,

  matching_case_count           integer not null default 0,
  participating_hospital_count  integer not null default 0,
  countries                     text[] default '{}',

  -- denormalised extras the clustering pipeline writes (not in the
  -- original dump, additive/nullable so nothing else breaks)
  participating_hospitals       text[] default '{}',
  tags                          text[] default '{}',
  cluster_key                   text unique,                   -- lets a re-scan UPDATE instead of duplicating

  evidence_score                numeric,
  reproducibility_score         numeric,
  hospital_diversity_score      numeric,
  data_quality_score            numeric,
  confidence_score              numeric,

  status                        signal_status not null default 'emerging',  -- emerging | under_review | validated | rejected
  generated_by                  text not null default 'discovery_agent',
  raw_agent_output              jsonb,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index idx_research_signals_status     on research_signals (status);
create index idx_research_signals_type       on research_signals (signal_type);
create index idx_research_signals_updated    on research_signals (updated_at desc);
create index idx_research_signals_confidence on research_signals (confidence_score desc);
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

-- ── Clean up orphaned references BEFORE re-attaching FKs ───────────────────
-- research_signals is brand new and empty, so anything in these tables that
-- still points at an old signal id is now dangling. research_signal_id on
-- research_signal_cases is NOT NULL, so those rows are deleted outright
-- (they're join-table rows describing a signal that no longer exists — safe
-- to drop). The others are nullable, so we just clear the reference and
-- keep the parent row (opportunity / validation request / collaboration).

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

-- ── Re-attach the foreign keys CASCADE removed ──────────────────────────────

alter table research_signal_cases
  add constraint research_signal_cases_research_signal_id_fkey
  foreign key (research_signal_id) references research_signals(id);

alter table research_opportunities
  add constraint research_opportunities_related_signal_id_fkey
  foreign key (related_signal_id) references research_signals(id);

alter table validation_requests
  add constraint validation_requests_research_signal_id_fkey
  foreign key (research_signal_id) references research_signals(id);

alter table collaborations
  add constraint collaborations_related_signal_id_fkey
  foreign key (related_signal_id) references research_signals(id);
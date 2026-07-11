-- The version of medidata_supabase_schema.sql in this repo does not define
-- a `disease` column on `cases` (only symptoms/labs/meds/outcome + an
-- ICD-10 code that lives in Qdrant only). The research-chat analytics
-- tools group and filter by disease name, so this column is required.
--
-- Krithika: you mentioned you already loaded a `disease` column into your
-- live Supabase `cases` table and Qdrant payload directly -- this migration
-- just brings the *schema file* in this repo back in sync with that, and
-- adds the index the analytics tools rely on for fast filtering. Safe to
-- run even if the column already exists (guarded by IF NOT EXISTS).

alter table cases
  add column if not exists disease text;

create index if not exists idx_cases_disease on cases (disease);

comment on column cases.disease is
  'Primary disease/diagnosis label for this case (e.g. "Behçet''s Disease"). '
  'Used for grouping/filtering by the research chat analytics tools. '
  'Must also be present as `disease` in the matching Qdrant point payload.';

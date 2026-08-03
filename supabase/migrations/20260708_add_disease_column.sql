alter table cases
  add column if not exists disease text;

create index if not exists idx_cases_disease on cases (disease);

comment on column cases.disease is
  'Primary disease/diagnosis label for this case (e.g. "Behçet''s Disease"). '
  'Used for grouping/filtering by the research chat analytics tools and the '
  'Research > Dataset page.';
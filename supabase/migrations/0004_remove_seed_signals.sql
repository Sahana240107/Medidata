-- ============================================================================
-- 0004_remove_seed_signals.sql
--
-- Only needed if you already ran the EARLIER version of
-- 0003_align_research_signals_with_backend.sql (the one that included 6
-- seed rows). Deletes just those — anything created by a real scan is
-- untouched since real signals never use a 'seed-*' cluster_key.
--
-- Safe to run even if you never ran the seeded version — it'll just delete
-- 0 rows.
-- ============================================================================

delete from research_signal_cases
  where research_signal_id in (
    select id from research_signals where cluster_key like 'seed-%'
  );

delete from research_signals
  where cluster_key like 'seed-%';
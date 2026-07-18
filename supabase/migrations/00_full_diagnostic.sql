-- Run this once and paste me the full output. It tells me:
--  1) the CURRENT columns on research_signals (so I know exactly what's there now)
--  2) whether your original signal_type / signal_status enum types survived, and their values
--  3) which FK constraints on the dependent tables are currently missing

-- 1) Current research_signals columns
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'research_signals'
ORDER BY ordinal_position;

-- 2) Enum types + values (should still exist even after the DROP TABLE)
SELECT t.typname AS enum_name, e.enumlabel AS value, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('signal_type', 'signal_status')
ORDER BY t.typname, e.enumsortorder;

-- 3) Which FKs to research_signals currently exist (should be empty/missing after CASCADE)
SELECT tc.table_name, kcu.column_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'research_signals';
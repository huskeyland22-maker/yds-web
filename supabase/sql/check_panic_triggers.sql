-- Run in Supabase SQL Editor — panic-related triggers / views / RPC

SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table LIKE '%panic%'
ORDER BY event_object_table, trigger_name;

SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%panic%'
ORDER BY table_name;

SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'panic_metrics'
ORDER BY ordinal_position;

-- Optional: list functions touching panic tables (manual review)
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition ILIKE '%panic%';

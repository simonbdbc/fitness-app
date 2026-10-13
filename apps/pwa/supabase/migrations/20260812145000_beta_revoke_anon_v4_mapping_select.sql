-- Production inherited an obsolete SELECT grant for anon. RLS still denied
-- rows, but the beta contract requires the canonical V4 mappings to be
-- inaccessible to anonymous callers at both the privilege and policy layers.
begin;

revoke select on public.acrea_level_evaluation_exercise_mappings from anon;

commit;

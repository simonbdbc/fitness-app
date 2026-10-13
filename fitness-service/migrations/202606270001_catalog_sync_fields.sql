alter table exercises
    add column if not exists exercise_type text not null default 'non renseigné';

update exercises
set exercise_type = case
    when timer_compatibility ilike '%emom%' then 'EMOM'
    when timer_compatibility ilike '%hold%' then 'isometrie'
    when timer_compatibility ilike '%20/40%' or timer_compatibility ilike '%30/30%' then 'intervalle'
    else 'force'
end
where exercise_type = 'non renseigné';

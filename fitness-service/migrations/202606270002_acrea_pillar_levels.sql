alter table profiles
    add column if not exists pillar_levels jsonb;

alter table profiles
    add column if not exists active_variant_tags text[] not null default '{}';

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_name = 'profiles'
          and column_name = 'category_levels'
    ) then
        execute $sql$
            update profiles
            set pillar_levels = jsonb_build_object(
                'renforcement',
                least(10, greatest(1, least(
                    coalesce(nullif(category_levels ->> 'poussee', '')::int, 0),
                    coalesce(nullif(category_levels ->> 'jambes', '')::int, 0),
                    coalesce(nullif(category_levels ->> 'core', '')::int, 0)
                ) + 1)),
                'cardio',
                least(10, greatest(1,
                    coalesce(nullif(category_levels ->> 'conditioning', '')::int, 0) + 1
                )),
                'proprioception',
                least(10, greatest(1, least(
                    coalesce(nullif(category_levels ->> 'tirage', '')::int, 0),
                    coalesce(nullif(category_levels ->> 'mobilite', '')::int, 0),
                    coalesce(nullif(category_levels ->> 'skill', '')::int, 0),
                    coalesce(nullif(category_levels ->> 'core', '')::int, 0)
                ) + 1))
            )
            where pillar_levels is null
        $sql$;
    else
        update profiles
        set pillar_levels = '{"renforcement": 1, "cardio": 1, "proprioception": 1}'::jsonb
        where pillar_levels is null;
    end if;
end $$;

update profiles
set pillar_levels = jsonb_build_object(
    'renforcement',
    least(10, greatest(1, coalesce(nullif(pillar_levels ->> 'renforcement', '')::int, 1))),
    'cardio',
    least(10, greatest(1, coalesce(nullif(pillar_levels ->> 'cardio', '')::int, nullif(pillar_levels ->> 'hiit', '')::int, 1))),
    'proprioception',
    least(10, greatest(1, coalesce(nullif(pillar_levels ->> 'proprioception', '')::int, nullif(pillar_levels ->> 'callisthenie', '')::int, 1)))
)
where pillar_levels ? 'hiit'
   or pillar_levels ? 'callisthenie'
   or not (pillar_levels ? 'cardio')
   or not (pillar_levels ? 'proprioception');

alter table profiles
    alter column pillar_levels set not null;

alter table profiles
    drop column if exists global_level,
    drop column if exists category_levels;

do $$
declare
    constraint_name text;
    had_zero_based_check boolean;
begin
    for constraint_name in
        select conname
        from pg_constraint
        where conrelid = 'exercises'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) like '%pillar%'
    loop
        execute format('alter table exercises drop constraint %I', constraint_name);
    end loop;

    update exercises
    set pillar = case pillar
        when 'hiit' then 'cardio'
        when 'callisthenie' then 'proprioception'
        else pillar
    end
    where pillar in ('hiit', 'callisthenie');

    alter table exercises
        add constraint exercises_pillar_check
        check (pillar in ('renforcement', 'cardio', 'proprioception'));

    select exists (
        select 1
        from pg_constraint
        where conrelid = 'exercises'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) like '%level_min >= 0%'
    )
    into had_zero_based_check;

    if had_zero_based_check then
        update exercises
        set level_min = least(level_min + 1, 10),
            level_max = least(level_max + 1, 10);
    end if;

    update exercises
    set level_min = greatest(level_min, 1),
        level_max = greatest(level_max, 1)
    where level_min < 1
       or level_max < 1;

    for constraint_name in
        select conname
        from pg_constraint
        where conrelid = 'exercises'::regclass
          and contype = 'c'
          and (
              pg_get_constraintdef(oid) like '%level_min%'
              or pg_get_constraintdef(oid) like '%level_max%'
          )
    loop
        execute format('alter table exercises drop constraint %I', constraint_name);
    end loop;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'exercises'::regclass
          and conname = 'exercises_level_min_range'
    ) then
        alter table exercises
            add constraint exercises_level_min_range
            check (level_min between 1 and 10);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'exercises'::regclass
          and conname = 'exercises_level_max_range'
    ) then
        alter table exercises
            add constraint exercises_level_max_range
            check (level_max >= level_min and level_max <= 10);
    end if;
end $$;

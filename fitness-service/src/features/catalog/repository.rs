use sqlx::PgPool;

use crate::features::catalog::model::Exercise;

pub async fn list_exercises(pool: &PgPool) -> Result<Vec<Exercise>, sqlx::Error> {
    sqlx::query_as::<_, Exercise>(
        r#"
        select
            e.id,
            e.code,
            e.label as name,
            e.pillar_id,
            p.code as pillar_code,
            p.label as pillar_label,
            jsonb_build_object(
                'id', f.id,
                'code', f.code,
                'label', f.label,
                'updatedAt', ''
            ) as family,
            jsonb_build_array(
                jsonb_build_object(
                    'id', f.id,
                    'code', f.code,
                    'label', f.label,
                    'updatedAt', ''
                )
            ) as families,
            jsonb_build_object(
                'id', t.id,
                'code', t.code,
                'label', t.label,
                'updatedAt', ''
            ) as exercise_type,
            muscle_groups.rows as muscle_groups,
            e.difficulty as level_min,
            e.difficulty as level_max,
            equipment.label as equipment,
            impact.code as impact,
            regression.label as regression,
            coalesce(progression.label, '') as progression,
            e.movement_description as description,
            case
                when trim(coalesce(e.start_position, '')) = '' then '[]'::jsonb
                else to_jsonb(string_to_array(e.start_position, E'\n'))
            end as start_position_steps,
            case
                when trim(coalesce(e.outbound_execution, '')) = '' then '[]'::jsonb
                else to_jsonb(string_to_array(e.outbound_execution, E'\n'))
            end as outbound_execution_steps,
            case
                when trim(coalesce(e.return_execution, '')) = '' then '[]'::jsonb
                else to_jsonb(string_to_array(e.return_execution, E'\n'))
            end as return_execution_steps,
            case
                when trim(coalesce(e.start_position, '')) = '' then '[]'::jsonb
                else to_jsonb(string_to_array(e.start_position, E'\n'))
            end as position_steps,
            case
                when trim(coalesce(concat_ws(E'\n', e.outbound_execution, e.return_execution), '')) = '' then '[]'::jsonb
                else to_jsonb(string_to_array(concat_ws(E'\n', e.outbound_execution, e.return_execution), E'\n'))
            end as execution_steps,
            case
                when trim(coalesce(e.errors, '')) = '' then '[]'::jsonb
                else to_jsonb(string_to_array(e.errors, E'\n'))
            end as common_errors,
            'seed catalogue metier' as source_status,
            '' as updated_at
        from catalog_exercises e
        join catalog_pillars p on p.id = e.pillar_id
        join catalog_impacts impact on impact.id = e.impact_id
        join catalog_families f on f.id = e.family_id
        join catalog_types t on t.id = e.type_id
        join catalog_equipment equipment on equipment.id = e.equipment_id
        left join catalog_exercises regression on regression.id = e.regression_exercise_id
        left join catalog_exercises progression on progression.id = e.progression_exercise_id
        left join lateral (
            select coalesce(
                jsonb_agg(
                    jsonb_build_object(
                        'id', g.id,
                        'code', g.code,
                        'label', g.label,
                        'updatedAt', ''
                    )
                    order by g.label
                ),
                '[]'::jsonb
            ) as rows
            from catalog_exercise_muscle_groups link
            join catalog_muscle_groups g on g.id = link.muscle_group_id
            where link.exercise_id = e.id
        ) muscle_groups on true
        order by
            case p.code
                when 'warm-up' then 1
                when 'cardio' then 2
                when 'strength' then 3
                when 'proprioception' then 4
                when 'flexibility' then 5
                else 99
            end,
            e.difficulty,
            e.label
        "#,
    )
    .fetch_all(pool)
    .await
}

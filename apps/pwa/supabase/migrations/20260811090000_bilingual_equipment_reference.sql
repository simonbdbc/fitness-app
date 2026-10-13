-- Canonical bilingual equipment reference. Existing ids are deliberately kept.
alter table public.catalog_equipment
  add column if not exists label_en text;

with reference(old_code, code, label, label_en, category) as (
  values
    ('mur','wall','Mur','Wall','maison'),
    ('chaise','chair','Chaise','Chair','maison'),
    ('table','table','Table','Table','maison'),
    ('plan-de-travail','countertop','Plan de travail','Countertop','maison'),
    ('canape','couch','Canapé','Couch','maison'),
    ('marche','stair','Marche','Stair','maison'),
    ('porte','door','Porte','Door','maison'),
    ('serviette','towel','Serviette','Towel','maison'),
    ('anneaux','rings','Anneaux','Rings','sport'),
    ('barre-traction','pull-up-bar','Barre de traction','Pull-up bar','sport'),
    ('barre-basse','low-bar','Barre basse','Low bar','sport'),
    ('barre-verticale','vertical-bar','Barre verticale','Vertical bar','sport'),
    ('barres-paralleles','parallel-bars','Barres parallèles','Parallel bars','sport'),
    ('parallettes','parallettes','Parallettes','Parallettes','sport'),
    ('banc','bench','Banc','Bench','sport'),
    ('box','box','Box','Box','sport'),
    ('step','step','Step','Step','sport'),
    ('elastique','resistance-band','Élastique','Resistance band','sport'),
    ('corde-a-sauter','jump-rope','Corde à sauter','Jump rope','sport'),
    ('kettlebell','kettlebell','Kettlebell','Kettlebell','sport'),
    ('rameur','rowing-machine','Rameur','Rowing machine','sport'),
    ('tapis-de-course','treadmill','Tapis de course','Treadmill','sport'),
    ('tapis-de-sol','exercise-mat','Tapis de sol','Exercise mat','sport'),
    ('velo','stationary-bike','Vélo','Stationary bike','sport')
)
update public.catalog_equipment equipment
set code = reference.code, label = reference.label, label_en = reference.label_en,
    category = reference.category
from reference
where equipment.code = reference.old_code;

insert into public.catalog_equipment (code, label, label_en, category)
values ('no-equipment', 'Sans équipement', 'No equipment', 'sport')
on conflict (code) do update
set label = excluded.label, label_en = excluded.label_en, category = excluded.category;

alter table public.catalog_equipment
  alter column label_en set not null;

-- Profile equipment references catalog_equipment by id since migration
-- 20260714130000. Updating the canonical code in place therefore preserves
-- every profile association without rewriting user-owned rows.

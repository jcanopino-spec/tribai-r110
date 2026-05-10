-- 032 · Conc Utilidades · clasificación NIC 12 explícita
--
-- La hoja `Conc Utilidades` del .xlsm guía v5 separa las partidas en 3
-- categorías según NIC 12 / IFRS:
--   · temporaria_deducible · revierte en periodos futuros · genera ATD
--   · temporaria_imponible · revierte en periodos futuros · genera PTD
--   · permanente            · no revierte
--
-- La tabla actual `conciliacion_partidas` tiene un campo `tipo` (permanente
-- | temporal) que NO distingue deducible vs imponible. Esta migración agrega
-- una columna explícita y backfilla los valores legacy:
--   tipo='permanente'           → 'permanente'
--   tipo='temporal' + signo=mas → 'temporaria_deducible' (suma a la fiscal)
--   tipo='temporal' + signo=menos → 'temporaria_imponible' (resta de la fiscal)

alter table public.conciliacion_partidas
  add column if not exists categoria_nic12 text
    check (categoria_nic12 in ('temporaria_deducible', 'temporaria_imponible', 'permanente'));

-- Backfill: clasificar las partidas existentes
update public.conciliacion_partidas
set categoria_nic12 = case
  when tipo = 'permanente' then 'permanente'
  when tipo = 'temporal' and signo = 'mas' then 'temporaria_deducible'
  when tipo = 'temporal' and signo = 'menos' then 'temporaria_imponible'
  else 'permanente'
end
where categoria_nic12 is null;

comment on column public.conciliacion_partidas.categoria_nic12 is
  'Clasificación NIC 12 · temporaria_deducible | temporaria_imponible | permanente';

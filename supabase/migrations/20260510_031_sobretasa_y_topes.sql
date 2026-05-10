-- 031 · Sobretasa Art. 240 por tipo de actividad + tope rentas exentas
--
-- Cambios:
--   1. `declaraciones.tipo_sobretasa` · enum-like text para distinguir las 4
--      ramas del Art. 240: ninguna · financiera (par. 1, 5pp) ·
--      hidroelectrica (par. 4, 3pp) · extractora (par. 2, puntos variables).
--      Backfill: si `es_institucion_financiera = true` → 'financiera'.
--
--   2. `declaraciones.puntos_sobretasa_extractora` · numeric(5,4). Para par. 2
--      el contribuyente declara los puntos según el precio promedio del año
--      (consultar resolución DIAN del periodo).
--
--   3. `anexo_rentas_exentas.sujeto_tope_10pct` · boolean. Marca explícita de
--      si la renta está sujeta al límite del Art. 235-2 par. 5. Default true
--      (conservador). El loader actual ya lo deriva por heurística sobre la
--      `normatividad`; este campo lo hace explícito y permite override.

alter table public.declaraciones
  add column if not exists tipo_sobretasa text not null default 'ninguna'
    check (tipo_sobretasa in ('ninguna', 'financiera', 'hidroelectrica', 'extractora'));

alter table public.declaraciones
  add column if not exists puntos_sobretasa_extractora numeric(5, 4) not null default 0;

-- Backfill: declaraciones existentes con flag de financiera → tipo='financiera'.
update public.declaraciones
set tipo_sobretasa = 'financiera'
where es_institucion_financiera = true and tipo_sobretasa = 'ninguna';

alter table public.anexo_rentas_exentas
  add column if not exists sujeto_tope_10pct boolean not null default true;

comment on column public.declaraciones.tipo_sobretasa is
  'Sobretasa Art. 240: financiera (par.1, 5pp/120k UVT) · hidroelectrica (par.4, 3pp/30k UVT) · extractora (par.2, puntos variables) · ninguna';
comment on column public.declaraciones.puntos_sobretasa_extractora is
  'Puntos adicionales para sobretasa Art. 240 par. 2 (carbón/petróleo) según precio promedio del año';
comment on column public.anexo_rentas_exentas.sujeto_tope_10pct is
  'Si TRUE, la renta está sujeta al límite del 10% RL (Art. 235-2 par. 5)';

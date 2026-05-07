-- 024 · Tasa Mínima de Tributación Depurada (TTD) · Art. 240 par. 6° E.T.
-- Ley 2277/2022 introdujo una tasa efectiva mínima del 15% para personas
-- jurídicas. Si la TTD calculada es menor, se debe adicionar al impuesto
-- (R95 del 110) la diferencia para llegar al 15%.
--
-- Default true porque aplica a la mayoría de PJ régimen ordinario.
-- Se desactiva manualmente para zonas francas, no residentes, etc.

alter table public.declaraciones
  add column aplica_tasa_minima boolean not null default true;

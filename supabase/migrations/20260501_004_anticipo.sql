-- 004 · Datos para cálculo del anticipo (renglón 108)
-- Fórmula del Anexo 2 del .xlsm:
--   anticipo = max(0, ((impuesto_neto_actual + impuesto_neto_anterior) / 2)
--                   × tarifa - retenciones)
--   tarifa según años declarando: 25% / 50% / 75%
--   primer año: anticipo = 0 ("no aplica")

alter table public.declaraciones
  add column impuesto_neto_anterior numeric(18,2) not null default 0,
  add column anios_declarando text not null default 'tercero_o_mas'
    check (anios_declarando in ('primero', 'segundo', 'tercero_o_mas'));

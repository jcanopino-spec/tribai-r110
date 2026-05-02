-- 007 · Datos para sanción por corrección y sobretasa de instituciones financieras

alter table public.declaraciones
  -- Para sanción por corrección (Art. 644 E.T.):
  add column mayor_valor_correccion numeric(18, 2) not null default 0;

-- Notas sobre la sobretasa:
-- Para AG 2025, las entidades financieras del Parágrafo 1° del Art. 240 E.T.
-- pagan 5 puntos porcentuales adicionales sobre la renta líquida gravable
-- que exceda 120.000 UVT. La aplicación se controla mediante el flag
-- existente `es_institucion_financiera` y se calcula en computarRenglones.

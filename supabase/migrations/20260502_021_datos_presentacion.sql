-- 021 · Datos de presentación e identificación adicional del Formulario 110
-- Casillas oficiales DIAN que no se cubrían antes:
--   R26  · Nro. formulario anterior (cuando es corrección)
--   R29  · Fracción año gravable siguiente (presentación anticipada)
--   R30  · ¿Renunció a régimen tributario especial?
--   R31  · ¿Vinculado al pago de obras por impuestos?
--   R981 · Cód. representación (representante legal)
--   R982 · Cód. contador / revisor fiscal
--   R983 · Nro. tarjeta profesional contador / RF
--   R994 · Firma con salvedades

alter table public.declaraciones
  add column numero_formulario_anterior text,
  add column fraccion_ano_siguiente     boolean not null default false,
  add column renuncio_regimen_especial  boolean not null default false,
  add column vinculado_obras_impuestos  boolean not null default false,
  add column cod_representacion         text,
  add column cod_contador_rf            text,
  add column tarjeta_profesional        text,
  add column con_salvedades             boolean not null default false;

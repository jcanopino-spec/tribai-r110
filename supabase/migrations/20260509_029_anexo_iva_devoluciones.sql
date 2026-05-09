-- 029 · Agregar columna devoluciones a anexo_iva_declaraciones
--
-- El Formulario 300 tiene la casilla 40 "Devoluciones, rebajas y descuentos
-- en ventas anuladas, rescindidas o resueltas". Es necesaria para calcular
-- los ingresos NETOS del IVA y cruzarlos contra el R47 del F110.
--
-- Fórmula del cruce:
--   IVA (cas 39 - cas 40) ↔ R47 + R59 del F110

alter table public.anexo_iva_declaraciones
  add column if not exists devoluciones numeric(18, 2) not null default 0;

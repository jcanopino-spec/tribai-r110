-- 008 · Balance fiscal: ajustes fiscales sobre el balance de prueba
-- Inspirado en la hoja "Hoja Sumaria" del .xlsm modelo. Cada cuenta del
-- balance puede tener ajustes (débitos/créditos) que cambian el saldo
-- contable al saldo fiscal. El saldo fiscal es el que se agrega al renglón
-- del 110 (no el saldo contable).

alter table public.balance_prueba_lineas
  add column ajuste_debito numeric(18, 2) not null default 0,
  add column ajuste_credito numeric(18, 2) not null default 0,
  add column observacion text;

-- Vista calculada saldo_fiscal = saldo + ajuste_debito - ajuste_credito
-- (no la creamos como columna persistida para evitar inconsistencias;
-- se calcula en aplicación)

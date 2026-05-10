-- 033 · Conciliación Patrimonial · campo Deducción Art. 158-3
--
-- El modelo de actualicese.com / archivo Aries incluye en la conciliación
-- patrimonial las deducciones especiales que rebajan la renta líquida
-- pero NO disminuyeron el patrimonio (porque la inversión sigue en el
-- balance). El caso típico es la deducción del Art. 158-3 E.T. por
-- inversión en activos fijos productores de renta.
--
-- Sin captura explícita, la conciliación patrimonial de empresas que
-- usaron esta deducción mostraría una diferencia falsa (faltaría
-- justificar el monto del beneficio fiscal).

alter table public.declaraciones
  add column if not exists deduccion_art_158_3 numeric(18, 2) not null default 0;

comment on column public.declaraciones.deduccion_art_158_3 is
  'Deducción Art. 158-3 E.T. (inversión activos fijos productores) y similares · suma al PL justificado en la conciliación patrimonial';

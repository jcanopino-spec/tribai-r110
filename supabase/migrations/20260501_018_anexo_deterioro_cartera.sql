-- 018 · Anexo 12 · Deterioro de Cartera (Art. 145 E.T., Decreto 187/1975)
-- Una fila por declaración con la cartera segmentada por antigüedad y el
-- método elegido (general/individual/combinado).

alter table public.declaraciones
  add column dc_cartera_0_90       numeric(18, 2) not null default 0,
  add column dc_cartera_91_180     numeric(18, 2) not null default 0,
  add column dc_cartera_181_360    numeric(18, 2) not null default 0,
  add column dc_cartera_360_mas    numeric(18, 2) not null default 0,
  add column dc_metodo             text not null default 'general'
    check (dc_metodo in ('general', 'individual', 'combinado')),
  add column dc_saldo_contable     numeric(18, 2) not null default 0;

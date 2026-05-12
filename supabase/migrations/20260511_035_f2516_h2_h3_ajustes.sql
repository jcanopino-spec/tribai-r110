-- 035 · F2516 H2 (ESF Patrimonio) + H3 (ERI Renta Líquida) · captura de ajustes
--
-- Replica las hojas oficiales H2 (250 renglones) y H3 (590 renglones) del
-- modelo110.xlsm. Para evitar guardar ~8000 celdas por declaración:
--
--   · El valor CONTABLE (Val1) se computa desde el balance · NO se guarda
--   · Solo guardamos los AJUSTES capturados manualmente:
--       Val2 · efecto conversión moneda funcional
--       Val3 · menor valor fiscal (por reconocimiento, exenciones, etc)
--       Val4 · mayor valor fiscal
--     Val5 = Val1 + Val2 − Val3 + Val4 · calculado
--
-- H3 además tiene Val6-Val12 con la "Renta líquida por tarifa" (general,
-- ZF, ECE, Mega-inversiones, par. 5 Art. 240, dividendos, GO, etc.):
--   Val6  · renta líquida tarifa general
--   Val7  · ZF
--   Val8  · ECE
--   Val9  · mega-inversiones
--   Val10 · par. 5 Art. 240
--   Val11 · dividendos (tarifas especiales R86-R90)
--   Val12 · ganancias ocasionales

create table public.formato_2516_h2_ajustes (
  declaracion_id    uuid    not null references public.declaraciones(id) on delete cascade,
  renglon_id        integer not null,   -- coincide con id_excel del catálogo TS
  conversion        numeric(18, 2) not null default 0,  -- Val2
  menor_fiscal      numeric(18, 2) not null default 0,  -- Val3
  mayor_fiscal      numeric(18, 2) not null default 0,  -- Val4
  observacion       text,
  updated_at        timestamptz not null default now(),
  primary key (declaracion_id, renglon_id)
);

create trigger formato_2516_h2_set_updated_at
  before update on public.formato_2516_h2_ajustes
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h2_ajustes enable row level security;

create policy "f2516_h2_owner_all" on public.formato_2516_h2_ajustes
  for all
  using (exists (
    select 1 from public.declaraciones d
    join public.empresas e on e.id = d.empresa_id
    where d.id = declaracion_id and e.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.declaraciones d
    join public.empresas e on e.id = d.empresa_id
    where d.id = declaracion_id and e.profile_id = auth.uid()
  ));

create table public.formato_2516_h3_ajustes (
  declaracion_id    uuid    not null references public.declaraciones(id) on delete cascade,
  renglon_id        integer not null,
  conversion        numeric(18, 2) not null default 0,  -- Val2
  menor_fiscal      numeric(18, 2) not null default 0,  -- Val3
  mayor_fiscal      numeric(18, 2) not null default 0,  -- Val4
  rl_tarifa_general numeric(18, 2) not null default 0,  -- Val6
  rl_zf             numeric(18, 2) not null default 0,  -- Val7
  rl_ece            numeric(18, 2) not null default 0,  -- Val8
  rl_mega_inv       numeric(18, 2) not null default 0,  -- Val9
  rl_par5           numeric(18, 2) not null default 0,  -- Val10
  rl_dividendos     numeric(18, 2) not null default 0,  -- Val11
  rl_go             numeric(18, 2) not null default 0,  -- Val12
  observacion       text,
  updated_at        timestamptz not null default now(),
  primary key (declaracion_id, renglon_id)
);

create trigger formato_2516_h3_set_updated_at
  before update on public.formato_2516_h3_ajustes
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h3_ajustes enable row level security;

create policy "f2516_h3_owner_all" on public.formato_2516_h3_ajustes
  for all
  using (exists (
    select 1 from public.declaraciones d
    join public.empresas e on e.id = d.empresa_id
    where d.id = declaracion_id and e.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.declaraciones d
    join public.empresas e on e.id = d.empresa_id
    where d.id = declaracion_id and e.profile_id = auth.uid()
  ));

-- Tabla auxiliar para mapear cuentas del balance → renglón H2/H3.
-- Equivalente a la columna J de la "Hoja Sumaria" del modelo Excel.
-- Si no hay mapeo explícito, el loader infiere por prefijo PUC.
create table public.balance_renglon_h2_h3 (
  declaracion_id    uuid    not null references public.declaraciones(id) on delete cascade,
  cuenta            text    not null,
  renglon_h2        integer,
  renglon_h3        integer,
  primary key (declaracion_id, cuenta)
);

alter table public.balance_renglon_h2_h3 enable row level security;

create policy "bal_rh2h3_owner_all" on public.balance_renglon_h2_h3
  for all
  using (exists (
    select 1 from public.declaraciones d
    join public.empresas e on e.id = d.empresa_id
    where d.id = declaracion_id and e.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.declaraciones d
    join public.empresas e on e.id = d.empresa_id
    where d.id = declaracion_id and e.profile_id = auth.uid()
  ));

comment on table public.formato_2516_h2_ajustes is
  'F2516 H2 ESF Patrimonio · ajustes capturados por renglón (los contables se computan del balance)';
comment on table public.formato_2516_h3_ajustes is
  'F2516 H3 ERI Renta Líquida · ajustes + renta líquida por tarifa';
comment on table public.balance_renglon_h2_h3 is
  'Mapeo cuenta → renglón H2/H3 · equivalente a la col J de Hoja Sumaria del modelo';

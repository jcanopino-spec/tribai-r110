-- 026 · Formato 2516 v.9 · Conciliación fiscal ESF + ERI
-- Reporte oficial DIAN (Resolución 71/2019) para PJ del régimen ordinario.
--
-- Estructura compacta del .xlsm guía v5: 18 filas por declaración con
-- 3 ajustes manuales sobre el saldo contable agregado:
--
--   FISCAL = CONTABLE + CONVERSIÓN − MENOR_FISCAL + MAYOR_FISCAL
--
-- El CONTABLE se deriva del balance (no se almacena aquí). Sólo guardamos
-- los ajustes que el usuario captura para llegar al fiscal.

create table public.formato_2516_ajustes (
  declaracion_id  uuid    not null references public.declaraciones(id) on delete cascade,
  fila_id         text    not null,
  conversion      numeric(18, 2) not null default 0,
  menor_fiscal    numeric(18, 2) not null default 0,
  mayor_fiscal    numeric(18, 2) not null default 0,
  observacion     text,
  updated_at      timestamptz not null default now(),
  primary key (declaracion_id, fila_id)
);

create trigger formato_2516_ajustes_set_updated_at
  before update on public.formato_2516_ajustes
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_ajustes enable row level security;

create policy "f2516_ajustes_owner_all" on public.formato_2516_ajustes
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

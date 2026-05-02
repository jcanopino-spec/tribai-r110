-- 017 · Anexo 22 · Diferencia en Cambio
-- Cuentas con saldo en moneda extranjera. La diferencia en cambio
-- (no realizada) entre TRM inicial y TRM final del año afecta R48
-- (ingresos financieros) o R65 (gastos financieros).

create table public.anexo_diferencia_cambio (
  id                bigserial primary key,
  declaracion_id    uuid not null references public.declaraciones(id) on delete cascade,
  tipo              text not null check (tipo in ('activo', 'pasivo')),
  cuenta            text,
  nit               text,
  tercero           text not null,
  fecha_transaccion date,
  valor_usd         numeric(18, 4) not null default 0,
  trm_inicial       numeric(18, 4) not null default 0,
  observacion       text,
  created_at        timestamptz not null default now()
);

create index anexo_dc_decl_idx on public.anexo_diferencia_cambio (declaracion_id);
alter table public.anexo_diferencia_cambio enable row level security;

create policy "anexo_dc_owner_all" on public.anexo_diferencia_cambio
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

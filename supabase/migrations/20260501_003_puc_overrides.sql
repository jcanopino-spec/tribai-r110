-- 003 · Homologación de cuentas por empresa
-- Cada empresa puede mapear cuentas PUC propias (que no estén en el catálogo
-- general o que prefiera asignar a otro renglón) a un renglón del 110.
-- Estas overrides se aplican antes que el catálogo global al importar balance.

create table public.puc_overrides (
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  puc          text not null,
  renglon_110  smallint,
  nombre       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (empresa_id, puc)
);

create index puc_overrides_empresa_idx on public.puc_overrides (empresa_id);

create trigger puc_overrides_set_updated_at
  before update on public.puc_overrides
  for each row execute function public.tg_set_updated_at();

alter table public.puc_overrides enable row level security;

create policy "puc_overrides_owner_all" on public.puc_overrides
  for all
  using (exists (
    select 1 from public.empresas e
    where e.id = empresa_id and e.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.empresas e
    where e.id = empresa_id and e.profile_id = auth.uid()
  ));

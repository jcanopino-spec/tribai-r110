-- 015 · Anexo 26 · INCRNGO (Ingresos No Constitutivos de Renta ni Ganancia Ocasional)
-- Suma → renglón 60 del Formulario 110

create table public.anexo_incrngo (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  concepto        text not null,
  normatividad    text,
  valor           numeric(18, 2) not null default 0,
  created_at      timestamptz not null default now()
);

create index anexo_incrngo_decl_idx on public.anexo_incrngo (declaracion_id);
alter table public.anexo_incrngo enable row level security;

create policy "anexo_incrngo_owner_all" on public.anexo_incrngo
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

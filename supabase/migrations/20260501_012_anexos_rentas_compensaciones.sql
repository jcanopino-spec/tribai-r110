-- 012 · Anexos 19 (Rentas Exentas) y 20 (Compensación de Pérdidas)

-- ANEXO 19 · Rentas Exentas → Renglón 77
create table public.anexo_rentas_exentas (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  descripcion     text not null,
  normatividad    text,
  valor_fiscal    numeric(18, 2) not null default 0,
  created_at      timestamptz not null default now()
);

create index anexo_rentas_decl_idx on public.anexo_rentas_exentas (declaracion_id);
alter table public.anexo_rentas_exentas enable row level security;
create policy "anexo_rentas_owner_all" on public.anexo_rentas_exentas
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

-- ANEXO 20 · Compensación de Pérdidas → Renglón 74
create table public.anexo_compensaciones (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  tipo            text not null check (tipo in ('perdida', 'exceso_rp')),
  ano_origen      smallint not null,
  perdida_original numeric(18, 2) not null default 0,
  compensar       numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);

create index anexo_comp_decl_idx on public.anexo_compensaciones (declaracion_id);
alter table public.anexo_compensaciones enable row level security;
create policy "anexo_comp_owner_all" on public.anexo_compensaciones
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

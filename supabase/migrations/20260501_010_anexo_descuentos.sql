-- 010 · Anexo 4 · Descuentos tributarios

create table public.anexo_descuentos (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  categoria       text not null check (categoria in ('impuestos_exterior', 'donaciones', 'otros')),
  descripcion     text not null,
  normatividad    text,
  base            numeric(18, 2) not null default 0,
  valor_descuento numeric(18, 2) not null default 0,
  created_at      timestamptz not null default now()
);

create index anexo_descuentos_decl_idx on public.anexo_descuentos (declaracion_id);

alter table public.anexo_descuentos enable row level security;

create policy "anexo_descuentos_owner_all" on public.anexo_descuentos
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

-- 009 · Anexo 3 · Retenciones y autorretenciones en la fuente

create table public.anexo_retenciones (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  tipo            text not null check (tipo in ('retencion', 'autorretencion')),
  concepto        text not null,
  agente          text,
  nit             text,
  base            numeric(18, 2) not null default 0,
  retenido        numeric(18, 2) not null default 0,
  created_at      timestamptz not null default now()
);

create index anexo_retenciones_decl_idx on public.anexo_retenciones (declaracion_id);

alter table public.anexo_retenciones enable row level security;

create policy "anexo_retenciones_owner_all" on public.anexo_retenciones
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

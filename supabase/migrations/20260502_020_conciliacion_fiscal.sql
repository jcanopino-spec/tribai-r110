-- 020 · Conciliación Fiscal
-- Diferente al Balance Fiscal: explica diferencias entre la utilidad
-- contable y la renta líquida fiscal por concepto (permanentes y
-- temporales). Es el "puente" entre estados financieros y el 110.

-- Punto de partida (1:1 con declaración)
alter table public.declaraciones
  add column cf_utilidad_contable numeric(18, 2) not null default 0;

-- Partidas conciliatorias
create table public.conciliacion_partidas (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  tipo            text not null check (tipo in ('permanente', 'temporal')),
  signo           text not null check (signo in ('mas', 'menos')),
  concepto        text not null,
  valor           numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index conciliacion_partidas_decl_idx on public.conciliacion_partidas (declaracion_id);

alter table public.conciliacion_partidas enable row level security;
create policy "conciliacion_partidas_owner_all" on public.conciliacion_partidas for all
  using (
    exists (
      select 1 from public.declaraciones d
      join public.empresas e on e.id = d.empresa_id
      where d.id = declaracion_id and e.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.declaraciones d
      join public.empresas e on e.id = d.empresa_id
      where d.id = declaracion_id and e.profile_id = auth.uid()
    )
  );

-- 022 · Conciliación Patrimonial
-- Justifica la variación del patrimonio líquido fiscal entre el año
-- anterior y el año actual: PL_inicial + utilidad fiscal − impuesto −
-- dividendos ± otras partidas = PL_final (debe igualar R46).
--
-- Las partidas auto-derivadas se calculan en tiempo real en la UI
-- (lectura de declaraciones + form110_valores + anexo_dividendos_distribuir).
-- Esta tabla guarda solo las partidas MANUALES que el usuario agrega
-- para explicar diferencias residuales (capitalizaciones, valorizaciones,
-- correcciones contables, etc.).

create table public.conciliacion_patrimonial_partidas (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  signo           text not null check (signo in ('mas', 'menos')),
  concepto        text not null,
  valor           numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);

create index conciliacion_patrimonial_decl_idx
  on public.conciliacion_patrimonial_partidas (declaracion_id);

alter table public.conciliacion_patrimonial_partidas enable row level security;

create policy "conciliacion_patrimonial_owner_all"
  on public.conciliacion_patrimonial_partidas for all
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

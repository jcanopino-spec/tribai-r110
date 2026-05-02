-- 014 · Anexo 18 · Ingresos por Dividendos
-- Cada línea representa un tercero del que la empresa recibió dividendos.
-- Las 8 columnas alimentan los renglones 49-56 del Formulario 110.

create table public.anexo_dividendos (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  nit             text,
  tercero         text not null,
  -- 8 categorías que alimentan renglones 49..56
  no_constitutivos              numeric(18, 2) not null default 0, -- R49
  distribuidos_no_residentes    numeric(18, 2) not null default 0, -- R50
  gravados_tarifa_general       numeric(18, 2) not null default 0, -- R51
  gravados_persona_natural_dos  numeric(18, 2) not null default 0, -- R52
  gravados_personas_extranjeras numeric(18, 2) not null default 0, -- R53
  gravados_art_245              numeric(18, 2) not null default 0, -- R54
  gravados_tarifa_l1819         numeric(18, 2) not null default 0, -- R55
  gravados_proyectos            numeric(18, 2) not null default 0, -- R56
  created_at      timestamptz not null default now()
);

create index anexo_div_decl_idx on public.anexo_dividendos (declaracion_id);
alter table public.anexo_dividendos enable row level security;
create policy "anexo_div_owner_all" on public.anexo_dividendos
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

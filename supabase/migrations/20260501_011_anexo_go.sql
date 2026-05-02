-- 011 · Anexo 8 · Ganancias Ocasionales
-- Cada operación de G.O. tiene precio venta, costo fiscal y no gravada.
-- Sumas alimentan renglones 80, 81, 82 del 110.

create table public.anexo_ganancia_ocasional (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  categoria       text not null check (categoria in (
    'activo_fijo', 'inversion', 'rifa_loteria',
    'herencia_legado', 'liquidacion_sociedad', 'exterior'
  )),
  concepto        text not null,
  precio_venta    numeric(18, 2) not null default 0,
  costo_fiscal    numeric(18, 2) not null default 0,
  no_gravada      numeric(18, 2) not null default 0,
  recuperacion_depreciacion numeric(18, 2) not null default 0,
  created_at      timestamptz not null default now()
);

create index anexo_go_decl_idx on public.anexo_ganancia_ocasional (declaracion_id);

alter table public.anexo_ganancia_ocasional enable row level security;

create policy "anexo_go_owner_all" on public.anexo_ganancia_ocasional
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

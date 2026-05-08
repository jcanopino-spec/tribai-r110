-- 025 · Anexo Venta de Activos Fijos
-- Replica los Anexos 5 y 6 del Liquidador DIAN AG 2025:
--   Anexo 5: Venta AF poseído ≤ 2 años → renta líquida ordinaria
--   Anexo 6: Venta AF poseído > 2 años → ganancia ocasional (R80/R81)
--
-- Una sola tabla con el flag posesion_mas_2_anos discrimina ambos casos.
-- Cuando posesion_mas_2_anos = true, las utilidades suman a R80 (ingresos
-- por GO) y costos − depreciación + reajustes a R81. Cuando false, son
-- informativos (los ingresos/costos contables ya están en R47/R66).

create table public.anexo_venta_activos_fijos (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  posesion_mas_2_anos boolean not null default true,
  fecha_compra    date,
  fecha_venta     date,
  detalle_activo  text not null,
  nit_comprador   text,
  precio_venta    numeric(18, 2) not null default 0,
  costo_fiscal    numeric(18, 2) not null default 0,
  depreciacion_acumulada numeric(18, 2) not null default 0,
  reajustes_fiscales numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);

create index anexo_venta_af_decl_idx
  on public.anexo_venta_activos_fijos (declaracion_id);

alter table public.anexo_venta_activos_fijos enable row level security;

create policy "anexo_venta_af_owner_all"
  on public.anexo_venta_activos_fijos for all
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

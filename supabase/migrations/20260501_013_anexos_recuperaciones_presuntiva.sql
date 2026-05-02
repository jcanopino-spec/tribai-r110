-- 013 · Anexo 17 (Recuperación de Deducciones, R70) y Anexo 1 (Renta Presuntiva, R76)

-- ANEXO 17 simplificado · Renta por recuperación de deducciones → R70
create table public.anexo_recuperaciones (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  concepto        text not null,
  descripcion     text not null,
  valor           numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);

create index anexo_recup_decl_idx on public.anexo_recuperaciones (declaracion_id);
alter table public.anexo_recuperaciones enable row level security;
create policy "anexo_recup_owner_all" on public.anexo_recuperaciones
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

-- ANEXO 1 · Renta Presuntiva → R76
-- Datos de depuración del patrimonio líquido AG anterior.
-- Tarifa 2025 = 0%, pero la estructura queda preparada para años futuros.
alter table public.declaraciones
  add column rp_acciones_sociedades_nacionales numeric(18, 2) not null default 0,
  add column rp_bienes_actividades_improductivas numeric(18, 2) not null default 0,
  add column rp_bienes_fuerza_mayor numeric(18, 2) not null default 0,
  add column rp_bienes_periodo_improductivo numeric(18, 2) not null default 0,
  add column rp_bienes_mineria numeric(18, 2) not null default 0,
  add column rp_primeros_19000_uvt_vivienda numeric(18, 2) not null default 0,
  add column rp_renta_gravada_bienes_excluidos numeric(18, 2) not null default 0;

-- 019 · Anexos restantes en una migración batch
-- 9 ICA, 10 GMF, 11 Predial, 13 IVA Bienes Capital, 21 Pagos Seg. Social,
-- 25 Cálculo Dividendos. Anexo 15 (Subcapitalización) usa columnas en
-- declaraciones porque es 1:1 con la declaración.

-- Helper común RLS
-- (cada tabla la replica)

-- ANEXO 9 · ICA
create table public.anexo_ica (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  municipio       text not null,
  base_gravable   numeric(18, 2) not null default 0,
  tarifa_milaje   numeric(8, 4)  not null default 0,
  valor_pagado    numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index anexo_ica_decl_idx on public.anexo_ica (declaracion_id);
alter table public.anexo_ica enable row level security;
create policy "anexo_ica_owner_all" on public.anexo_ica for all
  using (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()))
  with check (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()));

-- ANEXO 10 · GMF
create table public.anexo_gmf (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  entidad         text not null,
  periodo         text,
  valor_gmf       numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index anexo_gmf_decl_idx on public.anexo_gmf (declaracion_id);
alter table public.anexo_gmf enable row level security;
create policy "anexo_gmf_owner_all" on public.anexo_gmf for all
  using (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()))
  with check (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()));

-- ANEXO 11 · Predial
create table public.anexo_predial (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  predio          text not null,
  direccion       text,
  matricula       text,
  avaluo          numeric(18, 2) not null default 0,
  valor_pagado    numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index anexo_predial_decl_idx on public.anexo_predial (declaracion_id);
alter table public.anexo_predial enable row level security;
create policy "anexo_predial_owner_all" on public.anexo_predial for all
  using (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()))
  with check (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()));

-- ANEXO 13 · IVA Bienes Capital
create table public.anexo_iva_capital (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  factura         text,
  fecha           date,
  bien            text not null,
  proveedor       text,
  base            numeric(18, 2) not null default 0,
  iva_pagado      numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index anexo_iva_decl_idx on public.anexo_iva_capital (declaracion_id);
alter table public.anexo_iva_capital enable row level security;
create policy "anexo_iva_owner_all" on public.anexo_iva_capital for all
  using (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()))
  with check (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()));

-- ANEXO 21 · Pagos Seguridad Social
create table public.anexo_seg_social (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  empleado        text not null,
  cedula          text,
  salario         numeric(18, 2) not null default 0,
  aporte_salud    numeric(18, 2) not null default 0,
  aporte_pension  numeric(18, 2) not null default 0,
  aporte_arl      numeric(18, 2) not null default 0,
  aporte_parafiscales numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index anexo_ss_decl_idx on public.anexo_seg_social (declaracion_id);
alter table public.anexo_seg_social enable row level security;
create policy "anexo_ss_owner_all" on public.anexo_seg_social for all
  using (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()))
  with check (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()));

-- ANEXO 25 · Cálculo Dividendos a distribuir
create table public.anexo_dividendos_distribuir (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  socio           text not null,
  nit             text,
  participacion_pct numeric(8, 4) not null default 0,
  dividendo_no_gravado numeric(18, 2) not null default 0,
  dividendo_gravado    numeric(18, 2) not null default 0,
  retencion_aplicable  numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);
create index anexo_divdis_decl_idx on public.anexo_dividendos_distribuir (declaracion_id);
alter table public.anexo_dividendos_distribuir enable row level security;
create policy "anexo_divdis_owner_all" on public.anexo_dividendos_distribuir for all
  using (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()))
  with check (exists (select 1 from public.declaraciones d join public.empresas e on e.id=d.empresa_id where d.id=declaracion_id and e.profile_id=auth.uid()));

-- ANEXO 15 · Subcapitalización (1:1 con declaración)
alter table public.declaraciones
  add column sub_deuda_promedio   numeric(18, 2) not null default 0,
  add column sub_intereses         numeric(18, 2) not null default 0,
  add column sub_es_vinculado      boolean not null default false;

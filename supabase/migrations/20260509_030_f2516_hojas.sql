-- 030 · Formato 2516 · 7 hojas oficiales DIAN (H1-H7)
--
-- Estructura oficial del F2516 según Resolución DIAN 71/2019:
--   H1 Carátula              · datos del declarante, RL, contador, RF
--   H2 ESF                   · usa formato_2516_ajustes (catálogo expandido)
--   H3 ERI                   · usa formato_2516_ajustes (catálogo expandido)
--   H4 Impuesto Diferido     · ATD/PTD por categoría
--   H5 Ingresos y Facturación · matriz 10 conceptos × 4 tipos + cruce factura electrónica
--   H6 Activos Fijos         · 12 categorías × 8 columnas (movimiento del año)
--   H7 Resumen               · vista derivada (sin tabla)
--
-- H2/H3 reutilizan formato_2516_ajustes (creada en migración 026) porque
-- la estructura de captura es idéntica (4 ajustes por renglón). Solo
-- expandimos el catálogo en TypeScript (F2516_FILAS).

-- ============================================================
-- H1 · CARÁTULA
-- ============================================================
create table public.formato_2516_h1_caratula (
  declaracion_id            uuid    primary key references public.declaraciones(id) on delete cascade,
  -- 3. Representante Legal
  rep_legal_nombre          text,
  rep_legal_tipo_doc        text default 'CC',
  rep_legal_numero_doc      text,
  rep_legal_cargo           text default 'Representante Legal',
  -- 4. Contador Público
  contador_nombre           text,
  contador_tipo_doc         text default 'CC',
  contador_numero_doc       text,
  contador_tarjeta_prof     text,
  -- 5. Revisor Fiscal
  obligado_revisor_fiscal   boolean not null default false,
  rf_nombre                 text,
  rf_tipo_doc               text default 'CC',
  rf_numero_doc             text,
  rf_tarjeta_prof           text,
  -- 6. Marco normativo
  marco_normativo           text default 'NIIF Pymes' check (
    marco_normativo in ('NIIF Plenas', 'NIIF Pymes', 'NIF Microempresas')
  ),
  -- 7. Dirección notificación (espejo del MUISCA)
  direccion_notificacion    text,
  departamento_codigo       text,
  municipio_codigo          text,
  telefono                  text,
  correo                    text,
  -- Auditoría
  observaciones             text,
  updated_at                timestamptz not null default now()
);

create trigger formato_2516_h1_set_updated_at
  before update on public.formato_2516_h1_caratula
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h1_caratula enable row level security;

create policy "f2516_h1_owner_all" on public.formato_2516_h1_caratula
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


-- ============================================================
-- H4 · IMPUESTO DIFERIDO (NIC 12)
-- ============================================================
-- Categorías de diferencias temporarias.
-- tipo='atd' (activos · dif. deducibles) | 'ptd' (pasivos · dif. imponibles)
create table public.formato_2516_h4_imp_diferido (
  declaracion_id  uuid    not null references public.declaraciones(id) on delete cascade,
  categoria_id    text    not null,        -- 'A1', 'A2', ..., 'P1', 'P2', ...
  tipo            text    not null check (tipo in ('atd', 'ptd')),
  concepto        text    not null,
  base_contable   numeric(18, 2) not null default 0,
  base_fiscal     numeric(18, 2) not null default 0,
  tarifa          numeric(5, 4)  not null default 0.35,
  observacion     text,
  updated_at      timestamptz not null default now(),
  primary key (declaracion_id, categoria_id)
);

create trigger formato_2516_h4_set_updated_at
  before update on public.formato_2516_h4_imp_diferido
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h4_imp_diferido enable row level security;

create policy "f2516_h4_owner_all" on public.formato_2516_h4_imp_diferido
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


-- ============================================================
-- H5 · INGRESOS Y FACTURACIÓN
-- ============================================================
-- Matriz 10 conceptos × 4 tipos de ingreso + conciliación FE.
create table public.formato_2516_h5_ingresos (
  declaracion_id  uuid    not null references public.declaraciones(id) on delete cascade,
  concepto_id     text    not null,        -- 'VENTAS_BIENES', 'SERVICIOS_NAC', etc
  concepto        text    not null,
  gravados        numeric(18, 2) not null default 0,
  exentos         numeric(18, 2) not null default 0,
  excluidos       numeric(18, 2) not null default 0,
  exportacion     numeric(18, 2) not null default 0,
  observacion     text,
  updated_at      timestamptz not null default now(),
  primary key (declaracion_id, concepto_id)
);

create trigger formato_2516_h5_set_updated_at
  before update on public.formato_2516_h5_ingresos
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h5_ingresos enable row level security;

create policy "f2516_h5_owner_all" on public.formato_2516_h5_ingresos
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

-- Conciliación con facturación electrónica DIAN (1 fila por declaración)
create table public.formato_2516_h5_conciliacion (
  declaracion_id          uuid primary key references public.declaraciones(id) on delete cascade,
  total_facturado_dian    numeric(18, 2) not null default 0,
  notas_credito_emitidas  numeric(18, 2) not null default 0,
  notas_debito_emitidas   numeric(18, 2) not null default 0,
  observacion             text,
  updated_at              timestamptz not null default now()
);

create trigger formato_2516_h5c_set_updated_at
  before update on public.formato_2516_h5_conciliacion
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h5_conciliacion enable row level security;

create policy "f2516_h5c_owner_all" on public.formato_2516_h5_conciliacion
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


-- ============================================================
-- H6 · ACTIVOS FIJOS (PP&E e intangibles)
-- ============================================================
-- 12 categorías × movimiento del año (SI, adic, retiros, deprec, ajuste fiscal)
create table public.formato_2516_h6_activos_fijos (
  declaracion_id    uuid    not null references public.declaraciones(id) on delete cascade,
  categoria_id      text    not null,    -- 'TERRENOS', 'EDIFICACIONES', 'SOFTWARE', etc
  categoria         text    not null,
  saldo_inicial     numeric(18, 2) not null default 0,    -- SI costo histórico
  adiciones         numeric(18, 2) not null default 0,    -- compras del año
  retiros           numeric(18, 2) not null default 0,    -- ventas/bajas
  deprec_acumulada  numeric(18, 2) not null default 0,    -- deprec acum SI
  deprec_ano        numeric(18, 2) not null default 0,    -- deprec del año
  ajuste_fiscal     numeric(18, 2) not null default 0,    -- diferencia fiscal vs contable
  observacion       text,
  updated_at        timestamptz not null default now(),
  primary key (declaracion_id, categoria_id)
);

create trigger formato_2516_h6_set_updated_at
  before update on public.formato_2516_h6_activos_fijos
  for each row execute function public.tg_set_updated_at();

alter table public.formato_2516_h6_activos_fijos enable row level security;

create policy "f2516_h6_owner_all" on public.formato_2516_h6_activos_fijos
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


-- ============================================================
-- COMENTARIOS DE TABLA
-- ============================================================
comment on table public.formato_2516_h1_caratula
  is 'F2516 H1 · datos del declarante, RL, contador, RF, marco normativo';
comment on table public.formato_2516_h4_imp_diferido
  is 'F2516 H4 · NIC 12 · diferencias temporarias por categoría (ATD/PTD)';
comment on table public.formato_2516_h5_ingresos
  is 'F2516 H5 · matriz ingresos por concepto × tipo (gravados/exentos/excluidos/exportación)';
comment on table public.formato_2516_h5_conciliacion
  is 'F2516 H5 · conciliación con facturación electrónica DIAN';
comment on table public.formato_2516_h6_activos_fijos
  is 'F2516 H6 · movimiento de PP&E e intangibles · contable vs fiscal';

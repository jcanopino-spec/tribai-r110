-- 028 · Anexo IVA · declaraciones del Formulario 300 del año gravable
--
-- Tabla por declaración de renta · acumula las declaraciones de IVA
-- presentadas en el año (bimestral o cuatrimestral según el régimen
-- del contribuyente). Útil para soportar ingresos brutos del 110 y
-- conciliar con los movimientos contables clase 4.
--
-- Periodicidades · Art. 600 E.T.:
--   bimestral     · 6 periodos al año (1-6)
--   cuatrimestral · 3 periodos al año (1-3)
--
-- El PDF de la declaración se almacena en Supabase Storage bucket
-- 'anexo-iva-pdfs' (privado, RLS por owner). El campo pdf_path guarda
-- la ruta relativa dentro del bucket.

create table public.anexo_iva_declaraciones (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,

  /** "bimestral" | "cuatrimestral" */
  periodicidad    text not null check (periodicidad in ('bimestral', 'cuatrimestral')),
  /** 1..6 si bimestral · 1..3 si cuatrimestral */
  periodo         smallint not null check (periodo between 1 and 6),

  /** Fecha en que se presentó al MUISCA */
  fecha_presentacion date,
  /** Número de formulario asignado por la DIAN */
  numero_formulario  text,

  /** Casillas principales del Formulario 300 (todas en pesos) */
  ingresos_brutos      numeric(18, 2) not null default 0,
  ingresos_no_gravados numeric(18, 2) not null default 0,
  ingresos_exentos     numeric(18, 2) not null default 0,
  ingresos_gravados    numeric(18, 2) not null default 0,
  iva_generado         numeric(18, 2) not null default 0,
  iva_descontable      numeric(18, 2) not null default 0,
  saldo_pagar          numeric(18, 2) not null default 0,
  saldo_favor          numeric(18, 2) not null default 0,

  /** Soporte: ruta dentro del bucket de Storage (opcional) */
  pdf_path        text,
  pdf_filename    text,

  observacion     text,
  created_at      timestamptz not null default now()
);

-- Un solo registro por declaración + periodicidad + periodo
create unique index anexo_iva_unique_periodo
  on public.anexo_iva_declaraciones (declaracion_id, periodicidad, periodo);

create index anexo_iva_decl_idx
  on public.anexo_iva_declaraciones (declaracion_id);

alter table public.anexo_iva_declaraciones enable row level security;

create policy "anexo_iva_owner_all"
  on public.anexo_iva_declaraciones for all
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

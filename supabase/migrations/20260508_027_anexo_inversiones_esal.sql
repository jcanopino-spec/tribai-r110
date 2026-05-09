-- 027 · Anexo Inversiones ESAL · alimenta R68 y R69 del Formulario 110
--
-- Régimen Tributario Especial (ESAL · Art. 356-359 E.T.) requiere
-- desglosar las inversiones en activos fijos productivos:
--
--   R68 · Inversiones efectuadas en el año (deducible)
--   R69 · Inversiones liquidadas en periodos anteriores (recuperación)
--
-- El motor del 110 ya usa estos renglones en la base de R72 (R72 suma
-- R69 y resta R68). Esta tabla permite capturar el detalle por concepto
-- y persistir la auditoría del cálculo.

create table public.anexo_inversiones_esal (
  id              bigserial primary key,
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  /** "efectuada" suma a R68 · "liquidada" suma a R69 */
  tipo            text not null check (tipo in ('efectuada', 'liquidada')),
  fecha           date,
  /** Año del periodo gravable original (para liquidadas, indica el AG en que se efectuó). */
  ano_origen      smallint,
  concepto        text not null,
  /** Activo fijo productivo, programa social, dotación, etc. */
  categoria       text,
  valor           numeric(18, 2) not null default 0,
  observacion     text,
  created_at      timestamptz not null default now()
);

create index anexo_inv_esal_decl_idx
  on public.anexo_inversiones_esal (declaracion_id);

create index anexo_inv_esal_tipo_idx
  on public.anexo_inversiones_esal (declaracion_id, tipo);

alter table public.anexo_inversiones_esal enable row level security;

create policy "anexo_inv_esal_owner_all"
  on public.anexo_inversiones_esal for all
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

-- 016 · Anexo 14 · Interés Presuntivo (Art. 35 E.T.)
-- Préstamos de la sociedad a socios/accionistas. Si el interés cobrado es
-- menor al presuntivo (DTF E.A. del año), la diferencia debe reconocerse
-- como ingreso financiero adicional (R48 del Formulario 110).

create table public.anexo_intereses_presuntivos (
  id                  bigserial primary key,
  declaracion_id      uuid not null references public.declaraciones(id) on delete cascade,
  socio               text not null,
  cuenta              text,
  saldo_promedio      numeric(18, 2) not null default 0,
  dias                smallint not null default 360,
  interes_registrado  numeric(18, 2) not null default 0,
  observacion         text,
  created_at          timestamptz not null default now()
);

create index anexo_int_decl_idx on public.anexo_intereses_presuntivos (declaracion_id);
alter table public.anexo_intereses_presuntivos enable row level security;

create policy "anexo_int_owner_all" on public.anexo_intereses_presuntivos
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

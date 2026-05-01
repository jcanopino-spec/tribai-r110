-- ============================================================
-- 001 · Schema inicial Tribai R110
-- Multi-tenant: profile (auth.users) → empresas (max 5) → declaraciones
-- Catálogos públicos: CIIU, Direcciones Seccionales, Regímenes,
-- Renglones Form 110, Cuentas PUC.
-- ============================================================

-- Helper: trigger updated_at
create or replace function public.tg_set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- Catálogos (lectura pública, escritura solo service_role)
-- ------------------------------------------------------------

create table public.ciiu_codigos (
  codigo      text primary key,
  descripcion text not null
);

create table public.direcciones_seccionales (
  codigo text primary key,
  nombre text not null
);

create table public.regimenes_tarifas (
  codigo        text not null,
  ano_gravable  smallint not null,
  descripcion   text not null,
  tarifa        numeric(6,4) not null,
  primary key (codigo, ano_gravable)
);

create table public.form110_renglones (
  ano_gravable  smallint not null,
  numero        smallint not null,
  descripcion   text not null,
  seccion       text not null,
  formula_xlsm  text,
  fuente_celda  text,
  primary key (ano_gravable, numero)
);

create table public.puc_accounts (
  puc           text primary key,
  descripcion   text,
  renglon_110   smallint,
  anexo         text,
  f2516         text,
  ttd           text,
  ano_gravable  smallint not null default 2025
);

-- ------------------------------------------------------------
-- Tenant data
-- ------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  nombre      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create table public.empresas (
  id                          uuid primary key default gen_random_uuid(),
  profile_id                  uuid not null references public.profiles(id) on delete cascade,
  nit                         text not null,
  dv                          text,
  razon_social                text not null,
  ciiu_codigo                 text references public.ciiu_codigos(codigo),
  direccion_seccional_codigo  text references public.direcciones_seccionales(codigo),
  regimen_codigo              text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (profile_id, nit)
);

create index empresas_profile_idx on public.empresas (profile_id);

create trigger empresas_set_updated_at
  before update on public.empresas
  for each row execute function public.tg_set_updated_at();

-- Enforce max 5 empresas per profile
create or replace function public.check_max_empresas() returns trigger as $$
begin
  if (select count(*) from public.empresas where profile_id = new.profile_id) >= 5 then
    raise exception 'Máximo 5 empresas por cliente';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger empresas_max_5
  before insert on public.empresas
  for each row execute function public.check_max_empresas();

create table public.declaraciones (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  ano_gravable  smallint not null,
  formato       text not null default '110',
  estado        text not null default 'borrador',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, ano_gravable, formato)
);

create index declaraciones_empresa_idx on public.declaraciones (empresa_id);

create trigger declaraciones_set_updated_at
  before update on public.declaraciones
  for each row execute function public.tg_set_updated_at();

create table public.balance_pruebas (
  id              uuid primary key default gen_random_uuid(),
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  filename        text not null,
  uploaded_at     timestamptz not null default now()
);

create index balance_pruebas_decl_idx on public.balance_pruebas (declaracion_id);

create table public.balance_prueba_lineas (
  id           bigserial primary key,
  balance_id   uuid not null references public.balance_pruebas(id) on delete cascade,
  cuenta       text not null,
  nombre       text,
  saldo        numeric(18,2) not null default 0,
  renglon_110  smallint,
  anexo        text,
  f2516        text
);

create index balance_lineas_balance_idx on public.balance_prueba_lineas (balance_id);

create table public.form110_valores (
  declaracion_id  uuid not null references public.declaraciones(id) on delete cascade,
  numero          smallint not null,
  valor           numeric(18,2) not null default 0,
  primary key (declaracion_id, numero)
);

-- ------------------------------------------------------------
-- Auto-create profile on signup
-- ------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.profiles                  enable row level security;
alter table public.empresas                  enable row level security;
alter table public.declaraciones             enable row level security;
alter table public.balance_pruebas           enable row level security;
alter table public.balance_prueba_lineas     enable row level security;
alter table public.form110_valores           enable row level security;
alter table public.ciiu_codigos              enable row level security;
alter table public.direcciones_seccionales   enable row level security;
alter table public.regimenes_tarifas         enable row level security;
alter table public.form110_renglones         enable row level security;
alter table public.puc_accounts              enable row level security;

-- Profiles: user can read/update their own
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Empresas: user manages their own
create policy "empresas_owner_all" on public.empresas
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Declaraciones: through empresas
create policy "declaraciones_owner_all" on public.declaraciones
  for all
  using (exists (select 1 from public.empresas e where e.id = empresa_id and e.profile_id = auth.uid()))
  with check (exists (select 1 from public.empresas e where e.id = empresa_id and e.profile_id = auth.uid()));

-- Balance pruebas: through declaracion → empresa
create policy "balance_pruebas_owner_all" on public.balance_pruebas
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

create policy "balance_lineas_owner_all" on public.balance_prueba_lineas
  for all
  using (exists (
    select 1 from public.balance_pruebas b
    join public.declaraciones d on d.id = b.declaracion_id
    join public.empresas e on e.id = d.empresa_id
    where b.id = balance_id and e.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.balance_pruebas b
    join public.declaraciones d on d.id = b.declaracion_id
    join public.empresas e on e.id = d.empresa_id
    where b.id = balance_id and e.profile_id = auth.uid()
  ));

create policy "form110_valores_owner_all" on public.form110_valores
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

-- Catálogos: public read for everyone (incluye anon hasta que decidamos lo contrario)
create policy "ciiu_read"     on public.ciiu_codigos            for select using (true);
create policy "dian_read"     on public.direcciones_seccionales for select using (true);
create policy "regimen_read"  on public.regimenes_tarifas       for select using (true);
create policy "renglon_read"  on public.form110_renglones       for select using (true);
create policy "puc_read"      on public.puc_accounts            for select using (true);

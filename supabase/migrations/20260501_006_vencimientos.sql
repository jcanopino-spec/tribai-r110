-- 006 · Calendario de vencimientos del Formulario 110
-- Extraídos del .xlsm 'Vencimientos' (Decreto 2229/2024 para AG 2025).
-- Para PJ ordinarias: la "Primera Cuota" es declaración + pago.
-- Para Grandes Contribuyentes: la "Segunda Cuota" es declaración + pago.

create table public.vencimientos_form110 (
  ano_gravable      smallint not null,
  tipo_contribuyente text not null
    check (tipo_contribuyente in ('gran_contribuyente', 'persona_juridica')),
  ultimo_digito     smallint not null check (ultimo_digito between 0 and 9),
  fecha_vencimiento date not null,
  primary key (ano_gravable, tipo_contribuyente, ultimo_digito)
);

alter table public.vencimientos_form110 enable row level security;
create policy "vencimientos_read" on public.vencimientos_form110 for select using (true);

-- AG 2025 · Grandes Contribuyentes (Declaración + Pago Segunda Cuota, abril 2026)
insert into public.vencimientos_form110 values
  (2025, 'gran_contribuyente', 1, '2026-04-13'),
  (2025, 'gran_contribuyente', 2, '2026-04-14'),
  (2025, 'gran_contribuyente', 3, '2026-04-15'),
  (2025, 'gran_contribuyente', 4, '2026-04-16'),
  (2025, 'gran_contribuyente', 5, '2026-04-17'),
  (2025, 'gran_contribuyente', 6, '2026-04-20'),
  (2025, 'gran_contribuyente', 7, '2026-04-21'),
  (2025, 'gran_contribuyente', 8, '2026-04-22'),
  (2025, 'gran_contribuyente', 9, '2026-04-23'),
  (2025, 'gran_contribuyente', 0, '2026-04-24');

-- AG 2025 · Personas Jurídicas no Grandes (Declaración + Pago Primera Cuota, mayo 2026)
insert into public.vencimientos_form110 values
  (2025, 'persona_juridica', 1, '2026-05-12'),
  (2025, 'persona_juridica', 2, '2026-05-13'),
  (2025, 'persona_juridica', 3, '2026-05-14'),
  (2025, 'persona_juridica', 4, '2026-05-15'),
  (2025, 'persona_juridica', 5, '2026-05-19'),
  (2025, 'persona_juridica', 6, '2026-05-20'),
  (2025, 'persona_juridica', 7, '2026-05-21'),
  (2025, 'persona_juridica', 8, '2026-05-22'),
  (2025, 'persona_juridica', 9, '2026-05-25'),
  (2025, 'persona_juridica', 0, '2026-05-26');

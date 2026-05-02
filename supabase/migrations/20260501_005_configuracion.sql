-- 005 · Configuración consolidada de la declaración
-- Centraliza los parámetros que el .xlsm tiene en 'Datos Informativos',
-- 'Sanciones', 'Anexo 23 Beneficio Aud.' y otros. Sirven como insumo a las
-- fórmulas de cálculo del 110.

alter table public.declaraciones
  -- Configuración general (Datos Informativos D21..D26)
  add column es_gran_contribuyente boolean not null default false,
  add column tiene_justificacion_patrimonial boolean not null default true,
  add column calcula_anticipo boolean not null default true,
  add column es_institucion_financiera boolean not null default false,
  add column ica_como_descuento boolean not null default true,

  -- Beneficio de auditoría (Art. 689-3 E.T., Anexo 23)
  add column beneficio_auditoria_12m boolean not null default false,
  add column beneficio_auditoria_6m boolean not null default false,

  -- Datos del año gravable anterior (Datos Informativos D63..D70)
  add column saldo_pagar_anterior numeric(18, 2) not null default 0,
  add column saldo_favor_anterior numeric(18, 2) not null default 0,
  add column anticipo_para_actual numeric(18, 2) not null default 0,
  add column anticipo_puntos_adicionales numeric(18, 2) not null default 0,
  add column patrimonio_bruto_anterior numeric(18, 2) not null default 0,
  add column pasivos_anterior numeric(18, 2) not null default 0,
  add column perdidas_fiscales_acumuladas numeric(18, 2) not null default 0,

  -- Información contable del periodo
  add column utilidad_contable numeric(18, 2) not null default 0,
  add column perdida_contable numeric(18, 2) not null default 0,

  -- Datos nómina (renglones 33-35 del 110)
  add column total_nomina numeric(18, 2) not null default 0,
  add column aportes_seg_social numeric(18, 2) not null default 0,
  add column aportes_para_fiscales numeric(18, 2) not null default 0,

  -- Sanciones (hoja 'Sanciones')
  add column calcula_sancion_extemporaneidad boolean not null default false,
  add column calcula_sancion_correccion boolean not null default false,
  add column existe_emplazamiento boolean not null default false,
  add column reduccion_sancion text not null default '0'
    check (reduccion_sancion in ('0', '50', '75')),
  add column fecha_vencimiento date,
  add column fecha_presentacion date;

-- Parámetros anuales (UVT, salario mínimo, IPC, etc.)
-- Constantes del año gravable que usan las fórmulas. Vienen de la hoja
-- 'Datos Básicos' del .xlsm.
create table public.parametros_anuales (
  ano_gravable smallint not null,
  codigo text not null,
  valor numeric(18, 4) not null,
  descripcion text,
  primary key (ano_gravable, codigo)
);

alter table public.parametros_anuales enable row level security;
create policy "parametros_read" on public.parametros_anuales for select using (true);

-- Seed con valores del .xlsm 'Datos Básicos'
insert into public.parametros_anuales (ano_gravable, codigo, valor, descripcion) values
  -- AG 2025
  (2025, 'uvt', 49799, 'UVT 2025'),
  (2025, 'reajuste_fiscal', 0.0581, 'Reajuste fiscal 2025'),
  (2025, 'tarifa_impuesto_renta', 0.35, 'Tarifa impuesto renta general'),
  (2025, 'tarifa_renta_presuntiva', 0, 'Tarifa renta presuntiva'),
  (2025, 'salario_minimo', 1423500, 'Salario mínimo 2025'),
  (2025, 'auxilio_transporte', 200000, 'Auxilio de transporte 2025'),
  (2025, 'ipc', 0.051, 'IPC 2025'),
  (2025, 'tasa_interes_presuntivo', 0.0925, 'Tasa interés presuntivo préstamo socios'),
  (2025, 'trm_promedio', 3757.08, 'TRM promedio 2025'),
  -- AG 2024 (para casos previos)
  (2024, 'uvt', 47065, 'UVT 2024'),
  (2024, 'reajuste_fiscal', 0.1097, 'Reajuste fiscal 2024'),
  (2024, 'tarifa_impuesto_renta', 0.35, 'Tarifa impuesto renta general'),
  (2024, 'salario_minimo', 1300000, 'Salario mínimo 2024'),
  (2024, 'auxilio_transporte', 162000, 'Auxilio de transporte 2024'),
  (2024, 'ipc', 0.052, 'IPC 2024'),
  (2024, 'tasa_interes_presuntivo', 0.1269, 'Tasa interés presuntivo préstamo socios'),
  (2024, 'trm_promedio', 4409.15, 'TRM promedio 2024'),
  -- AG 2026 (parámetros conocidos; se ajustan cuando DIAN publique)
  (2026, 'uvt', 52374, 'UVT 2026'),
  (2026, 'tarifa_impuesto_renta', 0.35, 'Tarifa impuesto renta general'),
  (2026, 'salario_minimo', 1750905, 'Salario mínimo 2026'),
  (2026, 'auxilio_transporte', 249095, 'Auxilio de transporte 2026');

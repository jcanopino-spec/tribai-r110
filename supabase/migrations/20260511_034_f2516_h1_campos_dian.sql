-- 034 · F2516 H1 Carátula · campos oficiales DIAN
--
-- Replica la estructura exacta de la hoja "H1 (Caratula)" del modelo110.xlsm
-- oficial. Agrega los 30+ flags de identificación que el MUISCA exige (RTE,
-- cooperativas, financieras, ZOMAC, mega-inversiones, economía naranja,
-- holding colombiana, ZESE, ZF, extracción carbón/petróleo, hidroeléctricas,
-- etc.) más los datos del signatario y representación.

alter table public.formato_2516_h1_caratula
  add column if not exists tarifa_aplicable numeric(5, 4),
  add column if not exists art_aplicable text,
  -- Flags identificación (campos 30-51 del MUISCA)
  add column if not exists pn_sin_residencia boolean not null default false,
  add column if not exists rte boolean not null default false,
  add column if not exists entidad_cooperativa boolean not null default false,
  add column if not exists entidad_sector_financiero boolean not null default false,
  add column if not exists nueva_sociedad_zomac boolean not null default false,
  add column if not exists obras_por_impuestos_zomac boolean not null default false,
  add column if not exists reorganizacion_empresarial boolean not null default false,
  add column if not exists soc_extranjera_transporte boolean not null default false,
  add column if not exists sist_especial_valoracion boolean not null default false,
  add column if not exists costo_inv_juego_inv boolean not null default false,
  add column if not exists costo_inv_simultaneo boolean not null default false,
  add column if not exists progresividad_tarifa boolean not null default false,
  add column if not exists contrato_estabilidad boolean not null default false,
  add column if not exists moneda_funcional_diferente boolean not null default false,
  add column if not exists mega_inversiones boolean not null default false,
  add column if not exists economia_naranja boolean not null default false,
  add column if not exists holding_colombiana boolean not null default false,
  add column if not exists zese boolean not null default false,
  add column if not exists extraccion_hulla_carbon boolean not null default false,
  add column if not exists extraccion_petroleo boolean not null default false,
  add column if not exists generacion_energia_hidro boolean not null default false,
  add column if not exists zona_franca boolean not null default false,
  -- Signatario (campos 89-90, 981-983, 997)
  add column if not exists signatario_nit text,
  add column if not exists signatario_dv text,
  add column if not exists codigo_representacion text,
  add column if not exists codigo_contador_rf text,
  add column if not exists numero_tarjeta_profesional text,
  add column if not exists con_salvedades boolean not null default false,
  add column if not exists fecha_efectiva_transaccion date;

comment on column public.formato_2516_h1_caratula.tarifa_aplicable is
  'Tarifa renta aplicable (Art. 240, 240-1, 19-4) · ej 0.35, 0.20, 0.09, 0.15';
comment on column public.formato_2516_h1_caratula.art_aplicable is
  'Artículo aplicable según tarifa · Art. 240, 240-1, 19-4 240 y 356, etc.';

# Mapa de la lógica tributaria · `tribai-r110` (Next.js)

Inventario por módulo: archivo TS que contiene la lógica + fórmula que implementa + gaps observables. Las rutas son absolutas.

---

## 1. Form 110 cálculos (R36-R114)

- **Engine**: `/Users/jacp/Developer/tribai-r110/src/engine/form110.ts` · funciones: `computarRenglones`, constantes `RENGLONES_COMPUTADOS`, `TARIFA_GANANCIAS_OCASIONALES=0.15`, `TARIFA_ANTICIPO`, `UMBRAL_SOBRETASA_UVT=120000`.
- **Lib loader**: `src/lib/anexos-ctx.ts` (`loadAnexosCtx`) carga totales de **12 anexos** en paralelo y los devuelve como `AnexosCtx` para hacer spread sobre el `ComputeContext`.
- **Página**: `src/app/(app)/empresas/[id]/declaraciones/[declId]/formulario-110/page.tsx` (más `editor.tsx`, `imprimir/`, `validaciones/`).
- **Patrimonio (R36–R46)**: `R44 = Σ(36..43)`, `R46 = max(0, R44 − R45)`.
- **Ingresos (R47–R61)**: `R49..R56` salen del `Anexo 18 dividendos`; `R58 = Σ(47..57)`; `R60 = totalIncrngo` (Anexo 26); `R61 = max(0, R58−R59−R60)`.
- **Costos (R62–R67)**: `R67 = Σ(62..66)`. Sin desglose por R63/R64/R65/R66 calculado (los ingresa el usuario).
- **Renta (R72–R79)**: `R72 = max(0, R61+R69+R70+R71 − R52−R53−R54−R55−R56 − R67−R68)`; `R73` espejo negativo; `R74 = min(totalCompensaciones, R72)`; `R75 = max(0, R72−R74)`; `R76 = anexoRentaPresuntiva`; `R77 = totalRentasExentas`; `R79 = max(R75,R76) − R77 + R78`.
- **GO (R80–R83)**: `R80/R81/R82` vienen de `Anexo 8 + venta_activos_fijos>2a`; `R83 = max(0, R80−R81−R82)`.
- **Liquidación (R84–R114)**:
  - `R84 = max(0,R79) × tarifaRegimen` (loaded de `regimenes_tarifas`).
  - **R85 sobretasa** entidades financieras: `(R79 − 120.000×UVT) × 5%` si ≥ umbral, sólo si `esInstitucionFinanciera=true`. Único umbral implementado.
  - **Dividendos**: `R86=(R51+R55)×20%`, `R88=R56×27%`, `R89=R53×35%`, `R90=R52×33%` (sólo si el usuario no los digitó manualmente). **R87 NO calculado por engine**.
  - `R91 = Σ(84..90)`; `R93 = min(totalDescuentosTributarios, R84×0.75)` (tope Art. 259). `R94 = max(0, R91+R92−R93)`. `R95` viene de TTD (módulo 2). `R96 = R94+R95`. `R97 = R83×15%`. `R99 = max(0, R96+R97−R98)`.
  - `R107 = R105+R106`; `R108` = método 1/2 mín (módulo 3); `R112` = sanciones (módulo 4).
  - `R111 = max(0, R99+R108+R110 − Σ(100..104,107,109))`; `R113 = max(0, R111+R112)`; `R114 = max(0, restas − cargos)`.
- Salida final pasa por `redondearDIAN` (mult. de 1.000).
- **Gaps**: R87 sin fórmula (sólo nota); R63-R66 sin desglose automático desde balance; R71 (renta líquida ECE pasiva) y R78 (renta gravable por activos omitidos) son inputs manuales sin asistente.

## 2. Tasa Mínima TTD (Art. 240 par. 6)

- **Engine**: `src/engine/tasa-minima.ts` · `calcularTasaMinima`, `calcularImpuestoAdicionar`. Constante `TASA_MINIMA = 0.15`.
- **Lib loader**: `src/lib/tasa-minima-inputs.ts` (`loadTasaMinimaInputs`) carga `utilidadContableNeta` y `difPermanentesAumentan` (Σ partidas conciliación `tipo=permanente, signo=mas`).
- **Aplicabilidad**: `src/engine/condicionales.ts::aplicaTTDPorRegimen`.
- **Fórmula**: `ID = max(0, INR + (VAA+R93) − IRP)`; `UD = max(0, UC + DPARL − R60 − VIMPP − R83 − R77 − R74)`; si `UD≤0 → IA=0`; `TTD=ID/UD`; si `TTD<15% → IA = UD×0.15 − ID`. IA se pone en R95.
- **Gaps**: `IRP` (impuesto rentas pasivas ECE) hardcodeado a 0; `VIMPP` depende de input manual no expuesto en UI explícita.

## 3. Anticipo Art. 807

- **Engine**: `form110.ts` (líneas 419–435). No hay módulo dedicado.
- **Fórmula**: si `aniosDeclarando=primero → R108=0`. Si no:
  - `metodo1 = max(0, ((R96 + impuestoNetoAnterior)/2) × tarifaAnios − R107)`
  - `metodo2 = max(0, R96 × tarifaAnios − R107)`
  - `R108 = round(min(m1, m2))`
- Tarifas: `{primero:25%, segundo:50%, tercero_o_mas:75%}`.
- **Gap**: usa `R96` (no `R94`); el .xlsm oficial debate si la base es R94 o R96 — verificar; no hay opción para forzar metodo1/metodo2 manualmente.

## 4. Sanciones

- **Engine**: `src/engine/sanciones.ts` · `calcularSancionExtemporaneidad`, `calcularSancionCorreccion`. Constante `SANCION_MINIMA_UVT=10`.
- **Extemporaneidad (Art. 641/642)**: tres ramas según haya impuesto > ingresos > patrimonio. 641: `5% mes × imp` cap 100%; o `0.5%×ingresos` cap 5% / 2.500 UVT; o `1%×patrimonio` cap 10% / 2.500 UVT. 642 (con emplazamiento): tarifas dobles (10%/1%/2%) y caps mayores (10.000/5.000 UVT). Mínimo 10 UVT.
- **Corrección (Art. 644)**: 10% sin / 20% con emplazamiento × `mayorValor`.
- **Reducción Art. 640**: factor `1 − reduccion/100` aplicado siempre antes del piso de mínima.
- **Gap**: la sanción mínima 10 UVT se aplica como piso AUNQUE base sea 0; el .xlsm oficial sólo activa la mínima cuando hay base > 0. El cap de 100% en Art. 641 con impuesto no contempla tope de 5.000 UVT cuando hay saldo a favor (caso menos común pero existe).

## 5. Conciliación de utilidad

- **Página**: `src/app/(app)/empresas/[id]/declaraciones/[declId]/conciliacion-fiscal/page.tsx` (línea 116-353 lógica).
- **Partidas automáticas**: ICA 50%, INCRNGO (signo menos), recuperación deducciones, donaciones×4, **GMF 50%** (Art. 115), **deterioro de cartera** (provisión fiscal por método general/individual/combinado vs saldo contable), **interés presuntivo** (saldo×tasaIntPres×días/360 − registrado), **subcapitalización** (excedente sobre 2× patrimonio liq. anterior, Art. 118-1), **diferencia en cambio** (USD×TRMfin − USD×TRMini), y ajustes desde **balance fiscal** (líneas con ajuste_debito/credito en cuentas 4/5/6/7).
- **Cuadre**: `rentaCalculada = utilidadContable + netoPerm + netoTemp` vs `R72`; si `|diff|<1` cuadra.
- **Gaps**: las "donaciones × 4" asume tarifa fija 25% (heurística); sanciones DIAN se dejan manuales (TODO en el código); el deterioro combinado usa `max(provGen, provInd)` y no la fórmula precisa del .xlsm; ajustes balance no diferencian permanentes vs temporales (todos van a `permanente`).

## 6. Conciliación patrimonial (Art. 236)

- **Página**: `src/app/(app)/empresas/[id]/declaraciones/[declId]/conciliacion-patrimonial/page.tsx`.
- **Fórmula**:
  - Diferencia = `max(0, R46 + desvalorizaciones − valorizaciones − PL_anterior)`.
  - Rentas ajustadas = `max(0, R75 + R77 + R60 + R83 + normalizacion − saldo_pagar_anterior − R107)`.
  - Renta por comparación = 0 si primera vez; sino `max(0, diferencia − rentas_ajustadas)`.
- Partidas manuales: tabla `conciliacion_patrimonial_partidas` filtradas por keyword (valorizaci, desvalorizaci, normalizaci).
- **Gap**: el resultado NO se inyecta automáticamente al R78 ni al F110; queda informativo. Detección manual-por-keyword es frágil.

## 7. Impuesto Diferido NIC 12

- **Engine**: `src/engine/impuesto-diferido.ts` (16 categorías) y/o `src/engine/f2516-h4.ts` (14 categorías alternativas). Coexisten dos modelos.
- **Página**: `.../conciliaciones/impuesto-diferido/page.tsx`.
- **Fórmula activos**: `c<f → deducible=f−c`; `c>f → imponible=c−f`. Pasivos invertidos. `idActivo = round(deducible×tarifa,-3)`. `idPasivo = round(imponible×tarifa,-3)`. Neto = `Σid_pasivo − Σid_activo`.
- Tarifa default 35%; usa la del régimen de la empresa si está configurada.
- **Gap**: hay dos catálogos paralelos (`ID_CATEGORIAS` 16 ítems en `impuesto-diferido.ts` y `F2516_H4_CATEGORIAS` 14 ítems en `f2516-h4.ts`) — duplicación. Las 9 categorías de activos del primero mapean al F2516; las 7 de pasivos no tienen origen automático desde balance (input manual).

## 8. Anexo Dividendos (R49–R56 → R86–R90)

- **Página**: `.../anexos/dividendos/`. Loader: `loadAnexosCtx` agrega 8 columnas DB por categoría a `dividendos.r49..r56`.
- **Cómputo**: ver módulo 1 R86/R88/R89/R90.
- **Gap**: no implementa el cómputo de dividendos no gravados Art. 49 num. 3 (parte que va a R49/R50/R52/R54 vs gravada que va a R51/R55) — el usuario clasifica manualmente al digitar.

## 9. Anexo Descuentos (R93 con tope 75%)

- **Página**: `.../anexos/descuentos/page.tsx` + `consts.ts` con 3 categorías (impuestos_exterior, donaciones, otros) y plantillas Art. 254/256/257.
- **Tope 75% Art. 259**: aplicado en `form110.ts` (`v.set(93, min(total, R84×0.75))`) y validado en `validarCuadresF110` V14.
- **Suma con IVA bienes capital** (Art. 258-1): `loadAnexosCtx` suma `anexo_iva_capital.iva_pagado` al total.
- **Gap**: el tope 75% se aplica al total agregado, no por categoría — Art. 259 tiene topes especiales por concepto que no se diferencian aquí.

## 10. Anexo Rentas Exentas (R77, Art. 235-2)

- **Página**: `.../anexos/rentas-exentas/page.tsx` + `consts.ts` con catálogo Art. 235-2 numerales 1–8 + CAN/Decisión 578.
- **Cómputo**: `Σ(valor_fiscal)` → R77 directo.
- **Gap**: no aplica límites del 10% de la renta líquida (Art. 235-2 par. 5) — todas las rentas exentas se restan al 100%.

## 11. Anexo Ganancia Ocasional (R80–R83)

- **Página**: `.../anexos/ganancia-ocasional/` y `.../anexos/venta-activos-fijos/`.
- **Cómputo** en `loadAnexosCtx`:
  - GO base: Σ precios_venta, Σ costos_fiscal, Σ no_gravada.
  - Venta activos fijos >2 años: `costo = costo_fiscal − depreciacion + reajustes_fiscales` (forzado ≥0). Suma a GO.
- **Gap**: no se computan exenciones específicas (vivienda 7.500 UVT Art. 311-1, indemnizaciones por seguros, herencias 3.490 UVT) — el usuario las captura como `no_gravada` manualmente.

## 12. Anexo Compensaciones (pérdidas fiscales R74)

- **Página**: `.../anexos/compensaciones/`. Tabla guarda `tipo` (perdida|exceso_rp), `ano_origen`, `perdida_original`, `compensar`.
- **Cómputo**: `Σ(compensar)` → R74, aplicando `min(total, R72)` en engine.
- **Validación V16**: `R74 ≤ perdidasAcumuladas` (input manual, no automatizado).
- **Gap**: no valida el plazo de 12 años (Art. 147 después de Ley 1819) ni el ajuste por reajuste fiscal de pérdidas anteriores.

## 13. Validaciones cruzadas V1–V18

- **Engine**: `src/engine/validaciones.ts` (~590 líneas). Tres funciones: `validarFormulario` (~25 reglas heurísticas/fiscales), `validarF2516` (cuadre F2516↔F110), `validarCuadresF110` (V1, V2, V7..V12, V14, V16, V18 + V cuadre R96/R91/R99).
- **Cobertura V1–V18**: implementadas **V1, V2, V7, V8, V9, V10, V11, V12, V14, V16, V18** (11 de 18). Faltan: V3, V4, V5, V6, V13, V15, V17. Tolerancia `TOLERANCIA_CUADRE = 1000`.
- **Gap**: V3-V6, V13, V15, V17 no existen — probable que cubran cruces específicos del .xlsm (anexo donaciones, anexo conciliación, anexo precios transferencia) que no están migrados.

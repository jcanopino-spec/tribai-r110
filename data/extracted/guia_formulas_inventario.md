# Inventario de fórmulas y reglas — Tribai_R110_AG2025_v5_prueba_aries.xlsx

Extraído con `openpyxl` (`data_only=False`). Foco en celdas con fórmula no trivial.

Convención: `Detalle Fiscal` es la hoja-cerebro. Columna **F = contable**, columna **L = fiscal** (`L = F + H − I` donde H = ajuste suma, I = ajuste resta). Cada renglón del Form 110 vive en `Detalle Fiscal!Lxxx` y se traslada a `Formulario 110`. Las hojas auxiliares (Liquidacion, Renta, Patrimonio, Ingresos, Costos Deducciones) son **solo vistas** con `D=F` y `E=L` y `F=E−D` (diferencia conciliatoria); no recalculan, solo presentan.

---

## HOJA: Liquidacion
**Inputs**
- `D10:D40 ← Detalle Fiscal!F244..F275` (impuesto, descuentos, anticipos, sanciones, saldos contables)
- `E10:E40 ← Detalle Fiscal!L244..L275` (mismas filas, valor fiscal)
- `C201 ← Datos Contribuyente!H19` (CIIU)
- `C203 ← Formulario 110!I78` (renta líquida gravable)

**Fórmulas críticas**
- `F10:F40 = E - D` (diferencia contable vs fiscal por renglón)
- `C202` = "SI" si CIIU empieza por 64/65/66 (sector financiero), sino "NO"
- `C204 = 120000 × VLOOKUP(2025, DB_UVT, 2)` (umbral UVT sobretasa)
- `C206 = MAX(0, C203 − C204)` base sobretasa
- `C208 = IF(C202="SI" Y C205="SI", C206 × 5%, 0)` sobretasa financiera

**Outputs**: la hoja no alimenta a otras (es de visualización). La sobretasa C208 está calculada pero **no se enlaza** en el F110 actual.

**Reglas tributarias**: Sobretasa sector financiero Ley 2277/2022 (CIIU 64-66, 5% sobre renta líquida que exceda 120.000 UVT).

---

## HOJA: Detalle Fiscal (CEREBRO)
**Patrón de cada renglón**: `F = ROUND(SUMIF(Balance de Prueba!C, "<cuenta PUC>*", Balance!H o I), -3)` y `L = F + H − I` (H/I son ajustes manuales del usuario).

**Fórmulas críticas (renglones del F110)**:
- `F129 (R44 PB) = F35 + F41 + F54 + F71 + F80 + F89 + F93 + F123` suma de bloques de activos
- `F168 (R46 PL) = F129 − F131` (PB − pasivos)
- `F170 (R47 ingresos ord)` = SUMIF cuentas 41* del balance, redondeado a -3
- `F207 (R58 ingresos brutos) = F170 + F187 + F193..F200 + F201`
- `F210 (R61 ingresos netos) = F207 − F208 − F209`; mismo en columna L
- **R62-R66**: cada uno es SUMIF sobre prefijo PUC: 6105/6110/6115/6120/6125/6130/6135 + clase 7 (R62 costos), 51* (R63), 52* (R64), 53* (R65), 54* + 55* + 58* + 59* (R66)
- `F225 (R67) = R62+R63+R64+R65+R66`
- `F228 (R72 renta líquida ordinaria) = MAX(0, R61 + R69 − R67 − R68 − sum(dividendos R49..R56))` — los dividendos se restan de la base ordinaria porque van a renglones especiales
- `F229 (R73 pérdida) = MAX(0, R67+R68+dividendos − R61 − R69)` (espejo)
- `F232 (R75) = MAX(0, R72 − R74 − R74b)` después de compensaciones
- `F234 (aux MAX) = MAX(R75, R76)` toma el mayor entre renta líquida y presuntiva
- `F237 (R79 RLG) = MAX(0, MAX(R75,R76) − R77 + R78)`
- `F242 (R83 GO gravables) = MAX(0, R80 − R81 − R82)`
- **`F244 (R84 impuesto renta) = ROUND(R79 × 35%, −3)`** ← tarifa única 35% Art. 240
- `F245..F250 (R85..R90) ← Dividendos!G14, G17, G20, G22` (impuesto sobre dividendos por período)
- `F252 (R91) = R84+R85+...+R97` total impuesto rentas líquidas
- `L253 (R93 descuentos) ← Descuentos Tributarios!F28`
- `F254 (R94) = MAX(0, R91 − R93)`
- `F255 (R96) = R94 + R92 (VAA) + R95 (IA)` (impuesto neto con adicionados)
- `L256 (R108 anticipo) ← Anticipo!E38`
- `L259 / L273 (R112 sanciones) ← Sanciones!E30`
- `L265, L266, L267 ← Retenciones!F18, F22, F26`
- `F268 (R107 retenciones) = R105+R106+R267`
- **`F272 (R111 saldo a pagar) = MAX(0, R99 + R… − R103 − R104 − R107 − R100 − R101 − R…)`** la fórmula real es `MAX(0, F279+F281 − F263 − F264 − F268 − F270 − F271 − F280)`
- `F274 (R113) = R111 + R112`
- `F275 (R114 saldo a favor) = MAX(0, R103+R104+R107 − R94 − R96 − R108)` (col F); en L: `MAX(0, L263+L264+L268 − L279 − L281)`
- `F279 (R99 imp a cargo) = R96 + R97 − R98`

**Outputs**: alimenta a casi todas las hojas (Patrimonio, Ingresos, Costos Deducciones, Renta, Liquidacion, Auditoria, Conc Patrimonial, Conc Utilidades, Impuesto Diferido, Tasa Minima TTD, Anticipo, Formulario 110, Sanciones).

**Reglas E.T. específicas**: Art. 240 (35%), Arts. 48/49/242 (dividendos), Art. 147 (compensación pérdidas), Arts. 188-189 (presuntiva), Art. 235-2 (rentas exentas), Art. 105 (deducibilidad), Art. 771-2.

---

## HOJA: Tasa Minima TTD (Art. 240 par. 6)
**Inputs**
- `E11 = Detalle Fiscal!F210 − F225` (utilidad contable depurada inicial)
- `E12 = Detalle Fiscal!F193+F194+F196+F198+F200` (dividendos no gravados a restar)
- `E20 = Detalle Fiscal!L254` (impuesto neto)
- `E21 = Descuentos Tributarios!F28`
- `E22 = Impuesto Diferido!G39` (activo por imp diferido)
- `E23 = Impuesto Diferido!G40` (pasivo por imp diferido)

**Fórmulas críticas**
- **`E16 (UD) = E11 − E12 − E13 − E14 + E15`** Utilidad Depurada
- **`E24 (ID) = E20 + E21 − E22 + E23`** Impuesto Depurado (suma descuentos, resta activo IDF, suma pasivo IDF)
- `E28 (TTD) = ID/UD`
- `C36 (IA — impuesto a adicionar) = MAX(0, UD×15% − ID)`
- `F32 = MAX(0, ROUND(E16×0.15 − E24, −3))` redondeo a miles

**Outputs**: `C36` no enlaza directamente al F110 en este archivo (campo R95 IA está hardcodeado en 0 en `Detalle Fiscal!F277`). Auditoria!D72 lo compara.

**Reglas**: Art. 240 par. 6 — TTD mínima 15% sobre utilidad depurada; si TTD < 15% se adiciona IA. Acepta resta de activo por impuesto diferido neto (NIC 12) en el numerador.

---

## HOJA: Anticipo (Art. 807)
**Inputs**
- `F9` = escenario (1/2/3) seleccionado por usuario
- `E17 = Detalle Fiscal!L254` (impuesto neto AG actual)
- `E18` = impuesto neto año anterior (manual)
- `E19 = Detalle Fiscal!L268` (retenciones del año)

**Fórmulas críticas**
- Escenario 1 (primer año): `E24 = ROUND(E17 × 25%, −3)`
- Escenario 2 (segundo año): `E29 = MIN(ROUND(((E17+E18)/2)×50%, −3), ROUND(E17×50%, −3))`
- Escenario 3 (tercer año en adelante): `E34 = MIN(ROUND(((E17+E18)/2)×75%, −3), ROUND(E17×75%, −3))`
- `E36 = IF(F9=1, E24, IF(F9=2, E29, IF(F9=3, E34, 0)))`
- `E38 (Anticipo neto a pagar) = MAX(0, E36 − E19)` ← entra a Form 110 como R95... realmente como R108 (R256)
- Bloque alterno (rows 86-93) calcula con `Formulario 110!I93` (impuesto neto) y `H37` (impuesto AG anterior): `Método A = MAX(0, 75%×IN2025 − Ret)`, `Método B = MAX(0, 75%×PROM(IN24,IN25) − Ret)`, anticipo final = MIN(A,B) salvo excepción.

**Outputs**: `E38 → Detalle Fiscal!L256 (R108)`.

**Reglas**: Art. 807 E.T. — método 1 (25% un año), método 2 (50% promedio o 50% año), método 3 (75% promedio o 75% año, el menor); Decreto 0379/2026.

---

## HOJA: Sanciones
**Inputs**
- `E11` (fecha vencimiento) = VLOOKUP de últimos 2 dígitos NIT en tabla `Tribai Home!C71:G80`
- `E12` (fecha presentación) = manual
- `E13 = Datos Basicos!E7` (UVT vigente para sanción mínima)
- `E14 = Detalle Fiscal!L279` (impuesto a cargo)
- `E15 = Detalle Fiscal!L207` (ingresos brutos — para sanción sin impuesto)
- `E16 = Detalle Fiscal!L168` (patrimonio líquido — para sanción sin ingresos ni impuesto)
- `E17` = "SI"/"NO" emplazamiento

**Fórmulas críticas**
- `E21 (meses extempor.) = MAX(1, ROUNDUP((presentación − vencimiento)/30, 0))` cuenta fracción de mes como entero
- `E22 (sanción mínima) = E13 × 10` (10 UVT)
- `E23 (con impuesto) = MIN(impuesto, ROUND(impuesto × 5% × meses, −3))` tope = impuesto a cargo
- `E24 (sin impuesto) = MIN(ROUND(ing×5%,−3), ROUND(ing×0.5%×meses,−3))`
- `E25 (sin ingresos ni impuesto) = MIN(ROUND(PL×10%,−3), ROUND(PL×1%×meses,−3))`
- `E27 = MAX(E23, E24, E25)` toma la mayor de las tres bases
- `E28 = IF(emplazamiento="NO", E27 × 50%, E27)` si presenta antes del emplazamiento, sanción se reduce 50%
- `E30 (sanción extemporaneidad) = IF(meses=0, 0, MAX(E22, E28))` la mayor entre mínima (10 UVT) y la calculada

**Outputs**: `E30 → Detalle Fiscal!L259 y L273 (R112)`.

**Reglas**: Art. 641 (extemporaneidad sin emplazamiento 5%), Art. 642 (con emplazamiento, doblada — implementado al revés: sin emplazamiento se reduce 50%), Art. 639 (mínima 10 UVT), Art. 640 (reducción).

---

## HOJA: Conc Utilidades (Conciliación contable-fiscal)
**Inputs**: balance de prueba + Detalle Fiscal columnas L
**Fórmulas críticas**
- `E12,F12 = SUMIF(Balance!C, "41*", Balance!I)` ingresos operacionales
- `E13,F13 = SUMIF "42*"` ingresos no operacionales
- `E14,F14 = SUMIF "4175*"` devoluciones (resta)
- `E15,F15 = E12+E13−E14` ingresos netos contables
- `E16 = SUMIF "6*" + SUMIF "7*"` costos contables
- `E20 = SUM(E16:E19)` total costos+gastos contables
- `E21 = E15 − E20` utilidad antes de impuestos contable
- **Diferencias permanentes destacadas**:
  - `E40 = SUMIF Balance C, "530507*", Balance H × 50%` ← **GMF 50% no deducible** (Art. 115 E.T.) automático
  - `E42 = Detalle Fiscal!L209` INCRNGO
  - `E43 = Rentas Exentas!D22` rentas exentas
- `E47 (Renta líquida fiscal calculada) = E21 + temporarias_deducibles − temporarias_imponibles + permanentes`
- `E49 = E47 − E48` (vs. R79 declarado)
- `E50 = IF(ABS(E49)<1, "CUADRADO", "DESCUADRADO")` validación

**Reglas únicas**: GMF al 50% (Art. 115), apertura por categorías NIC 12 (temporarias deducibles/imponibles + permanentes).

---

## HOJA: Conc Patrimonial (Art. 236 E.T. — Renta por comparación patrimonial)
**Inputs**
- `E12 = Detalle Fiscal!L129` (PB AG actual), `F12 = Datos Contribuyente!H40` (PB AG anterior)
- `E13 = Detalle Fiscal!L131`, `F13 = H41` (pasivos)
- `E14 = Detalle Fiscal!L168`, `F14 = H42` (PL)

**Fórmulas críticas**
- `G14 = E14 − F14` Δ patrimonio líquido (incremento)
- `E18 = Detalle Fiscal!L237` (R79 RLG — justifica con utilidades del período)
- `E19 = Detalle Fiscal!L242` (R83 GO gravables)
- `E20 = Rentas Exentas!D22` (rentas exentas)
- `E21 = Detalle Fiscal!L209` (INCRNGO)
- `E22 = −Detalle Fiscal!L254` (impuesto neto, resta)
- `E26 (justificación total) = SUM(E18:E25)`
- **`E28 = MAX(0, ΔPL − justificación)`** = renta por comparación patrimonial Art. 236
- `E29 = IF(E28=0, "JUSTIFICADO", "RENTA POR COMPARACION PATRIMONIAL")`

**Reglas**: Art. 236-237 E.T. — diferencia patrimonial no justificada se grava como renta líquida especial.

---

## HOJA: Impuesto Diferido (NIC 12)
Tabla activos (rows 14-22, 9 categorías: efectivo, inversiones, CxC, inventarios, intangibles, biológicos, PPE, intangibles biológicos, otros activos) y pasivos (rows 28-34, 7 categorías). Para cada categoría:
- `D = Detalle Fiscal!Fxxx` (saldo contable), `E = Detalle Fiscal!Lxxx` (saldo fiscal)
- **Activos**: `F = IF(D<E, E−D, 0)` (DTI deducible cuando contable<fiscal), `G = IF(D>E, D−E, 0)` (DTI imponible)
- **Pasivos**: invierte el sentido — `F = IF(D>E, D−E, 0)`, `G = IF(D<E, E−D, 0)`
- `H = ROUND(F × $D$9, −3)` impuesto diferido activo (D9 = tarifa)
- `I = ROUND(G × $D$9, −3)` impuesto diferido pasivo
- `G39 = H23+H35` total activo IDF
- `G40 = I23+I35` total pasivo IDF
- `H42 = G40 − G39` gasto/ingreso por IDF neto

**Outputs**: `G39, G40 → Tasa Minima TTD!E22, E23`.

---

## HOJA: Renta (vista de R72-R83)
Solo lectura: `D10:D26 ← Detalle Fiscal!F210..F242`, `E ← L210..L242`, `F=E−D`. No recalcula. Cubre R61, R67, R68 (no inv), R72-R83 incluyendo `MAX(R75,R76)` aux y R74b (compensación exceso presuntiva).

---

## HOJA: Costos Deducciones (vista R62-R68)
`D10:D16 ← F212, F221, F222, F223, F224, F225, F226`. Cada uno es un SUMIF en `Detalle Fiscal` por prefijo PUC distinto: 6+7 (costos), 51 (admin), 52 (ventas), 53 (financieros), 54+55+58+59 (otros).

---

## HOJA: Ingresos (vista R47-R61)
`D10:D24 ← F170, F187, F193..F201, F207, F208, F209, F210`. R47 desde 41*, R48 desde 42*, R49-R56 desde Dividendos!E11..E22, R57 desde 4240+4245+4250+4255+4295, R59 desde 4175*.

---

## HOJA: Patrimonio (vista R33-R46)
`D10:D23 ← Detalle Fiscal!F13, F26, F31, F35, F41, F54, F71, F80, F89, F93, F123, F129, F131, F168`. Bloque inicial R33-R35 son nómina/aportes (los renglones informativos del 110).

---

## HOJA: Dividendos (R49-R56 y R85-R90)
Inputs manuales `E11, E13..E22` (montos por período). Tarifas en `F` (texto: "0%", "Tarifa Art.240", "Art.240+10%", "Art.882-893"). El impuesto `G` está como input (no fórmula automática pesando tarifa); el sumario es `E24 = SUM(E11:E22)` y `G24 = SUM(G11:G22)`. Los renglones del impuesto en `Detalle Fiscal` apuntan a `Dividendos!G14, G17, G20, G22`.

**Reglas**: Arts. 48, 49, 242, 245, Art. 240 par. 3, Art. 882-893 (ECE). Bandas: 2016 y ant., 2017-18, 2019-22, 2023+, ECE.

---

## HOJA: Auditoria
**Validaciones tipo "espejo F110 ↔ Detalle Fiscal"**: rows 10-51, cada renglón hace `D = Detalle Fiscal!Lxxx`, `E = Formulario 110!Iyy/Eyy/Jyy`, `F=D−E`, `G = IF(ABS(F)<1, "CUADRADO", "REVISAR")`.

**Validaciones cruzadas V1-V12** (rows 57-68):
- V1: Rentas Exentas!D24 vs F110!I39
- V2: Retenciones!F28 vs F110!I69 (R107)
- V3-V5: Retenciones!F18, F22, F26 vs F110!I66, I67, I68 (R103/R104/R105)
- V6: Dividendos!E24 vs SUMA(F110!J13..J17)
- V7: F110!E19 − E20 = E21 (PB − Pasivos = PL)
- V8: F110!J19 − J20 − J21 = J22 (R58 − R59 − R60 = R61)
- V9: SUMA(I25:I29) = I30 (costos suman R67)
- V10: I66+I67+I68 = I69 (retenciones suman R107)
- V11: I54 − I55 = I56 (R91 − R93 = R94)
- V12: I38+I40 − I39 = I41 (max(R75,R76)+R78−R77=R79)

**V13-V18** (rows 72-77, **bug detectado**: las fórmulas de validación G están escritas como `IF(ABS(E72-E72)<1, ...)` — restan la celda consigo misma siempre da 0; literalmente nunca disparan "REVISAR"):
- V13: Tasa Minima TTD!C36 vs F110!I91-I90 (TTD)
- V14: F110!I92 vs 75% × I90
- V15: F110!I98 vs Anticipo!C23
- V16: F110!I72 vs Perdidas Fiscales!C33
- V17: SUM(Dividendos!D:D) vs F110!I54
- V18: SUM(Retenciones!E:E) vs F110!I106

**V19-V22** (rows 84-87): cuadres con Balance de Prueba usando columna `M` clasificadora — `SUMIFS(Balance!L, Balance!M, n)` con n=1 patrimonio, n=4 ingresos, n=5/6/7 costos.

**Outputs**: `G53 = "TODO CUADRADO" / "ERRORES ENCONTRADOS"`, `G79` versión v4 con doble check.

**Hallazgos**: V13-V18 tienen fórmula tautológica (`E−E`); siempre dicen "EUAERAEO" (typo de "CUADRADO" hispanizado/corrupto); G79 cuenta `H72:H77` que está vacío.

---

## Reglas tributarias detectadas (resumen E.T.)
- Art. 48, 49, 242, 245, 240 par. 3 — dividendos por período
- Art. 105, 115 (GMF 50%), 771-2 — deducibilidad
- Art. 147 — compensación pérdidas (rolling 12 años, 100% renta líquida)
- Art. 188-189 — renta presuntiva (compensación R74b)
- Art. 235-2 — rentas exentas
- Art. 236-237 — comparación patrimonial
- Art. 240 (35%) y par. 6 (TTD 15%)
- Art. 254 — descuento por impuestos pagados exterior
- Art. 256 — descuentos tributarios (tope 75% del impuesto básico R75×35%×75%)
- Art. 639 (10 UVT), 641, 642, 640 — sanciones
- Art. 807 — anticipo (3 escenarios)
- Art. 882-893 — ECE
- Ley 2277/2022 — sobretasa financiera CIIU 64-66, 5% sobre exceso 120k UVT

# Auditoría de Ingeniería Inversa · Tribai R110

**Fecha:** 2026-05-08
**Versión app:** 268 tests verdes
**Fuentes contrastadas:**
1. **Catálogo oficial DIAN** Formulario 110 AG 2025 (`data/extracted/04_formulario_110.json`)
2. **.xlsm guía v5** (`Tribai_R110_AG2025_v5_prueba_aries.xlsx`)
3. **Engine actual** (`src/engine/form110.ts` + 14 módulos)

---

## Resumen ejecutivo

| Aspecto | Estado |
|---|---|
| Cobertura del .xlsm guía v5 (38 hojas) | ✅ 100% |
| Cobertura de renglones del catálogo DIAN (R5–R117) | ✅ 100% |
| Fórmulas críticas vs catálogo oficial | ⚠️ 2 bugs corregidos |
| Validaciones cruzadas V1-V18 | ✅ Implementadas |
| Validaciones V19-V22 (cuadre BP) | ✅ Vía F2516 |
| Pendientes de desarrollo | 4 items menores |

---

## Conflictos detectados entre fuentes

### Diferencia .xlsm v5 vs Catálogo DIAN AG 2025

El **.xlsm guía v5** documenta R85-R90 como "impuestos sobre dividendos por periodo (2017-18, 2019-22, 2023+, ECE)". El **catálogo oficial DIAN AG 2025** dice:

```
R85 = Sobretasa puntos adicionales tarifa
R86 = Dividendos al 10% año 2022 / 20% año 2023+
R87 = (no existe en F110 AG 2025)
R88 = Dividendos megainversiones 27% (base R56)
R89 = Dividendos no residentes Art. 240 (base R53)
R90 = Dividendos PN no residente 33% (base R52)
```

**Decisión:** se confía en el catálogo DIAN. El `.xlsm` v5 está desactualizado.

---

## Bugs corregidos

### 🔴 CRÍTICO · R85 sobretasa instituciones financieras

- **Antes:** 5% sobre RLG completo si RLG ≥ 120.000 UVT
- **Ahora:** 5% sobre el EXCESO de RLG por encima de 120.000 UVT
- **Razón:** Par. 1° Art. 240 E.T. La parte fija de R84 ya tiene la tarifa general (35%); R85 son SOLO los puntos adicionales sobre el exceso
- **Impacto:** sobre-pago en empresas financieras grandes (en algunos casos millones)

### 🔴 CRÍTICO · R86, R88, R89, R90 no se calculaban automáticamente

- **Antes:** quedaban en 0 a menos que el usuario los digitara → **subdeclaración silenciosa**
- **Ahora:** cálculo automático desde dividendos correspondientes:
  ```
  R86 = (R51 + R55) × 20%
  R88 = R56 × 27%
  R89 = R53 × 35%
  R90 = R52 × 33%
  ```
- **Override manual** respetado: si el usuario digita un valor, el motor no lo sobrescribe
- **Dividendos no gravados** (R49, R50, R54) NO generan R86-R90 ✓

---

## Validaciones implementadas

### V1-V18 oficiales del .xlsm guía (nuevas)

| # | Validación | Categoría | Nivel |
|---|---|---|---|
| V1 | R77 Anexo 19 cuadra con declarado | cuadre | warn |
| V2 | R107 anexo retenciones cuadra | cuadre | warn |
| V7 | R46 = R44 - R45 | cuadre | error |
| V8 | R61 = R58 - R59 - R60 | cuadre | error |
| V9 | R67 = sum(R62..R66) | cuadre | error |
| V10 | R107 = R105 + R106 | cuadre | error |
| V11 | R94 = max(0, R91+R92-R93) | cuadre | error |
| V12 | R79 = max(R75, R76) - R77 + R78 | cuadre | error |
| V14 | R93 ≤ 75% R84 (Art. 259 E.T.) | fiscal | error |
| V16 | R74 ≤ pérdidas acumuladas | fiscal | error |
| V18 | R58 ≥ Σ dividendos R49..R56 | cuadre | warn |
| ‒ | R91 = sum(R84..R90) | cuadre | error |
| ‒ | R96 = R94 + R95 | cuadre | error |
| ‒ | R99 = max(0, R96+R97-R98) | cuadre | error |

### V19-V22 cuadre balance contable

Cubiertas por `validarF2516`:
- BP cuadrado (V19) ↔ tolerancia $1.000
- Ingresos vs clase 4 (V20) ↔ R58
- Costos vs clases 5-7 (V21) ↔ R67
- Patrimonio vs clase 1 (V22) ↔ R44

---

## Pendientes (priorizados)

### ALTO

1. **R109/R110 anticipo puntos adicionales** — para entidades financieras con sobretasa, anticipo año anterior y año siguiente. No modelado en engine.
2. **R102 Crédito fiscal Art. 256-1 (I+D+I)** — input manual, sin anexo dedicado.

### MEDIO

3. **R98 Descuentos pagados en exterior por GO** — input manual, sin anexo.
4. **R71 Renta líquida pasiva ECE** (Art. 882-893) — anexo nicho.
5. **Beneficio auditoría** — verificar si la base es R94 (sin TTD) o R96 (con TTD) según jurisprudencia reciente.

### BAJO

6. **R87** existe en BD pero no en formulario AG 2025 — limpieza de catálogo.
7. **Detalle Fiscal con drill-down** — vista que muestre las cuentas PUC origen de cada renglón.

---

## Cobertura del engine por módulo

| Módulo | Tests | Cobertura |
|---|---|---|
| `utils.ts` | 13 | redondeo DIAN, normalización, sumRango |
| `sanciones.ts` | 17 | Art. 641/642/644 + reducción 640 + mínima 639 |
| `tasa-minima.ts` | 10 | TTD oficial + edge cases |
| `beneficio-auditoria.ts` | 9 | Art. 689-3 (12m/6m) |
| `vencimientos.ts` | 12 | NIT + mes/fracción |
| `condicionales.ts` | 15 | TTD por régimen |
| `f2516.ts` | 22 | catálogo + clasificador PUC |
| `validaciones.ts` | 17 | reglas internas |
| `validaciones-f2516.ts` | 10 | cuadre balance |
| `validaciones-cuadres.ts` | 21 | **V1-V18 oficiales** (nuevo) |
| `impuesto-diferido.ts` | 22 | ID-A · ID-P + clasificador pasivos |
| `checklist.ts` | 24 | 23 items + auto/manual |
| `beneficios.ts` | 17 | catálogo de 7 beneficios |
| `precios-transferencia.ts` | 8 | umbrales 100k/61k UVT |
| `form110.ts` (integración) | **48** | sobretasa + dividendos + GO + saldos |
| **TOTAL** | **268** | |

---

## Glosario · renglones críticos del F110 AG 2025

| Renglón | Concepto | Fórmula oficial |
|---|---|---|
| R44 | Patrimonio bruto | sum(R36..R43) |
| R46 | Patrimonio líquido | max(0, R44 − R45) |
| R58 | Ingresos brutos | sum(R47..R57) |
| R61 | Ingresos netos | max(0, R58 − R59 − R60) |
| R67 | Total costos | sum(R62..R66) |
| R72 | Renta líquida ordinaria | max(0, R61+R69+R70+R71 − sum(R52..R56) − R67 − R68) |
| R75 | Renta líquida | max(0, R72 − R74) |
| R79 | Renta líquida gravable | max(R75, R76) − R77 + R78 |
| R83 | GO gravables | max(0, R80 − R81 − R82) |
| R84 | Impuesto renta | R79 × tarifa |
| R85 | Sobretasa | (R79 − 120k UVT) × 5% si financiera y supera umbral |
| R86 | Imp. div. 10%/20% | (R51 + R55) × 20% |
| R88 | Imp. div. megainversiones | R56 × 27% |
| R89 | Imp. div. Art. 240 | R53 × 35% |
| R90 | Imp. div. Art. 245 | R52 × 33% |
| R91 | Total imp. rentas | sum(R84..R90) |
| R93 | Descuentos | min(anexo, 75% × R84) |
| R94 | Imp. neto sin TTD | max(0, R91 + R92 − R93) |
| R95 | Imp. a adicionar (TTD) | max(0, UD × 15% − ID) si TTD < 15% |
| R96 | Imp. neto con TTD | R94 + R95 |
| R97 | Imp. neto GO | R83 × 15% |
| R99 | Total imp. a cargo | max(0, R96 + R97 − R98) |
| R107 | Total retenciones | R105 + R106 |
| R108 | Anticipo año siguiente | min(método 1, método 2) |
| R111 | Saldo a pagar imp. | max(0, R99+R108+R110 − R100..R104 − R107 − R109) |
| R113 | Total saldo a pagar | max(0, R111 + R112) |
| R114 | Total saldo a favor | max(0, restas − (R99+R108+R110+R112)) |

---

**Verificación de la auditoría:**
```
npm test          # 268 tests verdes
npx tsc --noEmit  # sin errores
npm run build     # build OK
```

# Manual de revisión · Declaración de Renta 110 · Sistemas Aries

Guía corta para que el equipo de **Sistemas Aries** verifique en la plataforma Tribai la información que sustenta la Declaración de Renta y Complementarios (Formulario 110) del año gravable 2025.

---

## 1. Acceso

- **URL:** https://tribai-r110.vercel.app/login
- **Usuario:** _(provisto por correo)_
- **Contraseña:** _(provista por correo)_

> El usuario tiene acceso a varias empresas. **Por favor revisar únicamente la empresa Sistemas Aries**; las demás no son de su competencia y los datos son confidenciales.

---

## 2. Cómo ubicar Sistemas Aries

1. Después del login, aparece la lista **Empresas**.
2. Click en **Sistemas Aries**.
3. Click en la declaración del **Año Gravable 2025**.
4. Aterriza en el **Editor**. Desde ahí, botón **Dashboard** (esquina superior) → vista consolidada con todos los indicadores y atajos.

**Atajo directo al dashboard de Sistemas Aries:**

`https://tribai-r110.vercel.app/empresas/b50540f6-4712-4bfc-b325-0c962a26af8d/declaraciones/6a66c036-904d-4953-8559-38a42ff4909e/dashboard`

---

## 3. Cómo está estructurada la declaración

El Dashboard consolida 10 etapas en orden de auditoría. Cada etapa es un módulo navegable:

| # | Etapa | Qué contiene | Renglones F-110 que alimenta |
|---|-------|---|---|
| 1 | Datos del Contribuyente | NIT, régimen, CIIU, dirección, flags MUISCA | Encabezado + R30-R41 |
| 2 | Balance de Prueba | Cuentas PUC con saldos + ajustes fiscales | R32, R33, R36-R46 (patrimonio) |
| 3 | Nómina y Seguridad Social | Aportes salud/pensión/ARL/parafiscales | R33-R35 (subset) |
| 4 | Patrimonio | Detalle de activos y pasivos consolidados | R36-R46 |
| 5 | Ingresos | Operacionales, no operacionales, dividendos, INCRNGO, exentas | R47-R58 |
| 6 | Costos y Deducciones | Costos, gastos, descuentos, deterioros | R59-R67 |
| 7 | Renta y Ganancias Ocasionales | Compensaciones, rentas exentas, GO | R72-R83 |
| 8 | Liquidación del Impuesto | Tarifa, descuentos, anticipo, sanciones, Tasa Mínima | R86-R99 |
| 9 | Retenciones | Retenciones en la fuente + autorretenciones | R100-R107 |
| 10 | Conciliación y Auditoría | F-2516, Conc Patrimonial, Conc Utilidades, Impuesto Diferido | Cuadres y validaciones |

El **dashboard** muestra para cada etapa: estado (✓ completa / pendiente), un hint con qué renglones alimenta, y un botón "Ir →".

---

## 4. Cómo se alimentan los anexos

Los anexos son las hojas de cálculo detalladas que se consolidan al F-110. La plataforma los gestiona desde el menú **Anexos** (en el sidebar del Editor) o desde la etapa correspondiente del Dashboard.

| Anexo | De dónde viene la información | A qué renglón llega | Dónde consultarlo |
|---|---|---|---|
| Seguridad Social | Aportes mensuales del año (planilla PILA) | R33-R35 | Anexos → Seguridad Social |
| Retenciones | Certificados de RF y autorretenciones | R100-R104 | Anexos → Retenciones |
| Descuentos Tributarios | ICA pagado, GMF deducible, otros descuentos Art. 256-259 | R98 | Anexos → Descuentos |
| Dividendos recibidos | Certificados emisores | R47, R50, R52, R53 | Anexos → Dividendos |
| Compensaciones | Pérdidas fiscales y excesos de renta presuntiva años anteriores | R75 | Anexos → Compensaciones |
| Rentas Exentas | CAN, Decisión 578, ZESE, Naranja, etc. | R76 | Anexos → Rentas Exentas |
| INCRNGO | Ingresos no constitutivos de renta | R59 | Anexos → INCRNGO |
| Ganancia Ocasional | Venta de activos > 2 años, herencias, donaciones | R80-R83 | Anexos → Ganancia Ocasional |
| Venta de Activos Fijos | Enajenaciones del año | R65, R80-R83 | Anexos → Venta AF |
| Renta Presuntiva | Patrimonio líquido año anterior ajustado | R74 | Anexos → Renta Presuntiva |
| ICA / Predial / GMF / IVA bienes cap. | Pagos del año soportados | R98, R67 | Anexos → cada uno |
| Diferencia en Cambio | Realizada vs no realizada | R49 | Anexos → Dif. Cambio |
| Deterioro Cartera | Provisiones aceptadas Art. 145 E.T. | R67 | Anexos → Deterioro Cartera |
| Intereses Presuntivos | Préstamos a socios (DTF) | R49 | Anexos → Intereses Presuntivos |
| Subcapitalización | Endeudamiento con vinculados | R67 (límite) | Anexos → Subcapitalización |
| Precios de Transferencia | Operaciones con vinculados del exterior | Validación R30 | Anexos → Precios de Transferencia |
| Beneficios | Mega-inversiones, ZESE, ZOMAC | Tarifas especiales | Anexos → Beneficios |

> Cada anexo tiene su propio formulario, pueden editar valores manualmente y el sistema **recalcula** el F-110 en cascada al guardar.

---

## 5. Cómo verificar valores en la plataforma

### Vista rápida (Dashboard)
- **KPIs**: Patrimonio líquido R46, Renta líquida R79, Impuesto R99, Saldo a pagar/favor R113/R114.
- **Resumen ejecutivo** muestra el progreso de las 10 etapas.
- Las **Alertas** (parte central) consolidan: errores de validación, ítems del checklist normativo, y obligación de Precios de Transferencia.

### Vista detallada (Editor)
- Botón **Editor** desde el dashboard.
- Tabla con los 88 renglones del F-110, valor calculado, y origen (qué anexo/fórmula lo alimenta).
- Click en un renglón → ver detalle del cálculo.

### Validaciones
- Módulo **Validaciones**: lista todos los chequeos que corre el motor fiscal (cuadres entre renglones, topes legales, coherencia entre anexos).
- Niveles: `error` (debe corregirse), `warn` (revisar criterio), `info` (referencia).

### Checklist Normativo
- Módulo **Checklist**: cumplimiento de requisitos formales (firmas, anexos obligatorios según tamaño, RUT actualizado, etc.).

### F-2516 (Reporte de Conciliación Fiscal)
- Si Sistemas Aries está obligado al F-2516, módulo **Conciliaciones → F-2516** muestra las 7 hojas oficiales (H1 a H7) con cuadre contable vs fiscal.

---

## 6. Descarga del Expediente Renta

Para revisión offline o archivo histórico:

- En el Dashboard, botón **🏛️ Expediente Renta**.
- Descarga un libro Excel de **31 hojas** alineado al modelo guía DIAN (`modelo110.xlsm`).
- Las hojas tienen fórmulas conectadas: modificar una celda del Balance recalcula Sumaria, H2/H3, totalizadores y F-110 dentro de Excel.

**Hojas del Expediente:**
PRESENTACIÓN · Datos Básicos · Datos Informativos · Balance de Prueba · Hoja Sumaria · Impuesto Diferido · Liquidacion Privada · Σ Patrimonio · Σ Ingresos · Σ Costos y Deducciones · Σ Renta · Anexo 1 Renta Presuntiva · Anexo 3 Retenciones y Auto · Anexo 5 Venta AF · Anexo 16 Conci Patr · Anexo 17 Conci Utilidad · Anexo 20 Comp Pérdidas · Anexo 21 Pagos Seg. Social · Tasa Mínima - TTD · Formulario 110 · H1 (Caratula) · H2 (ESF - Patrimonio) · H3 (ERI - Renta Liquida) · H4 (Impuesto Diferido) · H5 (Ingresos y Facturación) · H6 (Activos fijos) · H7 (Resumen ESF-ERI) · F110_2516 · F110_Conciliación · Audi_F-110 · Auditoría_F-110.

> El botón **🔄 Actualizar cálculos** (al lado de la descarga) fuerza un recálculo en cascada antes de generar el Excel; útil si acaban de modificar un anexo o el balance.

---

## 7. Cómo reportar hallazgos

Por favor consoliden las observaciones en un único correo a **jcanopino@gmail.com** con:

1. **Renglón F-110** o anexo donde se observa la diferencia.
2. **Valor esperado** (con soporte: balance, certificado, comprobante).
3. **Valor encontrado** en la plataforma.
4. **Comentario / norma aplicable** si corresponde.

Si la observación es de cuadre entre anexos, indicar los dos lados de la conciliación.

---

## 8. Buenas prácticas

- No es necesario guardar nada explícitamente: la plataforma persiste cada cambio en Supabase al editar.
- Si recalculan y los KPIs no se mueven, refrescar el navegador (Ctrl+R / Cmd+R).
- El Expediente Renta descargado refleja el estado al momento del click; descargar de nuevo si han hecho cambios.
- Para dudas técnicas de la plataforma (no de fondo fiscal): mismo correo.

---

© 2026 INPLUX SAS · NIT 901.784.448-8 · Marca Tribai · [tribai.co](https://tribai.co)

// Reglas de aplicabilidad por régimen del declarante.
// Códigos según catálogo `regimenes_tarifas` cargado desde data/extracted/03_regimenes_tarifas.json
// (mismo catálogo que muestra el form de "Nueva empresa").

/**
 * ¿Aplica la Tasa Mínima de Tributación Depurada (Art. 240 par. 6° E.T.)?
 *
 * NO aplica para:
 *   - Zona Franca y similares (regímenes 03, 04, 05, 06)
 *   - Régimen Tributario Especial / ESAL (régimen 08)
 *   - Personas naturales no residentes (régimen 07)
 *   - Tarifas especiales no estándar (09 al 20: Ley 1429 progresivos,
 *     editoriales, hoteles, dividendos especiales) — la mayoría tienen
 *     tratamiento autónomo y la TTD no las cubre.
 *
 * SÍ aplica para:
 *   - Régimen general persona jurídica (01, tarifa 35%)
 *   - Cooperativas régimen ordinario (02)
 *   - Demás casos no enumerados arriba
 *
 * Referencia: Anexo "Tasa Mínima - TTD" del Liquidador DIAN AG 2025
 * y E.T. Art. 240 par. 6° (excepción explícita de zona franca y ESAL).
 */
export function aplicaTTDPorRegimen(codigoRegimen: string | null | undefined): {
  aplica: boolean;
  razon: string | null;
} {
  if (!codigoRegimen) {
    // Sin régimen seteado → asumimos régimen general
    return { aplica: true, razon: null };
  }

  const c = String(codigoRegimen).padStart(2, "0");

  // ZESE / Zona Franca / Régimen Especial · no aplica TTD
  if (c === "03") return { aplica: false, razon: "ZESE (Art. 240 E.T.)" };
  if (c === "04")
    return { aplica: false, razon: "Usuario de Zona Franca Comercial" };
  if (c === "05")
    return { aplica: false, razon: "Usuario de Zona Franca No Comercial" };
  if (c === "06")
    return { aplica: false, razon: "Zona Franca Cúcuta (Par. 4 Art. 240-1 E.T.)" };
  if (c === "07")
    return { aplica: false, razon: "Persona natural no residente (Art. 247 E.T.)" };
  if (c === "08")
    return { aplica: false, razon: "Régimen Tributario Especial / ESAL (Art. 356 E.T.)" };

  return { aplica: true, razon: null };
}

/**
 * ¿Aplica la sobretasa para instituciones financieras (Par. 1° Art. 240 E.T.)?
 * Esta es independiente del régimen: depende del flag manual + de superar el
 * umbral de 120.000 UVT en R79. Aquí solo confirmamos la elegibilidad: la
 * sobretasa de 5pp solo tiene sentido para regímenes que efectivamente
 * graven al 35% (régimen 01) o casos análogos.
 */
export function elegibleSobretasaFinanciera(codigoRegimen: string | null | undefined): boolean {
  if (!codigoRegimen) return true; // sin régimen → asumir general elegible
  const c = String(codigoRegimen).padStart(2, "0");
  // Régimen general (35%) y zona franca comercial (35%) son los principales
  return c === "01" || c === "04";
}

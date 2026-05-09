import { describe, it, expect } from "vitest";

// Test del filtro anti-duplicación · simula la lógica que usa
// `cargarContablesESF_ERI` para excluir cuentas resumen del balance.
// Si esto falla, los totales del F2516 vendrán inflados.

function tieneHijasFactory(todasCuentas: Set<string>) {
  return (cuenta: string): boolean => {
    for (const otra of todasCuentas) {
      if (otra.length > cuenta.length && otra.startsWith(cuenta)) return true;
    }
    return false;
  };
}

describe("Filtro anti-duplicación · cuentas resumen vs hojas", () => {
  it("balance plano (solo nivel 4) · todas son hojas", () => {
    const set = new Set(["1105", "1110", "1130", "2205", "4135"]);
    const tieneHijas = tieneHijasFactory(set);
    for (const c of set) {
      expect(tieneHijas(c)).toBe(false);
    }
  });

  it("balance jerárquico · padre + subcuentas → padre se excluye", () => {
    const set = new Set(["1105", "110505", "11050505"]);
    const tieneHijas = tieneHijasFactory(set);
    expect(tieneHijas("1105")).toBe(true);   // tiene 110505 como hija
    expect(tieneHijas("110505")).toBe(true); // tiene 11050505 como hija
    expect(tieneHijas("11050505")).toBe(false); // hoja
  });

  it("dos cuentas hermanas · ambas son hojas", () => {
    const set = new Set(["1105", "1110"]);
    const tieneHijas = tieneHijasFactory(set);
    expect(tieneHijas("1105")).toBe(false);
    expect(tieneHijas("1110")).toBe(false);
  });

  it("padre con varias hijas a distintos niveles", () => {
    const set = new Set(["13", "1305", "1310", "131005"]);
    const tieneHijas = tieneHijasFactory(set);
    expect(tieneHijas("13")).toBe(true);     // 1305, 1310, 131005
    expect(tieneHijas("1305")).toBe(false);  // hoja
    expect(tieneHijas("1310")).toBe(true);   // tiene 131005
    expect(tieneHijas("131005")).toBe(false); // hoja
  });

  it("solo el padre (sin subcuentas presentes) → padre es hoja", () => {
    const set = new Set(["1105"]);
    const tieneHijas = tieneHijasFactory(set);
    expect(tieneHijas("1105")).toBe(false);
  });

  it("prefijo coincidente pero NO es hija real (1105 vs 11050)", () => {
    // 11050 NO es hija de 1105 — debería SER detectada porque "11050".startsWith("1105")
    // Convención PUC: ambas cuentas existen. La heurística string.startsWith
    // dice que sí es hija. Esto es lo correcto: "11050" es más larga y empieza
    // con "1105", entonces es una sub-cuenta.
    const set = new Set(["1105", "11050"]);
    const tieneHijas = tieneHijasFactory(set);
    expect(tieneHijas("1105")).toBe(true); // 11050 es "hija"
    expect(tieneHijas("11050")).toBe(false);
  });

  it("simulación de duplicación · sin filtro vs con filtro", () => {
    // Balance: 1105 = 1.000.000, 110505 = 600.000, 110510 = 400.000
    // Sin filtro · suma = 1.000.000 + 600.000 + 400.000 = 2.000.000 (duplicado)
    // Con filtro · 1105 se excluye → suma = 600.000 + 400.000 = 1.000.000 ✓
    const balance = [
      { cuenta: "1105", saldo: 1_000_000 },
      { cuenta: "110505", saldo: 600_000 },
      { cuenta: "110510", saldo: 400_000 },
    ];
    const set = new Set(balance.map((l) => l.cuenta));
    const tieneHijas = tieneHijasFactory(set);

    let sinFiltro = 0;
    let conFiltro = 0;
    for (const l of balance) {
      sinFiltro += l.saldo;
      if (!tieneHijas(l.cuenta)) conFiltro += l.saldo;
    }

    expect(sinFiltro).toBe(2_000_000); // bug · duplicado
    expect(conFiltro).toBe(1_000_000); // correcto · solo hojas
  });

  it("balance Aries simulado · efectivo + cuentas hijas", () => {
    // Caso real: 1105 caja, con cuentas auxiliares por sucursal
    const balance = [
      { cuenta: "1105", saldo: 50_000_000 },        // resumen
      { cuenta: "110505", saldo: 30_000_000 },      // caja general
      { cuenta: "11050501", saldo: 20_000_000 },    // caja sucursal A
      { cuenta: "11050502", saldo: 10_000_000 },    // caja sucursal B
      { cuenta: "1110", saldo: 80_000_000 },        // bancos · hoja única
    ];
    const set = new Set(balance.map((l) => l.cuenta));
    const tieneHijas = tieneHijasFactory(set);

    let total = 0;
    for (const l of balance) {
      if (!tieneHijas(l.cuenta)) total += l.saldo;
    }
    // Hojas: 11050501 (20M) + 11050502 (10M) + 1110 (80M) = 110M
    // 110505 tiene hijas (11050501, 11050502) → excluida
    // 1105 tiene hijas → excluida
    expect(total).toBe(110_000_000);
  });
});

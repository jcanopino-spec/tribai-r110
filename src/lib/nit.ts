// Calculo del Digito de Verificacion (DV) del NIT colombiano (DIAN).
// Pesos extraidos de la formula del .xlsm fuente
// (hoja 'Datos Informativos' celda D13). Coinciden con el algoritmo DIAN.
//
// El NIT se padea con ceros a la izquierda hasta 15 digitos. Los pesos se
// asignan de derecha a izquierda: [3, 7, 13, 17, 19, 23, 29, 37, 41, 43,
// 47, 53, 59, 67, 71]. Suma de productos mod 11 produce el DV: si es 0 -> 0,
// si es 1 -> 1, en otro caso 11 - mod.

const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71] as const;

export function calcularDV(nit: string | number): string | null {
  const digits = String(nit).replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 15) return null;

  const padded = digits.padStart(15, "0");
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    // padded[14] is the rightmost digit, paired with WEIGHTS[0] = 3
    const digit = Number(padded[14 - i]);
    sum += digit * WEIGHTS[i];
  }
  const mod = sum % 11;
  if (mod === 0) return "0";
  if (mod === 1) return "1";
  return String(11 - mod);
}

// Sanidad: se asume que las llamadas se hacen con NITs de 8-10 digitos para PJ;
// la implementacion soporta hasta 15 (limite del padding del .xlsm).

import { revalidatePath } from "next/cache";

/**
 * Revalida toda la subárea de una declaración (editor + configuración +
 * anexos + balance + conciliación + validaciones + imprimir). El scope
 * `'layout'` invalida todas las páginas que comparten el layout del declId,
 * así un cambio en cualquier sección se propaga al resto sin riesgo de
 * mostrar valores con caché desfasados.
 */
export function revalidateDeclaracion(empresaId: string, declId: string) {
  revalidatePath(
    `/empresas/${empresaId}/declaraciones/${declId}`,
    "layout",
  );
}

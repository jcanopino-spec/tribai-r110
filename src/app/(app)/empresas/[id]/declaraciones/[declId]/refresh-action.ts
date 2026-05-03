"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";

export async function refreshDeclaracionAction(
  empresaId: string,
  declId: string,
) {
  revalidateDeclaracion(empresaId, declId);
}

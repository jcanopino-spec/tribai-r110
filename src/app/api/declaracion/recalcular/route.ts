// POST /api/declaracion/recalcular?decl={id}
//
// Fuerza el recálculo en cascada de form110_valores y revalida toda la
// rama de la declaración. Equivalente al "Actualizar cálculos" tipo Excel:
// cualquier cambio manual en balance o anexos se propaga inmediatamente
// a todas las páginas (F110, F2516, conciliaciones, validaciones, etc).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recalcularForm110Valores } from "@/lib/recalcular-form110";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const declId = url.searchParams.get("decl");
  if (!declId) {
    return NextResponse.json({ error: "Missing decl param" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[recalcular] auth failed:", authError?.message);
    return NextResponse.json(
      { ok: false, error: "Sesión expirada · refresca la página o vuelve a iniciar sesión" },
      { status: 401 },
    );
  }

  // Verificar pertenencia: la declaración debe ser de una empresa del usuario
  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, empresa_id")
    .eq("id", declId)
    .single();
  if (!declaracion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await recalcularForm110Valores(supabase, declId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  // Revalidar TODA la rama del declId (layout) · invalida todas las páginas hijas
  revalidatePath(
    `/empresas/${declaracion.empresa_id}/declaraciones/${declId}`,
    "layout",
  );

  return NextResponse.json({
    ok: true,
    renglones: result.renglones,
    message: `Recalculado · ${result.renglones} renglones actualizados`,
  });
}

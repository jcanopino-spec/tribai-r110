import { createClient } from "@/lib/supabase/server";
import { EmpresaForm } from "./empresa-form";

export const metadata = { title: "Nueva empresa" };

export default async function NuevaEmpresaPage() {
  const supabase = await createClient();
  const [{ data: ciius }, { data: dians }, { data: regimenes }] = await Promise.all([
    supabase.from("ciiu_codigos").select("codigo, descripcion").order("codigo"),
    supabase.from("direcciones_seccionales").select("codigo, nombre").order("nombre"),
    supabase.from("regimenes_tarifas").select("codigo, descripcion").eq("ano_gravable", 2025).order("codigo"),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em]">Nueva empresa</h1>
      <p className="mt-3 text-muted-foreground">
        Datos básicos. Los catálogos vienen del .xlsm fuente y de la DIAN.
      </p>

      <div className="mt-10">
        <EmpresaForm
          ciius={ciius ?? []}
          dians={dians ?? []}
          regimenes={regimenes ?? []}
        />
      </div>
    </div>
  );
}

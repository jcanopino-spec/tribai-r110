import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Catálogos" };

export default async function CatalogosPage() {
  const supabase = await createClient();

  const [{ count: ciiuCount }, { count: dianCount }, { count: regCount }, { count: r110Count }, { count: pucCount }] =
    await Promise.all([
      supabase.from("ciiu_codigos").select("*", { count: "exact", head: true }),
      supabase.from("direcciones_seccionales").select("*", { count: "exact", head: true }),
      supabase.from("regimenes_tarifas").select("*", { count: "exact", head: true }),
      supabase.from("form110_renglones").select("*", { count: "exact", head: true }),
      supabase.from("puc_accounts").select("*", { count: "exact", head: true }),
    ]);

  const { data: regimenes } = await supabase
    .from("regimenes_tarifas")
    .select("codigo, descripcion, tarifa")
    .eq("ano_gravable", 2025)
    .order("codigo")
    .limit(10);

  const { data: renglones } = await supabase
    .from("form110_renglones")
    .select("numero, descripcion, seccion")
    .eq("ano_gravable", 2025)
    .order("numero")
    .limit(15);

  return (
    <main className="mx-auto w-full max-w-[80rem] px-6 py-16 md:px-8">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground">
        ← Tribai
      </Link>
      <h1 className="mt-6 font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl">
        Catálogos cargados
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Datos extraídos del .xlsm fuente y sembrados en Supabase. Esta página confirma que la DB
        está conectada al frontend con tipos.
      </p>

      <section className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="CIIU" value={ciiuCount ?? 0} />
        <Stat label="Direcciones DIAN" value={dianCount ?? 0} />
        <Stat label="Regímenes" value={regCount ?? 0} />
        <Stat label="Renglones 110" value={r110Count ?? 0} />
        <Stat label="Cuentas PUC" value={pucCount ?? 0} />
      </section>

      <section className="mt-16 grid gap-12 md:grid-cols-2">
        <Block title="Regímenes tributarios (AG 2025)">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-mono text-xs uppercase tracking-[0.05em]">Cód</th>
                <th className="font-mono text-xs uppercase tracking-[0.05em]">Régimen</th>
                <th className="text-right font-mono text-xs uppercase tracking-[0.05em]">Tarifa</th>
              </tr>
            </thead>
            <tbody>
              {regimenes?.map((r) => (
                <tr key={r.codigo} className="border-b border-border last:border-0">
                  <td className="py-3 align-top font-mono">{r.codigo}</td>
                  <td className="py-3 pr-4 align-top">{r.descripcion}</td>
                  <td className="py-3 text-right align-top font-mono">
                    {(Number(r.tarifa) * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <Block title="Renglones del Formulario 110 (primeros 15)">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-mono text-xs uppercase tracking-[0.05em]">N°</th>
                <th className="font-mono text-xs uppercase tracking-[0.05em]">Descripción</th>
                <th className="font-mono text-xs uppercase tracking-[0.05em]">Sección</th>
              </tr>
            </thead>
            <tbody>
              {renglones?.map((r) => (
                <tr key={r.numero} className="border-b border-border last:border-0">
                  <td className="py-3 align-top font-mono">{r.numero}</td>
                  <td className="py-3 pr-4 align-top">{r.descripcion}</td>
                  <td className="py-3 align-top text-muted-foreground">{r.seccion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-5">
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{value.toLocaleString("es-CO")}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

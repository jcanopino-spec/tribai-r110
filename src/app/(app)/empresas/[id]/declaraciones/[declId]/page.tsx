import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeclaracionEditor } from "./editor";
import { ModePicker } from "./mode-picker";
import { clearModoCargaAction } from "./actions";

export const metadata = { title: "Editor declaración" };

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export default async function DeclaracionEditorPage({
  params,
}: {
  params: Promise<{ id: string; declId: string }>;
}) {
  const { id: empresaId, declId } = await params;
  const supabase = await createClient();

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select(
      "id, ano_gravable, formato, estado, modo_carga, empresa:empresas(id, razon_social, nit, regimen_codigo)",
    )
    .eq("id", declId)
    .single();

  if (!declaracion) notFound();

  // Tarifa del régimen para calcular renglón 84 automaticamente
  const regimenCodigo = declaracion.empresa?.regimen_codigo;
  let tarifaRegimen: number | null = null;
  if (regimenCodigo) {
    const { data: reg } = await supabase
      .from("regimenes_tarifas")
      .select("tarifa")
      .eq("codigo", regimenCodigo)
      .eq("ano_gravable", declaracion.ano_gravable)
      .maybeSingle();
    tarifaRegimen = reg ? Number(reg.tarifa) : null;
  }

  const cambiarModo = clearModoCargaAction.bind(null, declId, empresaId);

  return (
    <div>
      <Link
        href={`/empresas/${empresaId}`}
        className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
      >
        ← {declaracion.empresa?.razon_social}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            AG {declaracion.ano_gravable} · Formulario {declaracion.formato} ·{" "}
            {declaracion.estado}
            {declaracion.modo_carga ? (
              <>
                {" "}
                · modo{" "}
                <span className="text-foreground">
                  {declaracion.modo_carga === "manual" ? "manual" : "balance de prueba"}
                </span>
              </>
            ) : null}
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.05] tracking-[-0.02em]">
            Declaración de renta
          </h1>
        </div>
        {declaracion.modo_carga ? (
          <form action={cambiarModo}>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
            >
              Cambiar modo de carga
            </button>
          </form>
        ) : null}
      </div>

      {declaracion.modo_carga === null ? (
        <>
          <p className="mt-6 max-w-3xl text-muted-foreground">
            Cómo quieres cargar la información de esta declaración? Puedes cambiar la
            elección después si lo necesitas.
          </p>
          <ModePicker declId={declId} empresaId={empresaId} />
        </>
      ) : (
        <Workspace
          declId={declId}
          empresaId={empresaId}
          ano={declaracion.ano_gravable}
          modo={declaracion.modo_carga as "manual" | "balance"}
          tarifaRegimen={tarifaRegimen}
          regimenCodigo={regimenCodigo ?? null}
        />
      )}
    </div>
  );
}

async function Workspace({
  declId,
  empresaId,
  ano,
  modo,
  tarifaRegimen,
  regimenCodigo,
}: {
  declId: string;
  empresaId: string;
  ano: number;
  modo: "manual" | "balance";
  tarifaRegimen: number | null;
  regimenCodigo: string | null;
}) {
  const supabase = await createClient();

  // Datos comunes
  const [{ data: renglones }, { data: valores }] = await Promise.all([
    supabase
      .from("form110_renglones")
      .select("numero, descripcion, seccion")
      .eq("ano_gravable", ano)
      .order("numero"),
    supabase
      .from("form110_valores")
      .select("numero, valor")
      .eq("declaracion_id", declId),
  ]);

  // Si modo es balance, traemos la info del balance
  let balanceCard: React.ReactNode = null;
  if (modo === "balance") {
    const { data: balance } = await supabase
      .from("balance_pruebas")
      .select("id, filename, uploaded_at")
      .eq("declaracion_id", declId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!balance) {
      balanceCard = (
        <div className="mt-12 max-w-2xl border border-dashed border-border p-8">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Modo balance · sin archivo cargado
          </p>
          <h3 className="mt-3 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
            Sube tu Balance de Prueba
          </h3>
          <p className="mt-3 text-muted-foreground">
            Cuando subas el archivo, Tribai mapea cada cuenta PUC al renglón
            correspondiente del 110 y rellena los valores automáticamente.
          </p>
          <Link
            href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90"
          >
            Cargar archivo →
          </Link>
        </div>
      );
    } else {
      const [
        { count: totalLineas },
        { count: mapeadas },
        { count: pendientes },
      ] = await Promise.all([
        supabase
          .from("balance_prueba_lineas")
          .select("*", { count: "exact", head: true })
          .eq("balance_id", balance.id),
        supabase
          .from("balance_prueba_lineas")
          .select("*", { count: "exact", head: true })
          .eq("balance_id", balance.id)
          .not("renglon_110", "is", null),
        supabase
          .from("balance_prueba_lineas")
          .select("*", { count: "exact", head: true })
          .eq("balance_id", balance.id)
          .is("renglon_110", null)
          .like("cuenta", "______%"), // solo auxiliares (6+ chars)
      ]);

      balanceCard = (
        <div className="mt-12 border border-border p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
                Balance cargado · {new Date(balance.uploaded_at).toLocaleString("es-CO")}
              </p>
              <h3 className="mt-2 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
                {balance.filename}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/empresas/${empresaId}/declaraciones/${declId}/balance`}
                className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-xs text-primary-foreground hover:opacity-90"
              >
                Ver balance completo →
              </Link>
              <Link
                href={`/empresas/${empresaId}/declaraciones/${declId}/importar`}
                className="inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
              >
                Reemplazar archivo
              </Link>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Líneas" value={totalLineas ?? 0} />
            <Stat label="Mapeadas" value={mapeadas ?? 0} success={(mapeadas ?? 0) > 0} />
            <Stat
              label="Pendientes"
              value={pendientes ?? 0}
              alert={(pendientes ?? 0) > 0}
              muted={(pendientes ?? 0) === 0}
              href={
                (pendientes ?? 0) > 0
                  ? `/empresas/${empresaId}/declaraciones/${declId}/balance?filter=pendientes`
                  : undefined
              }
            />
          </div>
        </div>
      );
    }
  }

  return (
    <>
      {balanceCard}

      <div className="mt-12">
        <h2 className="font-serif text-2xl leading-[1.1] tracking-[-0.01em]">
          {modo === "balance" ? "Renglones del 110 (ajustes manuales)" : "Renglones del 110"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {modo === "balance"
            ? "Los valores vienen del balance importado. Puedes ajustar cualquier renglón manualmente; tu cambio sobreescribe el valor agregado."
            : "Digita los valores en cada renglón. Los miles se formatean automáticamente."}
        </p>
        {tarifaRegimen != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Régimen <span className="font-mono">{regimenCodigo}</span> · tarifa{" "}
            <span className="font-mono">{(tarifaRegimen * 100).toFixed(2)}%</span>{" "}
            (se aplica al renglón 84 sobre la renta líquida gravable)
          </p>
        ) : (
          <p className="mt-2 text-xs text-destructive">
            Esta empresa no tiene régimen tributario configurado. Edita la empresa para que el
            renglón 84 (impuesto) se calcule automáticamente.
          </p>
        )}
        <div className="mt-6">
          <DeclaracionEditor
            declId={declId}
            empresaId={empresaId}
            renglones={renglones ?? []}
            valoresIniciales={(valores ?? []).map((v) => ({
              numero: v.numero,
              valor: Number(v.valor),
            }))}
            tarifaRegimen={tarifaRegimen}
          />
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  success,
  alert,
  muted,
  href,
}: {
  label: string;
  value: number;
  success?: boolean;
  alert?: boolean;
  muted?: boolean;
  href?: string;
}) {
  const cls = alert
    ? "border-destructive/40 bg-destructive/5"
    : success
      ? "border-success/40 bg-success/5"
      : "border-border";
  const valueCls = alert ? "text-destructive" : muted ? "text-muted-foreground" : "";

  const content = (
    <div className={`border p-4 ${cls}`}>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-2xl tracking-[-0.02em] ${valueCls}`}>
        {FMT.format(value)}
      </p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

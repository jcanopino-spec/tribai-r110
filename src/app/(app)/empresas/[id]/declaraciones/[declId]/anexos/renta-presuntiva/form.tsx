"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { saveRentaPresuntivaAction, type RpState } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const initial: RpState = { error: null, ok: false };

function fmt(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return FMT.format(n);
}

function fmtInput(s: string): string {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return FMT.format(Number(cleaned));
}

function parseNum(s: string): number {
  const cleaned = String(s ?? "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RentaPresuntivaForm({ declId, empresaId, tarifa, declaracion }: any) {
  const action = saveRentaPresuntivaAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);

  const patrimonioLiquidoAnterior =
    Number(declaracion.patrimonio_bruto_anterior ?? 0) -
    Number(declaracion.pasivos_anterior ?? 0);

  const [acciones, setAcciones] = useState(fmt(declaracion.rp_acciones_sociedades_nacionales));
  const [improd, setImprod] = useState(fmt(declaracion.rp_bienes_actividades_improductivas));
  const [fuerza, setFuerza] = useState(fmt(declaracion.rp_bienes_fuerza_mayor));
  const [perImprod, setPerImprod] = useState(fmt(declaracion.rp_bienes_periodo_improductivo));
  const [mineria, setMineria] = useState(fmt(declaracion.rp_bienes_mineria));
  const [vivienda, setVivienda] = useState(fmt(declaracion.rp_primeros_19000_uvt_vivienda));
  const [excluidos, setExcluidos] = useState(fmt(declaracion.rp_renta_gravada_bienes_excluidos));

  const totalDepuraciones =
    parseNum(acciones) +
    parseNum(improd) +
    parseNum(fuerza) +
    parseNum(perImprod) +
    parseNum(mineria) +
    parseNum(vivienda);

  const baseRP = Math.max(0, patrimonioLiquidoAnterior - totalDepuraciones);
  const presuntivaTentativa = baseRP * tarifa;
  const total76 = presuntivaTentativa + parseNum(excluidos);

  return (
    <form action={formAction}>
      <div className="border border-border p-5">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Patrimonio líquido AG anterior (de Configuración → Año anterior)
        </p>
        <p className="mt-2 font-serif text-2xl">{FMT.format(patrimonioLiquidoAnterior)}</p>
      </div>

      <h3 className="mt-8 font-serif text-xl">Depuraciones del patrimonio líquido</h3>
      <div className="mt-4 space-y-4">
        <NumF
          name="rp_acciones_sociedades_nacionales"
          label="Acciones en sociedades nacionales"
          value={acciones}
          set={setAcciones}
        />
        <NumF
          name="rp_bienes_actividades_improductivas"
          label="Bienes destinados a actividades improductivas"
          value={improd}
          set={setImprod}
        />
        <NumF
          name="rp_bienes_fuerza_mayor"
          label="Bienes afectados por hechos constitutivos de fuerza mayor o caso fortuito"
          value={fuerza}
          set={setFuerza}
        />
        <NumF
          name="rp_bienes_periodo_improductivo"
          label="Bienes vinculados a empresas en periodo improductivo"
          value={perImprod}
          set={setPerImprod}
        />
        <NumF
          name="rp_bienes_mineria"
          label="Bienes vinculados al sector minero (no hidrocarburos)"
          value={mineria}
          set={setMineria}
        />
        <NumF
          name="rp_primeros_19000_uvt_vivienda"
          label="Primeros 19.000 UVT de activos destinados a vivienda"
          value={vivienda}
          set={setVivienda}
        />
        <NumF
          name="rp_renta_gravada_bienes_excluidos"
          label="Renta gravable generada por los bienes excluidos (suma al final)"
          value={excluidos}
          set={setExcluidos}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="border border-border p-5">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Base para renta presuntiva
          </p>
          <p className="mt-2 font-serif text-2xl">{FMT.format(baseRP)}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            × {(tarifa * 100).toFixed(2)}% = {FMT.format(presuntivaTentativa)}
          </p>
        </div>
        <div className="border border-foreground bg-foreground p-5 text-background">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-background/70">
            Renglón 76 · Renta Presuntiva
          </p>
          <p className="mt-2 font-serif text-3xl tracking-[-0.02em]">{FMT.format(total76)}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : <span />}
        {state.ok ? <p className="text-sm text-muted-foreground">Guardado.</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function NumF({
  name,
  label,
  value,
  set,
}: {
  name: string;
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        inputMode="numeric"
        value={value}
        onChange={(e) => set(fmtInput(e.target.value))}
      />
    </Field>
  );
}

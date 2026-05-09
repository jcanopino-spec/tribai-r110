"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAjusteAction } from "./actions";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmtInput(s: string): string {
  const c = s.replace(/[^0-9\-]/g, "");
  if (!c || c === "-") return c;
  const n = Number(c);
  return Number.isFinite(n) ? FMT.format(n) : "";
}

type FilaProps = {
  declId: string;
  empresaId: string;
  filaId: string;
  numero: number;
  label: string;
  esTotal: boolean;
  contable: number;
  conversion: number;
  menorFiscal: number;
  mayorFiscal: number;
  fiscal: number;
  observacion: string | null;
  r110: number | null;
  diferencia: number | null;
  cuadraConR110?: number;
  ayuda?: string;
};

export function FilaRow(props: FilaProps) {
  const [editing, setEditing] = useState(false);
  const [conv, setConv] = useState(fmtInput(String(props.conversion)));
  const [menor, setMenor] = useState(fmtInput(String(props.menorFiscal)));
  const [mayor, setMayor] = useState(fmtInput(String(props.mayorFiscal)));
  const [obs, setObs] = useState(props.observacion ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  const dif = props.diferencia;
  const cuadra = dif !== null && Math.abs(dif) <= 1000; // tolerancia 1k DIAN
  const tieneAjustes =
    props.conversion !== 0 || props.menorFiscal !== 0 || props.mayorFiscal !== 0;

  async function onSave() {
    const fd = new FormData();
    fd.set("conversion", String(conv).replace(/[^0-9\-]/g, ""));
    fd.set("menor_fiscal", String(menor).replace(/[^0-9\-]/g, ""));
    fd.set("mayor_fiscal", String(mayor).replace(/[^0-9\-]/g, ""));
    fd.set("observacion", obs);
    start(async () => {
      const r = await saveAjusteAction(
        props.declId,
        props.empresaId,
        props.filaId,
        fd,
      );
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function onCancel() {
    setConv(fmtInput(String(props.conversion)));
    setMenor(fmtInput(String(props.menorFiscal)));
    setMayor(fmtInput(String(props.mayorFiscal)));
    setObs(props.observacion ?? "");
    setEditing(false);
  }

  const cellInput =
    "w-full bg-transparent text-right font-mono text-xs tabular-nums outline-none focus:bg-muted/40 px-1";

  return (
    <>
      <tr
        className={
          props.esTotal
            ? "border-b border-foreground/30 bg-muted/30 font-semibold"
            : "border-b border-border"
        }
      >
        <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground tabular-nums">
          {props.numero}
        </td>
        <td className="px-2 py-1.5 text-sm">
          {props.label}
          {props.cuadraConR110 ? (
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              ↔ R{props.cuadraConR110}
            </span>
          ) : null}
        </td>
        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
          {FMT.format(props.contable)}
        </td>
        {!props.esTotal && editing ? (
          <>
            <td className="px-2 py-1.5">
              <input
                value={conv}
                onChange={(e) => setConv(fmtInput(e.target.value))}
                className={cellInput}
                placeholder="0"
              />
            </td>
            <td className="px-2 py-1.5">
              <input
                value={menor}
                onChange={(e) => setMenor(fmtInput(e.target.value))}
                className={cellInput}
                placeholder="0"
              />
            </td>
            <td className="px-2 py-1.5">
              <input
                value={mayor}
                onChange={(e) => setMayor(fmtInput(e.target.value))}
                className={cellInput}
                placeholder="0"
              />
            </td>
          </>
        ) : (
          <>
            <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
              {props.esTotal ? "" : FMT.format(props.conversion) || ""}
            </td>
            <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
              {props.esTotal ? "" : FMT.format(props.menorFiscal) || ""}
            </td>
            <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
              {props.esTotal ? "" : FMT.format(props.mayorFiscal) || ""}
            </td>
          </>
        )}
        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums font-semibold">
          {FMT.format(props.fiscal)}
        </td>
        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {props.r110 !== null ? FMT.format(props.r110) : "—"}
        </td>
        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
          {dif === null ? (
            "—"
          ) : cuadra ? (
            <span className="text-success">✓</span>
          ) : (
            <span className="text-destructive">{FMT.format(dif)}</span>
          )}
        </td>
        <td className="px-2 py-1.5 text-right">
          {props.esTotal ? null : editing ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={pending}
                className="font-mono text-xs text-success hover:underline disabled:opacity-50"
              >
                ✓ Guardar
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-mono text-xs text-muted-foreground hover:text-foreground"
              title={props.ayuda ?? "Modificar ajustes"}
            >
              ✏️
            </button>
          )}
        </td>
      </tr>
      {editing ? (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={2} className="px-2 py-1.5 text-xs text-muted-foreground">
            Observación:
          </td>
          <td colSpan={8} className="px-2 py-1.5">
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Razón del ajuste (opcional)"
              className="w-full bg-transparent text-xs outline-none focus:bg-muted/40 px-1"
            />
          </td>
        </tr>
      ) : props.observacion && tieneAjustes ? (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={10} className="px-2 py-0.5 pl-12 text-[10px] italic text-muted-foreground">
            {props.observacion}
          </td>
        </tr>
      ) : null}
    </>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Field } from "@/components/ui/label";
import { Input, Select } from "@/components/ui/input";
import { saveConfiguracionAction, type ConfigState } from "./actions";
import type { EstadoPresentacion } from "@/lib/forms/vencimientos";

const FMT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fmt(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return FMT.format(n);
}

const initial: ConfigState = { error: null, saved: false };

const TABS = [
  { id: "general", label: "General" },
  { id: "auditoria", label: "Beneficio auditoría" },
  { id: "anterior", label: "Año anterior" },
  { id: "sanciones", label: "Sanciones" },
  { id: "otros", label: "Otros" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Tipo amplio del row de declaracion (usamos any para no acoplar al schema TS).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Decl = any;

export function ConfiguracionForm({
  declId,
  empresaId,
  razonSocial,
  regimenCodigo,
  declaracion,
  vencimientoSugerido,
  evaluacion,
  ultimoDigitoNit,
}: {
  declId: string;
  empresaId: string;
  razonSocial: string;
  regimenCodigo: string | null;
  declaracion: Decl;
  vencimientoSugerido: string | null;
  evaluacion: EstadoPresentacion;
  ultimoDigitoNit: number | null;
}) {
  const action = saveConfiguracionAction.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [tab, setTab] = useState<TabId>("general");
  const d = declaracion;

  return (
    <form action={formAction}>
      <p className="text-sm text-muted-foreground">
        Empresa: <span className="font-medium text-foreground">{razonSocial}</span>{" "}
        · Régimen{" "}
        <span className="font-mono">{regimenCodigo ?? "sin configurar"}</span>
      </p>

      <nav className="mt-6 flex flex-wrap border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/*
        Renderizamos TODAS las pestañas siempre y solo ocultamos las inactivas
        con `hidden`. Esto mantiene los inputs en el DOM, así el form envía
        todos los campos y los booleanos de otras pestañas no se reinician
        a false al guardar.
      */}
      <div className="mt-8 space-y-6">
        <div hidden={tab !== "general"}><TabGeneral d={d} /></div>
        <div hidden={tab !== "auditoria"}><TabAuditoria d={d} /></div>
        <div hidden={tab !== "anterior"}><TabAnterior d={d} /></div>
        <div hidden={tab !== "sanciones"}>
          <TabSanciones
            d={d}
            vencimientoSugerido={vencimientoSugerido}
            evaluacion={evaluacion}
            ultimoDigitoNit={ultimoDigitoNit}
          />
        </div>
        <div hidden={tab !== "otros"}><TabOtros d={d} /></div>
      </div>

      <div className="sticky bottom-0 mt-10 flex items-center justify-between gap-4 border-t border-border bg-background py-4">
        <p className="text-xs text-muted-foreground">
          Los cambios se guardan en la declaración y se aplican al formulario.
        </p>
        <div className="flex items-center gap-3">
          {state.saved ? (
            <p className="text-sm text-muted-foreground">Configuración guardada.</p>
          ) : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ============================================================
// Tab 1: General
// ============================================================
function TabGeneral({ d }: { d: Decl }) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Características de la empresa</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <CheckField
          name="es_gran_contribuyente"
          label="¿Es Gran Contribuyente?"
          defaultChecked={d.es_gran_contribuyente}
        />
        <CheckField
          name="tiene_justificacion_patrimonial"
          label="¿Justifica el incremento patrimonial?"
          defaultChecked={d.tiene_justificacion_patrimonial}
        />
        <CheckField
          name="calcula_anticipo"
          label="¿Calcula anticipo año siguiente?"
          defaultChecked={d.calcula_anticipo}
        />
        <CheckField
          name="es_institucion_financiera"
          label="¿Es entidad financiera, aseguradora, hidroeléctrica o extractora?"
          defaultChecked={d.es_institucion_financiera}
          help="Si SÍ, aplica sobretasa (renglón 85) según Art. 240 par. 1° E.T."
        />
        <CheckField
          name="ica_como_descuento"
          label="¿Trata el ICA como descuento tributario?"
          defaultChecked={d.ica_como_descuento}
          help="100% del ICA pagado puede descontarse del impuesto a cargo (Art. 115 E.T.)."
        />
      </div>

      <h2 className="mt-8 font-serif text-xl">Datos para el anticipo</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Años declarando">
          <Select name="anios_declarando" defaultValue={d.anios_declarando ?? "tercero_o_mas"}>
            <option value="primero">Primer año (anticipo no aplica)</option>
            <option value="segundo">Segundo año (50%)</option>
            <option value="tercero_o_mas">Tercer año o más (75%)</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}

// ============================================================
// Tab 2: Beneficio de auditoría
// ============================================================
function TabAuditoria({ d }: { d: Decl }) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Beneficio de auditoría · Art. 689-3 E.T.</h2>
      <p className="text-sm text-muted-foreground">
        Reduce el término de firmeza de la declaración a 12 o 6 meses si el impuesto neto
        de renta del año actual aumenta como mínimo 25% o 35% respecto al año anterior.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <CheckField
          name="beneficio_auditoria_12m"
          label="Acoge beneficio 12 meses (incremento ≥ 25%)"
          defaultChecked={d.beneficio_auditoria_12m}
        />
        <CheckField
          name="beneficio_auditoria_6m"
          label="Acoge beneficio 6 meses (incremento ≥ 35%)"
          defaultChecked={d.beneficio_auditoria_6m}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Tribai validará que el incremento mínimo se cumpla con base en el impuesto neto
        del año anterior y el del año actual.
      </p>
    </div>
  );
}

// ============================================================
// Tab 3: Año anterior
// ============================================================
function TabAnterior({ d }: { d: Decl }) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Datos de la declaración del año anterior</h2>
      <p className="text-sm text-muted-foreground">
        Información del Formulario 110 del AG 2024 que afecta los cálculos del año actual.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <NumField name="impuesto_neto_anterior" label="Impuesto neto AG 2024 (renglón 94)" defaultValue={d.impuesto_neto_anterior} />
        <NumField name="saldo_pagar_anterior" label="Saldo a pagar AG 2024 (renglón 113)" defaultValue={d.saldo_pagar_anterior} />
        <NumField name="saldo_favor_anterior" label="Saldo a favor AG 2024 (renglón 114)" defaultValue={d.saldo_favor_anterior} />
        <NumField name="anticipo_para_actual" label="Anticipo pagado para AG 2025 (renglón 108 anterior)" defaultValue={d.anticipo_para_actual} />
        <NumField name="anticipo_puntos_adicionales" label="Anticipo puntos adicionales AG anterior (renglón 109)" defaultValue={d.anticipo_puntos_adicionales} />
        <NumField name="patrimonio_bruto_anterior" label="Patrimonio bruto AG 2024 (renglón 44)" defaultValue={d.patrimonio_bruto_anterior} />
        <NumField name="pasivos_anterior" label="Pasivos AG 2024 (renglón 45)" defaultValue={d.pasivos_anterior} />
        <NumField name="perdidas_fiscales_acumuladas" label="Pérdidas fiscales acumuladas (sin compensar)" defaultValue={d.perdidas_fiscales_acumuladas} />
      </div>
    </div>
  );
}

// ============================================================
// Tab 4: Sanciones
// ============================================================
function TabSanciones({
  d,
  vencimientoSugerido,
  evaluacion,
  ultimoDigitoNit,
}: {
  d: Decl;
  vencimientoSugerido: string | null;
  evaluacion: EstadoPresentacion;
  ultimoDigitoNit: number | null;
}) {
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-xl">Vencimiento y presentación</h2>

      {/* Bloque calendario auto */}
      <div className="border border-border bg-muted/30 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          Calendario DIAN · Decreto 2229/2024
        </p>
        <p className="mt-1 text-sm">
          Último dígito del NIT:{" "}
          <span className="font-mono">
            {ultimoDigitoNit !== null ? ultimoDigitoNit : "—"}
          </span>
          {" · "}Tipo:{" "}
          <span className="font-mono">
            {d.es_gran_contribuyente ? "Gran Contribuyente" : "Persona Jurídica"}
          </span>
        </p>
        <p className="mt-2 text-sm">
          Vencimiento sugerido:{" "}
          <span className="font-medium">
            {vencimientoSugerido ?? "no disponible para el AG seleccionado"}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Si tu empresa cambia de tipo, los vencimientos se recalculan al guardar.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Fecha de vencimiento (override manual, opcional)">
          <Input
            name="fecha_vencimiento"
            type="date"
            defaultValue={d.fecha_vencimiento ?? ""}
            placeholder={vencimientoSugerido ?? ""}
          />
        </Field>
        <Field label="Fecha de presentación">
          <Input
            name="fecha_presentacion"
            type="date"
            defaultValue={d.fecha_presentacion ?? ""}
          />
        </Field>
      </div>

      {/* Resultado de la evaluación */}
      {evaluacion.estado === "oportuna" ? (
        <div className="border border-success/40 bg-success/5 p-4 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Estado de la presentación
          </p>
          <p className="mt-1 font-serif text-xl">Oportuna ✓</p>
          <p className="mt-1 text-muted-foreground">
            Presentada el {evaluacion.presentacion} · vence {evaluacion.vencimiento}.
          </p>
        </div>
      ) : evaluacion.estado === "extemporanea" ? (
        <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-destructive">
            Estado de la presentación
          </p>
          <p className="mt-1 font-serif text-xl">Extemporánea</p>
          <p className="mt-1">
            Presentada {evaluacion.diasDiferencia} día
            {evaluacion.diasDiferencia !== 1 ? "s" : ""} después del vencimiento (
            {evaluacion.mesesExtemporanea} mes{evaluacion.mesesExtemporanea !== 1 ? "es" : ""}{" "}
            de extemporaneidad para cálculo de sanción).
          </p>
          <p className="mt-1 text-muted-foreground">
            Activa "Calcular sanción por extemporaneidad" abajo para liquidar la sanción
            según el Art. 641/642 E.T.
          </p>
        </div>
      ) : (
        <div className="border border-border bg-muted/30 p-4 text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            Estado de la presentación
          </p>
          <p className="mt-1">Aún no registras fecha de presentación.</p>
        </div>
      )}

      <h2 className="mt-8 font-serif text-xl">Sanciones</h2>
      <p className="text-sm text-muted-foreground">
        Configura si aplica sanción por extemporaneidad o corrección. Tribai usa el UVT
        del año y los Arts. 641, 642, 644 E.T.
      </p>
      {evaluacion.estado === "oportuna" ? (
        <p className="text-xs text-muted-foreground">
          Tu declaración es <span className="font-medium text-foreground">oportuna</span>:
          la sanción por extemporaneidad no aplica aunque actives el flag (renglón 113 = 0
          por esa causal).
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <CheckField
          name="calcula_sancion_extemporaneidad"
          label="Calcular sanción por extemporaneidad (Arts. 641, 642 E.T.)"
          defaultChecked={d.calcula_sancion_extemporaneidad}
          disabled={evaluacion.estado !== "extemporanea"}
          help={
            evaluacion.estado === "oportuna"
              ? "Solo se habilita cuando la presentación es extemporánea."
              : evaluacion.estado === "no_presentada"
                ? "Configura primero la fecha de presentación."
                : undefined
          }
        />
        <CheckField
          name="calcula_sancion_correccion"
          label="Calcular sanción por corrección (Art. 644 E.T.)"
          defaultChecked={d.calcula_sancion_correccion}
        />
        <CheckField
          name="existe_emplazamiento"
          label="¿Existe emplazamiento previo?"
          defaultChecked={d.existe_emplazamiento}
          help="Sanciones aumentan si hay emplazamiento."
        />
        <Field label="Reducción aplicable">
          <Select name="reduccion_sancion" defaultValue={d.reduccion_sancion ?? "0"}>
            <option value="0">Sin reducción</option>
            <option value="50">50% (Art. 640 E.T.)</option>
            <option value="75">75% (Art. 640 E.T.)</option>
          </Select>
        </Field>
      </div>

      <h3 className="mt-6 font-serif text-lg">Datos para sanción por corrección</h3>
      <p className="text-xs text-muted-foreground">
        Solo aplica si activaste &ldquo;Calcular sanción por corrección&rdquo;.
        El mayor valor a pagar / menor saldo a favor es la diferencia entre lo
        liquidado en la declaración corregida y la original.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <NumField
          name="mayor_valor_correccion"
          label="Mayor valor a pagar / menor saldo a favor"
          defaultValue={d.mayor_valor_correccion}
        />
      </div>
    </div>
  );
}

// ============================================================
// Tab 5: Otros (información contable + datos nómina)
// ============================================================
function TabOtros({ d }: { d: Decl }) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-xl">Información contable del periodo</h2>
      <div className="grid gap-5 md:grid-cols-2">
        <NumField name="utilidad_contable" label="Utilidad contable (cuenta 3605)" defaultValue={d.utilidad_contable} />
        <NumField name="perdida_contable" label="Pérdida contable (cuenta 3610)" defaultValue={d.perdida_contable} />
      </div>

      <h2 className="mt-8 font-serif text-xl">Datos nómina (renglones 33-35 del 110)</h2>
      <div className="grid gap-5 md:grid-cols-3">
        <NumField name="total_nomina" label="Total costos y gastos de nómina" defaultValue={d.total_nomina} />
        <NumField name="aportes_seg_social" label="Aportes seguridad social" defaultValue={d.aportes_seg_social} />
        <NumField name="aportes_para_fiscales" label="Aportes SENA, ICBF, cajas" defaultValue={d.aportes_para_fiscales} />
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function CheckField({
  name,
  label,
  defaultChecked,
  help,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-md border border-border p-3 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/30"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 accent-foreground"
      />
      <div>
        <span className="text-sm">{label}</span>
        {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}
      </div>
    </label>
  );
}

function NumField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: number | string | null;
}) {
  return (
    <Field label={label}>
      <Input name={name} inputMode="numeric" defaultValue={fmt(defaultValue)} placeholder="0" />
    </Field>
  );
}

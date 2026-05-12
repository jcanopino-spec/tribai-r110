"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { saveH1Action, type SaveH1State } from "./actions";
import type { F2516H1Caratula } from "@/lib/f2516-hojas";

const ESTADO_INICIAL: SaveH1State = { ok: false, error: null };

// Catálogo oficial DIAN · tarifa según artículo aplicable
const TARIFAS_DIAN: { art: string; tarifa: number; etiqueta: string }[] = [
  { art: "Art. 240 E.T. (general)", tarifa: 0.35, etiqueta: "35% · Régimen general" },
  { art: "Art. 240 E.T. par. 1-2-4-5", tarifa: 0.09, etiqueta: "9% · Editoriales, hoteles, parques" },
  { art: "Art. 240-1 E.T. (Zona Franca par. 4)", tarifa: 0.15, etiqueta: "15% · Zona Franca par. 4" },
  { art: "Art. 240-1 E.T. (Zona Franca general)", tarifa: 0.2, etiqueta: "20% · Zona Franca general" },
  { art: "Art. 19-4 240 y 356 E.T.", tarifa: 0.2, etiqueta: "20% · Cooperativas y RTE" },
  { art: "Mega-inversiones hoteleras", tarifa: 0.09, etiqueta: "9% · Mega-inversiones hoteleras" },
];

// 22 flags MUISCA · campos 30-51 oficiales
const FLAGS_DIAN: { id: keyof F2516H1Caratula; num: number; label: string }[] = [
  { id: "pn_sin_residencia", num: 30, label: "Persona Natural sin residencia" },
  { id: "rte", num: 31, label: "Contribuyente del Régimen Tributario Especial (RTE)" },
  { id: "entidad_cooperativa", num: 32, label: "Entidad Cooperativa (Art. 19-4 E.T.)" },
  { id: "entidad_sector_financiero", num: 33, label: "Entidad del sector financiero" },
  { id: "nueva_sociedad_zomac", num: 34, label: "Nueva sociedad - ZOMAC" },
  { id: "obras_por_impuestos_zomac", num: 35, label: "Obras por impuestos - ZOMAC" },
  { id: "reorganizacion_empresarial", num: 36, label: "Programa de reorganización empresarial durante el año" },
  { id: "soc_extranjera_transporte", num: 37, label: "Soc. extranjera de transporte entre Colombia y exterior" },
  { id: "sist_especial_valoracion", num: 38, label: "Obligado a aplicar sistemas especiales de valoración de inversiones" },
  { id: "costo_inv_juego_inv", num: 39, label: "Costo de inventarios por sistema juego de inventarios" },
  { id: "costo_inv_simultaneo", num: 40, label: "Costo de inventarios simultáneo (juego + identificación específica)" },
  { id: "progresividad_tarifa", num: 41, label: "Progresividad de la tarifa de renta · soc. extranjera o nuevas pequeñas" },
  { id: "contrato_estabilidad", num: 42, label: "Contrato de estabilidad jurídica" },
  { id: "moneda_funcional_diferente", num: 43, label: "Moneda funcional diferente al peso colombiano" },
  { id: "mega_inversiones", num: 44, label: "Mega-Inversiones" },
  { id: "economia_naranja", num: 45, label: "Empresa de Economía Naranja" },
  { id: "holding_colombiana", num: 46, label: "Compañía Holding Colombiana (CHC)" },
  { id: "zese", num: 47, label: "Zona Económica y Social Especial (ZESE)" },
  { id: "extraccion_hulla_carbon", num: 48, label: "Extracción de hulla / carbón (CIIU 0510, 0520)" },
  { id: "extraccion_petroleo", num: 49, label: "Extracción de petróleo crudo (CIIU 0610)" },
  { id: "generacion_energia_hidro", num: 50, label: "Generación de energía eléctrica · recursos hídricos" },
  { id: "zona_franca", num: 51, label: "Zona Franca" },
];

const DIAN_BLUE = "#1B5AAB";
const DIAN_BLUE_LIGHT = "#E8F1FA";
const TRIBAI_GOLD = "#C4952A";

export function H1Form({
  declId,
  empresaId,
  initial,
  empresa,
  anoGravable,
}: {
  declId: string;
  empresaId: string;
  initial: F2516H1Caratula | null;
  empresa: {
    razon_social: string;
    nit: string;
    dv: string | null;
    regimen_codigo: string | null;
    ciiu_codigo: string | null;
  };
  anoGravable: number;
}) {
  const action = saveH1Action.bind(null, declId, empresaId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);
  const router = useRouter();

  const [obligadoRF, setObligadoRF] = useState(
    initial?.obligado_revisor_fiscal ?? false,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      {/* === Banner DIAN oficial === */}
      <div className="rounded-md border" style={{ borderColor: DIAN_BLUE }}>
        <div
          className="px-5 py-3 text-center text-white"
          style={{ backgroundColor: DIAN_BLUE }}
        >
          <h2 className="text-base font-bold uppercase tracking-wide">
            REPORTE DE CONCILIACIÓN FISCAL · ANEXO FORMULARIO 110
          </h2>
          <p className="text-xs opacity-90">
            Hoja 1 · Carátula · Resolución DIAN 71/2019 (modelo oficial)
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 px-5 py-4" style={{ backgroundColor: DIAN_BLUE_LIGHT }}>
          <div>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">1. Año gravable</span>
            <p className="font-mono font-bold">{anoGravable}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">NIT</span>
            <p className="font-mono font-bold">
              {empresa.nit}
              {empresa.dv ? "-" + empresa.dv : ""}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-muted-foreground">11. Razón social</span>
            <p className="font-bold">{empresa.razon_social}</p>
          </div>
        </div>
      </div>

      {/* === Sección 29 · Tarifa aplicable === */}
      <DianSection num="29" titulo="Tarifa aplicable">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Artículo aplicable">
            <select
              name="art_aplicable"
              defaultValue={initial?.art_aplicable ?? "Art. 240 E.T. (general)"}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {TARIFAS_DIAN.map((t) => (
                <option key={t.art} value={t.art}>
                  {t.etiqueta} · {t.art}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tarifa decimal (ej. 0.35)">
            <Input
              name="tarifa_aplicable"
              type="number"
              step="0.0001"
              defaultValue={initial?.tarifa_aplicable ?? 0.35}
            />
          </Field>
        </div>
      </DianSection>

      {/* === Sección 30-51 · Datos informativos (22 flags SI/NO) === */}
      <DianSection num="30-51" titulo="Datos informativos · SI / NO">
        <p className="mb-4 text-xs text-muted-foreground">
          Marque las casillas aplicables según la condición tributaria del
          contribuyente. Los flags activan reglas específicas de tarifa,
          rentas exentas, beneficio auditoría, sobretasa y demás.
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {FLAGS_DIAN.map((f) => (
            <FlagCheckbox
              key={f.id}
              name={f.id as string}
              num={f.num}
              label={f.label}
              defaultChecked={Boolean(initial?.[f.id])}
            />
          ))}
        </div>
      </DianSection>

      {/* === Bloque · Identificación complementaria === */}
      <DianSection num="A" titulo="Datos del declarante (complementarios)">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Marco normativo contable">
            <select
              name="marco_normativo"
              defaultValue={initial?.marco_normativo ?? "NIIF Pymes"}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="NIIF Plenas">NIIF Plenas</option>
              <option value="NIIF Pymes">NIIF Pymes</option>
              <option value="NIF Microempresas">NIF Microempresas</option>
            </select>
          </Field>
          <Field label="Dirección de notificación">
            <Input name="direccion_notificacion" defaultValue={initial?.direccion_notificacion ?? ""} />
          </Field>
          <Field label="Departamento (código DANE)">
            <Input name="departamento_codigo" defaultValue={initial?.departamento_codigo ?? ""} placeholder="11" />
          </Field>
          <Field label="Municipio (código DANE)">
            <Input name="municipio_codigo" defaultValue={initial?.municipio_codigo ?? ""} placeholder="001" />
          </Field>
          <Field label="Teléfono">
            <Input name="telefono" defaultValue={initial?.telefono ?? ""} />
          </Field>
          <Field label="Correo electrónico">
            <Input name="correo" type="email" defaultValue={initial?.correo ?? ""} />
          </Field>
        </div>
      </DianSection>

      {/* === Sección · Representante Legal === */}
      <DianSection num="B" titulo="Representante legal">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <Input name="rep_legal_nombre" defaultValue={initial?.rep_legal_nombre ?? ""} />
          </Field>
          <Field label="Cargo">
            <Input
              name="rep_legal_cargo"
              defaultValue={initial?.rep_legal_cargo ?? "Representante Legal"}
            />
          </Field>
          <Field label="Tipo documento">
            <TipoDocSelect name="rep_legal_tipo_doc" defaultValue={initial?.rep_legal_tipo_doc ?? "CC"} />
          </Field>
          <Field label="Número documento">
            <Input name="rep_legal_numero_doc" defaultValue={initial?.rep_legal_numero_doc ?? ""} />
          </Field>
        </div>
      </DianSection>

      {/* === Sección · Contador === */}
      <DianSection num="C" titulo="Contador Público">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre completo">
            <Input name="contador_nombre" defaultValue={initial?.contador_nombre ?? ""} />
          </Field>
          <Field label="Tarjeta profesional">
            <Input name="contador_tarjeta_prof" defaultValue={initial?.contador_tarjeta_prof ?? ""} />
          </Field>
          <Field label="Tipo documento">
            <TipoDocSelect name="contador_tipo_doc" defaultValue={initial?.contador_tipo_doc ?? "CC"} />
          </Field>
          <Field label="Número documento">
            <Input name="contador_numero_doc" defaultValue={initial?.contador_numero_doc ?? ""} />
          </Field>
        </div>
      </DianSection>

      {/* === Sección · Revisor Fiscal === */}
      <DianSection num="D" titulo="Revisor Fiscal">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="obligado_revisor_fiscal"
            checked={obligadoRF}
            onChange={(e) => setObligadoRF(e.target.checked)}
            className="h-4 w-4"
          />
          <span>¿La empresa está obligada a tener Revisor Fiscal?</span>
        </label>
        {obligadoRF && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Nombre completo">
              <Input name="rf_nombre" defaultValue={initial?.rf_nombre ?? ""} />
            </Field>
            <Field label="Tarjeta profesional">
              <Input name="rf_tarjeta_prof" defaultValue={initial?.rf_tarjeta_prof ?? ""} />
            </Field>
            <Field label="Tipo documento">
              <TipoDocSelect name="rf_tipo_doc" defaultValue={initial?.rf_tipo_doc ?? "CC"} />
            </Field>
            <Field label="Número documento">
              <Input name="rf_numero_doc" defaultValue={initial?.rf_numero_doc ?? ""} />
            </Field>
          </div>
        )}
      </DianSection>

      {/* === Sección · Signatario (89-997 MUISCA) === */}
      <DianSection num="89-997" titulo="Signatario y representación · campos MUISCA">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="89. NIT signatario">
            <Input name="signatario_nit" defaultValue={initial?.signatario_nit ?? ""} />
          </Field>
          <Field label="90. DV signatario">
            <Input name="signatario_dv" defaultValue={initial?.signatario_dv ?? ""} />
          </Field>
          <Field label="981. Código de representación">
            <Input name="codigo_representacion" defaultValue={initial?.codigo_representacion ?? ""} />
          </Field>
          <Field label="982. Código contador / RF">
            <Input name="codigo_contador_rf" defaultValue={initial?.codigo_contador_rf ?? ""} />
          </Field>
          <Field label="983. Número tarjeta profesional">
            <Input name="numero_tarjeta_profesional" defaultValue={initial?.numero_tarjeta_profesional ?? ""} />
          </Field>
          <Field label="997. Fecha efectiva de la transacción">
            <Input
              name="fecha_efectiva_transaccion"
              type="date"
              defaultValue={initial?.fecha_efectiva_transaccion ?? ""}
            />
          </Field>
          <label className="col-span-full flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="con_salvedades"
              defaultChecked={initial?.con_salvedades ?? false}
              className="h-4 w-4"
            />
            <span>994. Con salvedades (firma del contador / RF)</span>
          </label>
        </div>
      </DianSection>

      <DianSection num="" titulo="Observaciones">
        <Field label="Notas sobre la carátula">
          <Input name="observaciones" defaultValue={initial?.observaciones ?? ""} />
        </Field>
      </DianSection>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">Guardado.</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} style={{ backgroundColor: DIAN_BLUE }}>
          {pending ? "Guardando…" : "Guardar carátula"}
        </Button>
      </div>
    </form>
  );
}

function DianSection({
  num,
  titulo,
  children,
}: {
  num: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border" style={{ borderColor: DIAN_BLUE }}>
      <div
        className="flex items-center gap-2 px-4 py-2 text-white"
        style={{ backgroundColor: DIAN_BLUE }}
      >
        {num ? (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-mono font-bold"
            style={{ backgroundColor: TRIBAI_GOLD, color: DIAN_BLUE }}
          >
            {num}
          </span>
        ) : null}
        <h3 className="text-sm font-bold uppercase tracking-wide">{titulo}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function FlagCheckbox({
  name,
  num,
  label,
  defaultChecked,
}: {
  name: string;
  num: number;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded border border-border px-3 py-2 text-xs hover:bg-muted/50">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4"
      />
      <div className="min-w-0 flex-1">
        <span
          className="mr-2 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
          style={{ backgroundColor: DIAN_BLUE_LIGHT, color: DIAN_BLUE }}
        >
          {num}
        </span>
        <span>{label}</span>
      </div>
    </label>
  );
}

function TipoDocSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
    >
      <option value="CC">CC · Cédula de Ciudadanía</option>
      <option value="CE">CE · Cédula de Extranjería</option>
      <option value="PA">PA · Pasaporte</option>
      <option value="TI">TI · Tarjeta de Identidad</option>
    </select>
  );
}

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const declId = url.searchParams.get("decl");
  if (!declId) {
    return NextResponse.json({ error: "Missing decl param" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verifica sesión y RLS por dueño
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: declaracion } = await supabase
    .from("declaraciones")
    .select("id, ano_gravable, empresa:empresas(id, razon_social, nit, dv)")
    .eq("id", declId)
    .single();
  if (!declaracion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("anexo_retenciones")
    .select("tipo, concepto, agente, nit, base, retenido, created_at")
    .eq("declaracion_id", declId)
    .order("tipo")
    .order("created_at");

  const rows = items ?? [];
  const retenciones = rows.filter((r) => r.tipo === "retencion");
  const autorretenciones = rows.filter((r) => r.tipo === "autorretencion");
  const totalRet = retenciones.reduce((s, r) => s + Number(r.retenido), 0);
  const totalAut = autorretenciones.reduce((s, r) => s + Number(r.retenido), 0);

  // Tipo amplio para el join Supabase (empresa puede venir como objeto o array)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const empresa: any = declaracion.empresa;
  const razonSocial = empresa?.razon_social ?? "—";
  const nitEmpresa = empresa?.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  // ============================================================
  // Hoja 1 · Detalle (todas las retenciones + autorretenciones)
  // ============================================================
  const detalleData: (string | number)[][] = [
    [`Retenciones y autorretenciones · ${razonSocial} (NIT ${nitEmpresa})`],
    [`Año gravable ${declaracion.ano_gravable}`],
    [`Generado ${new Date().toLocaleString("es-CO")}`],
    [],
    [
      "Tipo",
      "Concepto",
      "Agente retenedor",
      "NIT agente",
      "Base",
      "Retenido",
      "Fecha registro",
    ],
  ];

  for (const r of retenciones) {
    detalleData.push([
      "Retención (R106)",
      r.concepto,
      r.agente ?? "",
      r.nit ?? "",
      Number(r.base),
      Number(r.retenido),
      new Date(r.created_at).toLocaleDateString("es-CO"),
    ]);
  }
  if (retenciones.length > 0) {
    detalleData.push([
      "",
      "",
      "",
      "Subtotal Retenciones (R106)",
      retenciones.reduce((s, r) => s + Number(r.base), 0),
      totalRet,
      "",
    ]);
    detalleData.push([]);
  }

  for (const r of autorretenciones) {
    detalleData.push([
      "Autorretención (R105)",
      r.concepto,
      r.agente ?? "",
      r.nit ?? "",
      Number(r.base),
      Number(r.retenido),
      new Date(r.created_at).toLocaleDateString("es-CO"),
    ]);
  }
  if (autorretenciones.length > 0) {
    detalleData.push([
      "",
      "",
      "",
      "Subtotal Autorretenciones (R105)",
      autorretenciones.reduce((s, r) => s + Number(r.base), 0),
      totalAut,
      "",
    ]);
  }

  detalleData.push([]);
  detalleData.push([
    "",
    "",
    "",
    "TOTAL R107 = R105 + R106",
    "",
    totalRet + totalAut,
    "",
  ]);

  const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
  // Anchos de columna razonables
  wsDetalle["!cols"] = [
    { wch: 22 }, // Tipo
    { wch: 50 }, // Concepto
    { wch: 30 }, // Agente
    { wch: 14 }, // NIT
    { wch: 18 }, // Base
    { wch: 18 }, // Retenido
    { wch: 14 }, // Fecha
  ];

  // ============================================================
  // Hoja 2 · Resumen por concepto (útil para validación cruzada)
  // ============================================================
  const resumenMap = new Map<
    string,
    { tipo: string; conteo: number; base: number; retenido: number }
  >();
  for (const r of rows) {
    const key = `${r.tipo}|${r.concepto}`;
    const prev = resumenMap.get(key) ?? {
      tipo:
        r.tipo === "retencion" ? "Retención (R106)" : "Autorretención (R105)",
      conteo: 0,
      base: 0,
      retenido: 0,
    };
    prev.conteo += 1;
    prev.base += Number(r.base);
    prev.retenido += Number(r.retenido);
    resumenMap.set(key, prev);
  }

  const resumenData: (string | number)[][] = [
    ["Resumen por concepto"],
    [],
    ["Tipo", "Concepto", "Líneas", "Base total", "Retenido total"],
  ];
  for (const [key, v] of resumenMap) {
    const concepto = key.split("|")[1];
    resumenData.push([v.tipo, concepto, v.conteo, v.base, v.retenido]);
  }
  resumenData.push([]);
  resumenData.push([
    "",
    "TOTAL",
    rows.length,
    rows.reduce((s, r) => s + Number(r.base), 0),
    totalRet + totalAut,
  ]);

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  wsResumen["!cols"] = [
    { wch: 22 },
    { wch: 50 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
  ];

  // ============================================================
  // Workbook
  // ============================================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle");
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `retenciones_${nitEmpresa.replace(/-/g, "")}_${declaracion.ano_gravable}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

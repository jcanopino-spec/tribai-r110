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
    .from("anexo_seg_social")
    .select(
      "empleado, cedula, salario, aporte_salud, aporte_pension, aporte_arl, aporte_parafiscales, observacion",
    )
    .eq("declaracion_id", declId)
    .order("empleado");

  const rows = items ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const empresa: any = declaracion.empresa;
  const razonSocial = empresa?.razon_social ?? "—";
  const nitEmpresa = empresa?.nit
    ? `${empresa.nit}${empresa.dv ? `-${empresa.dv}` : ""}`
    : "—";

  const totalSalario = rows.reduce((s, r) => s + Number(r.salario), 0);
  const totalSalud = rows.reduce((s, r) => s + Number(r.aporte_salud), 0);
  const totalPension = rows.reduce((s, r) => s + Number(r.aporte_pension), 0);
  const totalArl = rows.reduce((s, r) => s + Number(r.aporte_arl), 0);
  const totalPara = rows.reduce((s, r) => s + Number(r.aporte_parafiscales), 0);
  const totalAportes = totalSalud + totalPension + totalArl + totalPara;

  // ============================================================
  // Hoja 1 · Detalle por empleado (cruce con PILA / nómina)
  // ============================================================
  const detalle: (string | number)[][] = [
    [`Seguridad Social · ${razonSocial} (NIT ${nitEmpresa})`],
    [`Año gravable ${declaracion.ano_gravable}`],
    [`Generado ${new Date().toLocaleString("es-CO")}`],
    [],
    [
      "Empleado",
      "Cédula",
      "Salario",
      "Aporte Salud",
      "Aporte Pensión",
      "Aporte ARL",
      "Aporte Parafiscales",
      "Total aportes",
      "Observación",
    ],
  ];

  for (const r of rows) {
    const tot =
      Number(r.aporte_salud) +
      Number(r.aporte_pension) +
      Number(r.aporte_arl) +
      Number(r.aporte_parafiscales);
    detalle.push([
      r.empleado,
      r.cedula ?? "",
      Number(r.salario),
      Number(r.aporte_salud),
      Number(r.aporte_pension),
      Number(r.aporte_arl),
      Number(r.aporte_parafiscales),
      tot,
      r.observacion ?? "",
    ]);
  }

  detalle.push([]);
  detalle.push([
    "TOTAL",
    "",
    totalSalario,
    totalSalud,
    totalPension,
    totalArl,
    totalPara,
    totalAportes,
    "",
  ]);

  const wsDetalle = XLSX.utils.aoa_to_sheet(detalle);
  wsDetalle["!cols"] = [
    { wch: 32 }, // Empleado
    { wch: 14 }, // Cédula
    { wch: 16 }, // Salario
    { wch: 14 }, // Salud
    { wch: 14 }, // Pensión
    { wch: 14 }, // ARL
    { wch: 16 }, // Parafiscales
    { wch: 16 }, // Total
    { wch: 30 }, // Observación
  ];

  // ============================================================
  // Hoja 2 · Resumen consolidado (alimenta R34/R35 del 110)
  // ============================================================
  const resumen: (string | number)[][] = [
    ["Resumen consolidado"],
    [],
    ["Concepto", "Valor", "Renglón 110"],
    ["Total costos y gastos de nómina (R33)", totalSalario, "33"],
    ["Aportes al Sistema de Seguridad Social (R34)", totalSalud + totalPension + totalArl, "34"],
    ["  · Salud", totalSalud, ""],
    ["  · Pensión", totalPension, ""],
    ["  · ARL", totalArl, ""],
    ["Aportes SENA, ICBF, Cajas (R35)", totalPara, "35"],
    [],
    ["Total empleados", rows.length, ""],
    [
      "Carga prestacional efectiva",
      totalSalario > 0
        ? `${((totalAportes / totalSalario) * 100).toFixed(2)}%`
        : "—",
      "",
    ],
    [],
    [
      "Recordatorio · Art. 108 E.T.: para que los pagos laborales sean deducibles,",
    ],
    ["los aportes deben estar efectivamente pagados ANTES de presentar la declaración."],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  wsResumen["!cols"] = [{ wch: 50 }, { wch: 18 }, { wch: 14 }];

  // ============================================================
  // Workbook
  // ============================================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle por empleado");
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `seguridad_social_${nitEmpresa.replace(/-/g, "")}_${declaracion.ano_gravable}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

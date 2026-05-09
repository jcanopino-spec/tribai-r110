"use server";

import { revalidateDeclaracion } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import type { State, Periodicidad } from "./consts";

function parseN(s: string | FormDataEntryValue | null): number {
  const cleaned = String(s ?? "").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const STORAGE_BUCKET = "anexo-iva-pdfs";

/**
 * Guarda (insert/update) una declaración de IVA. Si se incluye un File
 * (campo `pdf_file`), lo sube al bucket de Storage y guarda la ruta.
 *
 * Upsert por (declaracion_id, periodicidad, periodo).
 */
export async function saveIvaAction(
  declId: string,
  empresaId: string,
  _prev: State,
  form: FormData,
): Promise<State> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada.", ok: false };

  const periodicidad = String(form.get("periodicidad") ?? "") as Periodicidad;
  if (periodicidad !== "bimestral" && periodicidad !== "cuatrimestral") {
    return { error: "Periodicidad inválida.", ok: false };
  }
  const periodo = Number(form.get("periodo") ?? 0);
  const maxPeriodo = periodicidad === "bimestral" ? 6 : 3;
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > maxPeriodo) {
    return { error: `Periodo debe estar entre 1 y ${maxPeriodo}.`, ok: false };
  }

  const fechaRaw = String(form.get("fecha_presentacion") ?? "").trim();
  const fecha_presentacion = fechaRaw || null;
  const numero_formulario =
    String(form.get("numero_formulario") ?? "").trim() || null;
  const observacion = String(form.get("observacion") ?? "").trim() || null;

  // Subida de PDF opcional
  const pdfFile = form.get("pdf_file");
  let pdf_path: string | null = null;
  let pdf_filename: string | null = null;
  if (pdfFile instanceof File && pdfFile.size > 0) {
    if (pdfFile.size > 10 * 1024 * 1024) {
      return { error: "El PDF supera 10 MB.", ok: false };
    }
    const safeName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${declId}/${periodicidad}-${periodo}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, pdfFile, {
        contentType: pdfFile.type || "application/pdf",
        upsert: true,
      });
    // Si el bucket no existe, fallamos silencioso pero guardamos los datos
    if (uploadError) {
      if (
        !uploadError.message.toLowerCase().includes("bucket") &&
        !uploadError.message.toLowerCase().includes("not found")
      ) {
        return { error: `Error subiendo PDF: ${uploadError.message}`, ok: false };
      }
      // Bucket no existe · seguimos sin pdf_path · el usuario tiene que
      // crear el bucket en Supabase Dashboard antes de poder guardar PDFs
    } else {
      pdf_path = path;
      pdf_filename = pdfFile.name;
    }
  }

  const payload = {
    declaracion_id: declId,
    periodicidad,
    periodo,
    fecha_presentacion,
    numero_formulario,
    ingresos_brutos: parseN(form.get("ingresos_brutos")),
    devoluciones: parseN(form.get("devoluciones")),
    ingresos_no_gravados: parseN(form.get("ingresos_no_gravados")),
    ingresos_exentos: parseN(form.get("ingresos_exentos")),
    ingresos_gravados: parseN(form.get("ingresos_gravados")),
    iva_generado: parseN(form.get("iva_generado")),
    iva_descontable: parseN(form.get("iva_descontable")),
    saldo_pagar: parseN(form.get("saldo_pagar")),
    saldo_favor: parseN(form.get("saldo_favor")),
    pdf_path,
    pdf_filename,
    observacion,
  };

  // Upsert por unique index (declaracion_id, periodicidad, periodo)
  const { error } = await supabase
    .from("anexo_iva_declaraciones")
    .upsert(payload, { onConflict: "declaracion_id,periodicidad,periodo" });
  if (error) return { error: error.message, ok: false };

  revalidateDeclaracion(empresaId, declId);
  return { error: null, ok: true };
}

export async function deleteIvaAction(
  id: number,
  declId: string,
  empresaId: string,
) {
  const supabase = await createClient();
  // Borrar PDF asociado si existe
  const { data: row } = await supabase
    .from("anexo_iva_declaraciones")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.pdf_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([row.pdf_path]);
  }
  await supabase.from("anexo_iva_declaraciones").delete().eq("id", id);
  revalidateDeclaracion(empresaId, declId);
}

/**
 * Genera URL firmada del PDF (válida 1 hora) para que el usuario lo
 * descargue/visualice. Devuelve null si Storage no está disponible o
 * el path no existe.
 */
export async function getPdfUrlAction(pdfPath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(pdfPath, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

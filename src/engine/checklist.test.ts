import { describe, it, expect } from "vitest";
import {
  CHECKLIST_ITEMS,
  evaluarChecklist,
  resumenChecklist,
  type ChecklistContext,
} from "./checklist";

const baseCtx: ChecklistContext = {
  nit: "900123456",
  dv: "7",
  ciiu: "0111",
  razonSocial: "Empresa SAS",
  regimenCodigo: "01",
  tarifaRegimen: 0.35,
  numerico: new Map(),
  presentacionOportuna: true,
  ttdAplicaPorRegimen: true,
  esVinculadoSubcap: false,
  codRepresentacion: "01",
  codContadorRF: "02",
  hayDescuadresF2516: false,
  calculaAnticipo: true,
  aniosDeclarando: "tercero_o_mas",
};

describe("CHECKLIST_ITEMS · catálogo", () => {
  it("23 items totales", () => {
    expect(CHECKLIST_ITEMS.length).toBe(23);
  });

  it("7 secciones", () => {
    const secciones = new Set(CHECKLIST_ITEMS.map((i) => i.seccion));
    expect(secciones.size).toBe(7);
  });

  it("cada item tiene id único", () => {
    const ids = CHECKLIST_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("evaluarChecklist · DATOS", () => {
  it("NIT y DV completos → ok", () => {
    const r = evaluarChecklist(baseCtx);
    const item = r.find((x) => x.item.id === "DATOS_1_NIT")!;
    expect(item.estado).toBe("ok");
  });

  it("sin NIT → fail", () => {
    const r = evaluarChecklist({ ...baseCtx, nit: null });
    const item = r.find((x) => x.item.id === "DATOS_1_NIT")!;
    expect(item.estado).toBe("fail");
  });

  it("CIIU actualizado → ok", () => {
    const r = evaluarChecklist(baseCtx);
    expect(r.find((x) => x.item.id === "DATOS_3_CIIU")!.estado).toBe("ok");
  });

  it("sin CIIU → fail", () => {
    const r = evaluarChecklist({ ...baseCtx, ciiu: null });
    expect(r.find((x) => x.item.id === "DATOS_3_CIIU")!.estado).toBe("fail");
  });
});

describe("evaluarChecklist · LIQUIDACION", () => {
  it("régimen y tarifa OK → LIQ_1 ok", () => {
    const r = evaluarChecklist(baseCtx);
    expect(r.find((x) => x.item.id === "LIQ_1_TARIFA")!.estado).toBe("ok");
  });

  it("régimen sin asignar → LIQ_1 fail", () => {
    const r = evaluarChecklist({ ...baseCtx, regimenCodigo: null });
    expect(r.find((x) => x.item.id === "LIQ_1_TARIFA")!.estado).toBe("fail");
  });

  it("régimen exonerado de TTD → LIQ_2 n_a", () => {
    const r = evaluarChecklist({ ...baseCtx, ttdAplicaPorRegimen: false });
    expect(r.find((x) => x.item.id === "LIQ_2_TTD")!.estado).toBe("n_a");
  });

  it("descuentos respetan tope 75% R84 → LIQ_3 ok", () => {
    const num = new Map<number, number>([[84, 100_000_000], [93, 50_000_000]]);
    const r = evaluarChecklist({ ...baseCtx, numerico: num });
    expect(r.find((x) => x.item.id === "LIQ_3_DESC_LIM")!.estado).toBe("ok");
  });

  it("descuentos superan tope → LIQ_3 fail", () => {
    const num = new Map<number, number>([[84, 100_000_000], [93, 80_000_000]]);
    const r = evaluarChecklist({ ...baseCtx, numerico: num });
    expect(r.find((x) => x.item.id === "LIQ_3_DESC_LIM")!.estado).toBe("fail");
  });

  it("primer año declarando → LIQ_4 n_a", () => {
    const r = evaluarChecklist({ ...baseCtx, aniosDeclarando: "primero" });
    expect(r.find((x) => x.item.id === "LIQ_4_ANTICIPO")!.estado).toBe("n_a");
  });

  it("no calcula anticipo en año posterior → LIQ_4 fail", () => {
    const r = evaluarChecklist({ ...baseCtx, calculaAnticipo: false });
    expect(r.find((x) => x.item.id === "LIQ_4_ANTICIPO")!.estado).toBe("fail");
  });
});

describe("evaluarChecklist · CONCILIACION", () => {
  it("F2516 sin descuadres → CONC_3 ok", () => {
    const r = evaluarChecklist(baseCtx);
    expect(r.find((x) => x.item.id === "CONC_3_F2516")!.estado).toBe("ok");
  });

  it("F2516 con descuadres → CONC_3 fail", () => {
    const r = evaluarChecklist({ ...baseCtx, hayDescuadresF2516: true });
    expect(r.find((x) => x.item.id === "CONC_3_F2516")!.estado).toBe("fail");
  });
});

describe("evaluarChecklist · FORMAL", () => {
  it("presentación oportuna + firmas → FORM ok", () => {
    const r = evaluarChecklist(baseCtx);
    expect(r.find((x) => x.item.id === "FORM_1_PLAZO")!.estado).toBe("ok");
    expect(r.find((x) => x.item.id === "FORM_2_FIRMA_REP")!.estado).toBe("ok");
    expect(r.find((x) => x.item.id === "FORM_3_FIRMA_CR")!.estado).toBe("ok");
  });

  it("presentación extemporánea → FORM_1 fail", () => {
    const r = evaluarChecklist({ ...baseCtx, presentacionOportuna: false });
    expect(r.find((x) => x.item.id === "FORM_1_PLAZO")!.estado).toBe("fail");
  });

  it("sin firma rep legal → FORM_2 fail", () => {
    const r = evaluarChecklist({ ...baseCtx, codRepresentacion: null });
    expect(r.find((x) => x.item.id === "FORM_2_FIRMA_REP")!.estado).toBe("fail");
  });
});

describe("evaluarChecklist · COSTOS subcapitalización", () => {
  it("no vinculado → COSTO_3 n_a", () => {
    const r = evaluarChecklist({ ...baseCtx, esVinculadoSubcap: false });
    expect(r.find((x) => x.item.id === "COSTO_3_SUBCAP")!.estado).toBe("n_a");
  });

  it("vinculado → COSTO_3 manual", () => {
    const r = evaluarChecklist({ ...baseCtx, esVinculadoSubcap: true });
    expect(r.find((x) => x.item.id === "COSTO_3_SUBCAP")!.estado).toBe("manual");
  });
});

describe("evaluarChecklist · items manual", () => {
  it("todos los items con tipo='manual' devuelven estado='manual'", () => {
    const r = evaluarChecklist(baseCtx);
    const manualItems = CHECKLIST_ITEMS.filter((x) => x.tipo === "manual");
    for (const item of manualItems) {
      const res = r.find((x) => x.item.id === item.id);
      expect(res?.estado).toBe("manual");
    }
  });
});

describe("resumenChecklist", () => {
  it("cuenta ok/fail/manual/n_a y bloqueante", () => {
    const r = evaluarChecklist({
      ...baseCtx,
      regimenCodigo: null,
      hayDescuadresF2516: true,
    });
    const res = resumenChecklist(r);
    expect(res.fail).toBeGreaterThanOrEqual(2);
    expect(res.bloqueante).toBe(true);
    expect(res.total).toBe(23);
  });

  it("sin fails → no bloqueante", () => {
    const r = evaluarChecklist(baseCtx);
    const res = resumenChecklist(r);
    expect(res.bloqueante).toBe(false);
  });
});

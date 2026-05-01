"""Siembra los catalogos extraidos en Supabase via la REST API.

Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o lee .env.local).
Idempotente: usa upsert via Prefer: resolution=merge-duplicates.

Catalogos:
  01_ciiu.json                    → ciiu_codigos
  02_direcciones_seccionales.json → direcciones_seccionales
  03_regimenes_tarifas.json       → regimenes_tarifas (con ano_gravable=2025)
  04_formulario_110.json          → form110_renglones (con ano_gravable=2025)
  05_hoja_sumaria.json            → puc_accounts (con ano_gravable=2025)
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.request
import urllib.error
from pathlib import Path

import certifi

SSL_CTX = ssl.create_default_context(cafile=certifi.where())

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "extracted"


def load_env():
    env_file = ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def post(table: str, rows: list[dict], on_conflict: str | None = None):
    url = f"{os.environ['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    body = json.dumps(rows).encode()
    headers = {
        "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
        raise


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def seed_ciiu():
    rows = json.loads((DATA / "01_ciiu.json").read_text())
    payload = [{"codigo": r["codigo"], "descripcion": r["descripcion"]} for r in rows]
    post("ciiu_codigos", payload, on_conflict="codigo")
    print(f"ciiu_codigos: {len(payload)}")


def seed_direcciones():
    rows = json.loads((DATA / "02_direcciones_seccionales.json").read_text())
    payload = [{"codigo": r["codigo"], "nombre": r["nombre"]} for r in rows]
    post("direcciones_seccionales", payload, on_conflict="codigo")
    print(f"direcciones_seccionales: {len(payload)}")


def seed_regimenes(ano: int = 2025):
    rows = json.loads((DATA / "03_regimenes_tarifas.json").read_text())
    payload = [
        {
            "codigo": r["codigo"],
            "ano_gravable": ano,
            "descripcion": r["descripcion"],
            "tarifa": round(r["tarifa"], 4),
        }
        for r in rows
    ]
    post("regimenes_tarifas", payload, on_conflict="codigo,ano_gravable")
    print(f"regimenes_tarifas (AG{ano}): {len(payload)}")


def seed_form110(ano: int = 2025):
    rows = json.loads((DATA / "04_formulario_110.json").read_text())
    payload = []
    for r in rows:
        payload.append(
            {
                "ano_gravable": ano,
                "numero": r["numero"],
                "descripcion": r["descripcion"],
                "seccion": r.get("seccion") or "Sin sección",
                "formula_xlsm": r.get("formula_xlsm"),
                "fuente_celda": r.get("fuente_celda"),
            }
        )
    post("form110_renglones", payload, on_conflict="ano_gravable,numero")
    print(f"form110_renglones (AG{ano}): {len(payload)}")


def seed_puc(ano: int = 2025):
    rows = json.loads((DATA / "05_hoja_sumaria.json").read_text())
    payload = []
    seen_pucs: set[str] = set()
    for r in rows:
        puc = r["puc"]
        if puc in seen_pucs:
            continue
        seen_pucs.add(puc)

        renglon = r.get("renglon_110")
        if renglon is not None and not isinstance(renglon, int):
            renglon = None

        anexo = r.get("anexo")
        if isinstance(anexo, int):
            anexo = str(anexo)

        f2516 = r.get("f2516")
        if isinstance(f2516, int):
            f2516 = str(f2516)

        payload.append(
            {
                "puc": puc,
                "descripcion": r.get("descripcion") or None,
                "renglon_110": renglon,
                "anexo": anexo,
                "f2516": f2516,
                "ttd": r.get("ttd") or None,
                "ano_gravable": ano,
            }
        )

    total = 0
    for batch in chunked(payload, 500):
        post("puc_accounts", batch, on_conflict="puc")
        total += len(batch)
        print(f"  puc batch: {total}/{len(payload)}")
    print(f"puc_accounts: {total}")


def main():
    load_env()
    if "NEXT_PUBLIC_SUPABASE_URL" not in os.environ:
        print("Falta NEXT_PUBLIC_SUPABASE_URL", file=sys.stderr)
        sys.exit(1)

    seed_ciiu()
    seed_direcciones()
    seed_regimenes()
    seed_form110()
    seed_puc()


if __name__ == "__main__":
    main()

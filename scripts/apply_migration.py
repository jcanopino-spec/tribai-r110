#!/usr/bin/env python3
"""Aplica una migración SQL de Supabase via conexión directa Postgres.

Uso:
    python3 scripts/apply_migration.py path/to/migration.sql

Lee SUPABASE_DB_PASSWORD de .env.local y conecta al pooler de Supabase.
Idempotente: si la operación ya se aplicó (tabla existe, etc.), continúa
sin abortar el resto del script. Errores reales sí abortan.
"""

import re
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parent.parent


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip("'\"")
    return env


def get_project_ref(env: dict) -> str:
    """Extrae el project-ref de la URL de Supabase."""
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    m = re.match(r"https://([^.]+)\.supabase\.co", url)
    if not m:
        raise RuntimeError(f"No se pudo extraer project-ref de {url}")
    return m.group(1)


def main():
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/apply_migration.py <ruta-sql>")
        sys.exit(1)

    sql_path = Path(sys.argv[1])
    if not sql_path.exists():
        print(f"✗ Archivo no encontrado: {sql_path}")
        sys.exit(1)

    sql = sql_path.read_text()
    env = load_env()
    password = env.get("SUPABASE_DB_PASSWORD")
    if not password:
        print("✗ Falta SUPABASE_DB_PASSWORD en .env.local")
        sys.exit(1)

    project_ref = get_project_ref(env)

    # Pooler de Supabase. Hay 2 generaciones de pooler hosts (aws-0-* y
    # aws-1-*) según la antigüedad/región del proyecto. Probamos ambos.
    regions = [
        "sa-east-1",
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "eu-west-1",
        "eu-west-2",
        "eu-central-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ap-northeast-1",
    ]
    direct_host = f"db.{project_ref}.supabase.co"

    candidates = []
    for region in regions:
        for prefix in ("aws-1", "aws-0"):
            host = f"{prefix}-{region}.pooler.supabase.com"
            candidates.append((host, 6543, f"postgres.{project_ref}"))
    candidates.append((direct_host, 5432, "postgres"))

    conn = None
    for host, port, user in candidates:
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                database="postgres",
                user=user,
                password=password,
                connect_timeout=5,
                sslmode="require",
            )
            print(f"  ✓ Conectado a {host}:{port}")
            break
        except psycopg2.OperationalError as e:
            err = str(e).strip()
            # Mostrar SOLO si NO es "Tenant or user not found" (región incorrecta)
            # ni timeout (región muy lejana)
            if (
                "Tenant or user not found" not in err
                and "timeout" not in err.lower()
                and "could not translate" not in err
            ):
                print(f"  · {host}:{port} → {err[:200]}")
            continue

    if conn is None:
        print("✗ No se pudo conectar a Postgres con ninguno de los candidatos.")
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            try:
                cur.execute(sql)
                conn.commit()
                print(f"✓ Migración aplicada: {sql_path.name}")
            except psycopg2.errors.DuplicateTable as e:
                conn.rollback()
                print(f"· Tabla ya existe (idempotente): {e}")
            except psycopg2.Error as e:
                conn.rollback()
                # Si es duplicate object/policy/index, OK. Si es otro error, abortar.
                msg = str(e).lower()
                if any(
                    k in msg
                    for k in (
                        "already exists",
                        "duplicate",
                        "ya existe",
                    )
                ):
                    print(f"· Objeto ya existe (idempotente): {e}")
                else:
                    raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()

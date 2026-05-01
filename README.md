# Tribai — R110

Plataforma de liquidación tributaria para personas jurídicas en Colombia.
Carga el balance de prueba, mapea cuentas al PUC y genera el formulario 110
y los formatos asociados. Hasta 5 empresas por cliente.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4
- Supabase (auth + Postgres) vía `@supabase/ssr`
- Despliegue en Vercel · dominio `tribai.co`

## Desarrollo

```bash
cp .env.local.example .env.local   # rellenar valores de Supabase
npm install
npm run dev
```

Abre http://localhost:3000.

## Estructura

```
src/
  app/                    # App Router
  lib/
    supabase/             # Clientes browser, server y middleware
    utils.ts              # cn() helper
    years.ts              # Años gravables soportados
public/
  brand/                  # Logos Tribai (SVG)
```

## Año gravable

`NEXT_PUBLIC_DEFAULT_YEAR` define el año por defecto. Soporta 2024, 2025 y 2026
desde el inicio; añadir años nuevos solo requiere extender `src/lib/years.ts`
y publicar las tablas de tarifas/topes correspondientes.

## Roadmap

- **Fase 0** (en curso): scaffolding + branding + Supabase + Vercel
- **Fase 1**: ingeniería inversa del .xlsm (listas, fórmulas, reglas) → JSON/TS
- **Fase 2**: modelo multi-tenant (cliente → empresas → declaraciones)
- **Fase 3**: importador de balance de prueba con mapeo PUC → renglones
- **Fase 4**: formulario 110 web con cálculos en vivo
- **Fase 5**: formatos asociados (2516, anexos)
- **Fase 6**: exportación PDF + manual con estilo propio

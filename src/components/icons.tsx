// Iconos line-art Tribai · azul oscuro #0A1628 (TRIBAI_BRAND.ink)
// Estilo extraído del set visual oficial: outline 2px, color uniforme,
// sin relleno. Se usan en navegación, cards de hub, dashboard, etc.
//
// Cada icono es un componente SVG puro · 24x24 · usa currentColor para
// heredar el color del contenedor (text-foreground, hover states, etc.)

import { TRIBAI_BRAND } from "@/lib/brand";

type IconProps = {
  size?: number;
  className?: string;
  /** Color del trazo · default: currentColor (hereda del contenedor) */
  color?: string;
};

const DEFAULT_PROPS = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function I({
  size = 24,
  className = "",
  color,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Dashboard · 3 gauges + barchart */
export function IconDashboard(props: IconProps) {
  return (
    <I {...props}>
      <rect x="2.5" y="3" width="19" height="18" rx="1.5" {...DEFAULT_PROPS} />
      {/* Gauges */}
      <path d="M5.5 9.5 a2 2 0 0 1 4 0" {...DEFAULT_PROPS} />
      <path d="M10 9.5 a2 2 0 0 1 4 0" {...DEFAULT_PROPS} />
      <path d="M14.5 9.5 a2 2 0 0 1 4 0" {...DEFAULT_PROPS} />
      <line x1="7.5" y1="9.5" x2="7.5" y2="8.3" {...DEFAULT_PROPS} />
      <line x1="12" y1="9.5" x2="12" y2="8.3" {...DEFAULT_PROPS} />
      <line x1="16.5" y1="9.5" x2="16.5" y2="8.3" {...DEFAULT_PROPS} />
      {/* Barchart */}
      <line x1="6" y1="18" x2="6" y2="14" {...DEFAULT_PROPS} />
      <line x1="9" y1="18" x2="9" y2="12" {...DEFAULT_PROPS} />
      <line x1="12" y1="18" x2="12" y2="15" {...DEFAULT_PROPS} />
      <line x1="15" y1="18" x2="15" y2="13" {...DEFAULT_PROPS} />
      <line x1="18" y1="18" x2="18" y2="14" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Formulario 110 · documento con encabezado "110" */
export function IconForm110(props: IconProps) {
  return (
    <I {...props}>
      <path
        d="M5 3 h11 l3 3 v15 H5 Z"
        {...DEFAULT_PROPS}
      />
      <path d="M16 3 v3 h3" {...DEFAULT_PROPS} />
      <text
        x="7.5"
        y="9"
        fontSize="3.5"
        fontFamily="ui-monospace, monospace"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        110
      </text>
      <line x1="7" y1="13" x2="17" y2="13" {...DEFAULT_PROPS} />
      <line x1="7" y1="15.5" x2="17" y2="15.5" {...DEFAULT_PROPS} />
      <line x1="7" y1="18" x2="13" y2="18" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Vista plana · tabla con filas y columnas */
export function IconTable(props: IconProps) {
  return (
    <I {...props}>
      <rect x="2.5" y="4" width="19" height="16" rx="1" {...DEFAULT_PROPS} />
      <line x1="2.5" y1="8.5" x2="21.5" y2="8.5" {...DEFAULT_PROPS} />
      <line x1="2.5" y1="13" x2="21.5" y2="13" {...DEFAULT_PROPS} />
      <line x1="2.5" y1="17" x2="21.5" y2="17" {...DEFAULT_PROPS} />
      <line x1="8" y1="4" x2="8" y2="20" {...DEFAULT_PROPS} />
      <line x1="13" y1="4" x2="13" y2="20" {...DEFAULT_PROPS} />
      <line x1="18" y1="4" x2="18" y2="20" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Configuración · engranaje */
export function IconGear(props: IconProps) {
  return (
    <I {...props}>
      <circle cx="12" cy="12" r="3" {...DEFAULT_PROPS} />
      <path
        d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M4.93 4.93 l2.12 2.12 M16.95 16.95 l2.12 2.12 M4.93 19.07 l2.12 -2.12 M16.95 7.05 l2.12 -2.12"
        {...DEFAULT_PROPS}
      />
      <circle cx="12" cy="12" r="7" strokeDasharray="2 2" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Anexos · carpetas apiladas */
export function IconFolders(props: IconProps) {
  return (
    <I {...props}>
      <path
        d="M3 7 v12 a1.5 1.5 0 0 0 1.5 1.5 H17 a1.5 1.5 0 0 0 1.5 -1.5 V10 a1.5 1.5 0 0 0 -1.5 -1.5 H10 L8 7 H4.5 A1.5 1.5 0 0 0 3 7 Z"
        {...DEFAULT_PROPS}
      />
      <path
        d="M6 6 V5 a1 1 0 0 1 1 -1 H10 L12 6 H19.5 A1.5 1.5 0 0 1 21 7.5 V17"
        {...DEFAULT_PROPS}
      />
    </I>
  );
}

/** Conciliaciones · documentos con flechas circulares */
export function IconConciliacion(props: IconProps) {
  return (
    <I {...props}>
      <rect x="3" y="3" width="7" height="14" rx="0.5" {...DEFAULT_PROPS} />
      <line x1="4.5" y1="6" x2="8.5" y2="6" {...DEFAULT_PROPS} />
      <line x1="4.5" y1="9" x2="8.5" y2="9" {...DEFAULT_PROPS} />
      <line x1="4.5" y1="12" x2="8.5" y2="12" {...DEFAULT_PROPS} />
      <rect x="14" y="7" width="7" height="14" rx="0.5" {...DEFAULT_PROPS} />
      <line x1="15.5" y1="10" x2="19.5" y2="10" {...DEFAULT_PROPS} />
      <line x1="15.5" y1="13" x2="19.5" y2="13" {...DEFAULT_PROPS} />
      <line x1="15.5" y1="16" x2="19.5" y2="16" {...DEFAULT_PROPS} />
      <path
        d="M10.5 10 a2 2 0 0 1 3 0 M13.5 14 a2 2 0 0 1 -3 0"
        {...DEFAULT_PROPS}
      />
      <polyline points="13.5 10 12.8 10 13 9.3" {...DEFAULT_PROPS} />
      <polyline points="10.5 14 11.2 14 11 14.7" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Validaciones · lupa con check */
export function IconValidate(props: IconProps) {
  return (
    <I {...props}>
      <circle cx="11" cy="11" r="7" {...DEFAULT_PROPS} />
      <line x1="16.5" y1="16.5" x2="21" y2="21" {...DEFAULT_PROPS} />
      <polyline points="8 11 10.5 13.5 14.5 8.5" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Checklist · checkboxes con líneas */
export function IconChecklist(props: IconProps) {
  return (
    <I {...props}>
      <rect x="3" y="4" width="3.5" height="3.5" rx="0.5" {...DEFAULT_PROPS} />
      <polyline points="3.7 5.7 4.5 6.5 5.8 4.7" {...DEFAULT_PROPS} />
      <line x1="9" y1="6" x2="20" y2="6" {...DEFAULT_PROPS} />
      <rect x="3" y="10.25" width="3.5" height="3.5" rx="0.5" {...DEFAULT_PROPS} />
      <polyline points="3.7 12 4.5 12.8 5.8 11" {...DEFAULT_PROPS} />
      <line x1="9" y1="12" x2="20" y2="12" {...DEFAULT_PROPS} />
      <rect x="3" y="16.5" width="3.5" height="3.5" rx="0.5" {...DEFAULT_PROPS} />
      <line x1="9" y1="18.25" x2="17" y2="18.25" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Simulador · calculadora con flecha circular */
export function IconCalculator(props: IconProps) {
  return (
    <I {...props}>
      <rect x="4" y="2.5" width="13" height="17" rx="1" {...DEFAULT_PROPS} />
      <rect x="6.5" y="5" width="8" height="3" rx="0.4" {...DEFAULT_PROPS} />
      <circle cx="7.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="11" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="14" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="14" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="14" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="17" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="17" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="17" r="0.5" fill="currentColor" stroke="none" />
      {/* Flecha circular en esquina · indica recálculo */}
      <path
        d="M16 17.5 a3 3 0 1 1 -2.5 -3"
        {...DEFAULT_PROPS}
      />
      <polyline points="13.5 14.5 13 14 13.5 13.5" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Download · flecha hacia abajo en un cajón (descargas) */
export function IconDownload(props: IconProps) {
  return (
    <I {...props}>
      <path d="M12 4 v11" {...DEFAULT_PROPS} />
      <polyline points="8 11 12 15 16 11" {...DEFAULT_PROPS} />
      <path
        d="M4 16 v3 a1 1 0 0 0 1 1 h14 a1 1 0 0 0 1 -1 v-3"
        {...DEFAULT_PROPS}
      />
    </I>
  );
}

/** Search · búsqueda/diagnóstico */
export function IconSearch(props: IconProps) {
  return (
    <I {...props}>
      <circle cx="11" cy="11" r="7" {...DEFAULT_PROPS} />
      <line x1="16.5" y1="16.5" x2="21" y2="21" {...DEFAULT_PROPS} />
    </I>
  );
}

/** Document · genérico */
export function IconDocument(props: IconProps) {
  return (
    <I {...props}>
      <path d="M5 3 h11 l3 3 v15 H5 Z" {...DEFAULT_PROPS} />
      <path d="M16 3 v3 h3" {...DEFAULT_PROPS} />
      <line x1="8" y1="11" x2="16" y2="11" {...DEFAULT_PROPS} />
      <line x1="8" y1="14" x2="16" y2="14" {...DEFAULT_PROPS} />
      <line x1="8" y1="17" x2="13" y2="17" {...DEFAULT_PROPS} />
    </I>
  );
}

// Helper para usar el color de marca por default
export const ICON_BRAND_COLOR = TRIBAI_BRAND.ink;

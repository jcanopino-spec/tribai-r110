import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[80rem] items-center justify-between px-6 py-5 md:px-8">
          <Image
            src="/brand/logo-tribai-full.svg"
            alt="Tribai"
            width={120}
            height={28}
            priority
          />
          <nav className="flex items-center gap-6 text-sm">
            <a href="#producto" className="text-muted-foreground hover:text-foreground">Producto</a>
            <a href="#contacto" className="text-muted-foreground hover:text-foreground">Contacto</a>
            <a
              href="/login"
              className="rounded-full border border-border-secondary px-4 py-1.5 hover:bg-muted"
            >
              Ingresar
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[80rem] flex-1 px-6 py-24 md:px-8 md:py-32">
        <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
          AG 2025 · Personas jurídicas
        </p>
        <h1 className="mt-6 max-w-3xl font-serif text-5xl leading-[1.05] tracking-[-0.02em] md:text-7xl">
          Tu declaración de renta, sin hojas de cálculo frágiles.
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-[1.3] text-muted-foreground md:text-xl">
          Carga el balance de prueba, mapea tus cuentas al PUC y genera el formulario 110
          y los formatos asociados. Hasta 5 empresas por cliente.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href="/registro"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Crear cuenta
          </a>
          <a
            href="#producto"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border-secondary px-6 text-sm font-medium hover:bg-muted"
          >
            Ver cómo funciona
          </a>
        </div>
      </section>

      <section id="producto" className="border-t border-border bg-card">
        <div className="mx-auto grid w-full max-w-[80rem] gap-10 px-6 py-20 md:grid-cols-3 md:px-8">
          <Feature
            label="01 · Importar"
            title="Sube tu balance de prueba"
            body="Excel o CSV. Lo parseamos cuenta por cuenta y lo conectamos al PUC vigente."
          />
          <Feature
            label="02 · Mapear"
            title="Cuentas → renglones del 110"
            body="Mapeo configurable por empresa. Reutilizable año tras año."
          />
          <Feature
            label="03 · Declarar"
            title="Formulario 110 en línea"
            body="Validaciones, cálculos en vivo y exportación a PDF con el layout DIAN."
          />
        </div>
      </section>

      <footer id="contacto" className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col items-start justify-between gap-4 px-6 py-10 md:flex-row md:items-center md:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">
            © {new Date().getFullYear()} Tribai · tribai.co
          </p>
          <p className="text-sm text-muted-foreground">
            Año gravable 2025 · Configurable por año
          </p>
        </div>
      </footer>
    </main>
  );
}

function Feature({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <h3 className="mt-3 font-serif text-2xl leading-[1.1] tracking-[-0.01em]">{title}</h3>
      <p className="mt-3 text-base leading-[1.4] text-muted-foreground">{body}</p>
    </div>
  );
}

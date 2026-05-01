import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, razon_social, nit")
    .order("razon_social");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[80rem] items-center justify-between px-6 py-4 md:px-8">
          <Link href="/dashboard">
            <Image src="/brand/logo-tribai-full.svg" alt="Tribai" width={108} height={26} priority />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{user.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="rounded-full border border-border-secondary px-3 py-1 hover:bg-muted">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[80rem] flex-1 px-6 md:px-8">
        <aside className="hidden w-64 shrink-0 border-r border-border py-10 pr-6 md:block">
          <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">Empresas</p>
          <ul className="mt-4 space-y-1 text-sm">
            {(empresas ?? []).map((e) => (
              <li key={e.id}>
                <Link href={`/empresas/${e.id}`} className="block rounded px-2 py-1.5 hover:bg-muted">
                  {e.razon_social}
                </Link>
              </li>
            ))}
            {(empresas?.length ?? 0) === 0 ? (
              <li className="text-muted-foreground">Sin empresas todavía.</li>
            ) : null}
          </ul>
          <Link
            href="/empresas/nueva"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-full border border-border-secondary px-4 text-xs hover:bg-muted"
          >
            + Nueva empresa
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            {(empresas?.length ?? 0)} / 5 empresas
          </p>
        </aside>

        <main className="flex-1 py-10 md:pl-10">{children}</main>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[80rem] items-center px-6 py-5 md:px-8">
          <Link href="/">
            <Image src="/brand/logo-tribai-full.svg" alt="Tribai" width={120} height={28} priority />
          </Link>
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}

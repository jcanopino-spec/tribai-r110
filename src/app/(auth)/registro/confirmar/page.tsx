import Link from "next/link";

export const metadata = { title: "Confirma tu correo" };

export default function ConfirmarPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl leading-[1.1] tracking-[-0.02em]">Revisa tu correo</h1>
      <p className="mt-4 text-muted-foreground">
        Te enviamos un enlace de confirmación. Una vez confirmes, vuelve a{" "}
        <Link href="/login" className="underline-offset-4 hover:underline">
          ingresar
        </Link>
        .
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { Brand } from "@/components/shell/brand";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.025)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
      />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        <div className="surface-raised rounded-[16px] p-7">
          <div className="mb-6">
            <h1 className="font-display text-[24px] font-semibold leading-tight text-ink">
              Entra en tu arca
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Acceso privado. Un solo dueño, ningún registro público.
            </p>
          </div>

          <LoginForm />
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
          <span className="inline-block h-1 w-1 rounded-full bg-ok" />
          Conexión privada · TLS
        </p>
      </div>
    </main>
  );
}

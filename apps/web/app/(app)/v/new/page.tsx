import type { Metadata } from "next";
import { VaultForm } from "@/components/vaults/vault-form";

export const metadata: Metadata = { title: "Nuevo baúl" };

export default function NewVaultPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[560px] px-5 py-10 sm:py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          Arca / nuevo
        </p>
        <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight text-ink">
          Crea un baúl
        </h1>
        <p className="mt-2 max-w-[440px] text-[13px] leading-relaxed text-muted">
          Un baúl agrupa archivos con un propósito: un proyecto, un viaje, un archivo
          personal. Podrás cambiar el nombre y la descripción cuando quieras.
        </p>

        <div className="mt-7 rounded-[14px] border border-line bg-surface-1 p-5 shadow-panel">
          <VaultForm mode="create" />
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Privado por defecto · sin registro público
        </p>
      </div>
    </div>
  );
}

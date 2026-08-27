"use client";

import { useEffect } from "react";
import Link from "next/link";
import { btnPrimaryClass, btnSecondaryClass } from "@/components/formStyles";
import { reportError } from "@/lib/monitoring/client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-8 text-center shadow-card">
        <h1 className="font-sora text-lg font-bold text-ink">Algo ha ido mal</h1>
        <p className="text-[13px] text-ink-secondary">
          Ha ocurrido un error inesperado al cargar esta pantalla. Puedes intentarlo de nuevo o volver al
          inicio.
        </p>
        <div className="flex justify-center gap-2.5">
          <button type="button" onClick={() => reset()} className={btnPrimaryClass}>
            Reintentar
          </button>
          <Link href="/home" className={btnSecondaryClass}>
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

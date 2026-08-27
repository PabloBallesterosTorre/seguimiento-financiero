"use client";

import { useState } from "react";
import { MovimientoPrevistoForm } from "./MovimientoPrevistoForm";
import type { CategoriaJerarquica } from "@/lib/categorias";
import { btnPrimaryClass, cardClass } from "@/components/formStyles";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export function NuevoPrevisto({
  action,
  categorias,
  cuentas,
  hoy,
}: {
  action: (formData: FormData) => void;
  categorias: CategoriaJerarquica[];
  cuentas: Cuenta[];
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnPrimaryClass}>
        + Nueva previsión
      </button>
    );
  }

  return (
    <div className={cardClass}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Añadir previsión</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <MovimientoPrevistoForm
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        categorias={categorias}
        cuentas={cuentas}
        hoy={hoy}
      />
    </div>
  );
}

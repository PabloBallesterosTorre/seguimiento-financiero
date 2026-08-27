"use client";

import { useState } from "react";
import { btnPrimaryClass } from "@/components/formStyles";
import { InversionForm, type PrevistoInversionOption } from "./InversionForm";

export function NuevaInversion({
  action,
  previstosInversion,
}: {
  action: (formData: FormData) => void;
  previstosInversion: PrevistoInversionOption[];
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnPrimaryClass}>
        + Añadir inversión
      </button>
    );
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <InversionForm action={action} previstosInversion={previstosInversion} onGuardado={() => setAbierto(false)} />
    </div>
  );
}

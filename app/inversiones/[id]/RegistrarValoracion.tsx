"use client";

import { useState } from "react";
import { inputClass, labelClass, btnPrimaryClass, btnSecondaryClass } from "@/components/formStyles";

export function RegistrarValoracion({
  action,
  inversionId,
  hoy,
  porPrecio = false,
}: {
  action: (formData: FormData) => void;
  inversionId: string;
  hoy: string;
  // Si la posición tiene participaciones se pide el precio de una (lo que se ve en
  // cualquier web de cotizaciones) y el servidor calcula el valor total.
  porPrecio?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnSecondaryClass}>
        + Registrar valoración
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
        setAbierto(false);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="id" value={inversionId} />
      <div>
        <label className={labelClass}>Fecha</label>
        <input name="fecha" type="date" required defaultValue={hoy} max={hoy} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>{porPrecio ? "Precio por participación" : "Valor"}</label>
        {porPrecio ? (
          <input name="precio" type="number" step="0.0001" min="0" required className={inputClass} />
        ) : (
          <input name="valor_actual" type="number" step="0.01" min="0" required className={inputClass} />
        )}
      </div>
      <button type="submit" className={btnPrimaryClass}>
        Guardar
      </button>
      <button type="button" onClick={() => setAbierto(false)} className={btnSecondaryClass}>
        Cancelar
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { inputClass, labelClass, btnPrimaryClass, cardClass } from "@/components/formStyles";

export function RegistrarAmortizacion({
  action,
  deudaId,
  hoy,
}: {
  action: (formData: FormData) => void;
  deudaId: string;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnPrimaryClass}>
        Registrar amortización
      </button>
    );
  }

  return (
    <div className={`${cardClass} space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Registrar amortización</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-tertiary">
        Elige la fecha libremente: si es hoy o pasada se aplica al capital pendiente al guardar; si es
        futura, queda como plan pendiente hasta que la marques como aplicada.
      </p>
      <form
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-4"
      >
        <input type="hidden" name="deuda_id" value={deudaId} />
        <div>
          <label className={labelClass}>Fecha</label>
          <input name="fecha" type="date" required defaultValue={hoy} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Importe</label>
          <input name="importe" type="number" step="0.01" min="0" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Efecto</label>
          <select name="tipo_reduccion" className={inputClass}>
            <option value="reducir_plazo">Reducir plazo</option>
            <option value="reducir_cuota">Reducir cuota</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Etiqueta (informativa)</label>
          <select name="recurrencia" className={inputClass}>
            <option value="puntual">Puntual</option>
            <option value="mensual">Parte de un plan mensual</option>
            <option value="anual">Parte de un plan anual</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className={btnPrimaryClass}>
            Registrar
          </button>
        </div>
      </form>
    </div>
  );
}

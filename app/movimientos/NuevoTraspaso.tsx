"use client";

import { useState } from "react";
import { inputClass, labelClass, btnPrimaryClass, btnSecondaryClass, cardClass } from "@/components/formStyles";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export function NuevoTraspaso({
  cuentas,
  action,
  hoy,
}: {
  cuentas: Cuenta[];
  action: (formData: FormData) => void;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnSecondaryClass}>
        Nuevo traspaso
      </button>
    );
  }

  return (
    <div className={cardClass}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Nuevo traspaso entre cuentas</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <form
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-5"
      >
        <div>
          <label className={labelClass}>Fecha</label>
          <input name="fecha" type="date" required defaultValue={hoy} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Cuenta origen</label>
          <select name="cuenta_origen_id" required className={inputClass}>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.banco_nombre} — {cuenta.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Cuenta destino</label>
          <select name="cuenta_destino_id" required defaultValue={cuentas[1]?.id ?? cuentas[0]?.id} className={inputClass}>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.banco_nombre} — {cuenta.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Importe</label>
          <input name="importe" type="number" step="0.01" min="0" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Descripción (opcional)</label>
          <input name="descripcion" placeholder="Se autogenera si se deja vacío" className={inputClass} />
        </div>
        <div className="flex gap-2.5 sm:col-span-5">
          <button type="submit" className={btnPrimaryClass}>
            Registrar traspaso
          </button>
          <button type="button" onClick={() => setAbierto(false)} className={btnSecondaryClass}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

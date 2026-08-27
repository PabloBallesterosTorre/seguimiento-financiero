"use client";

import { useState } from "react";
import { inputClass, labelClass, btnPrimaryClass, cardClass } from "@/components/formStyles";

export function NuevaDeuda({ action }: { action: (formData: FormData) => void }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={btnPrimaryClass}>
        + Añadir deuda
      </button>
    );
  }

  return (
    <div className={cardClass}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Añadir deuda</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      </div>
      <form
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-4"
      >
        <div>
          <label className={labelClass}>Tipo</label>
          <input name="tipo" required placeholder="Hipoteca, préstamo, coche…" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Nombre</label>
          <input name="nombre" required placeholder="Hipoteca vivienda habitual" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Capital inicial</label>
          <input name="capital_inicial" type="number" step="0.01" min="0" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Capital pendiente actual</label>
          <input
            name="capital_pendiente"
            type="number"
            step="0.01"
            min="0"
            placeholder="Igual al inicial si es nueva"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Cuota</label>
          <input name="cuota" type="number" step="0.01" min="0" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Tipo de interés (% anual)</label>
          <input name="tipo_interes" type="number" step="0.001" placeholder="3.1" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Modalidad</label>
          <select name="modalidad_interes" className={inputClass}>
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Fecha inicio</label>
          <input name="fecha_inicio" type="date" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fecha fin (opcional)</label>
          <input name="fecha_fin" type="date" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Valor residual (opcional)</label>
          <input
            name="valor_residual"
            type="number"
            step="0.01"
            min="0"
            placeholder="Financiación con pago final"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className={btnPrimaryClass}>
            Añadir deuda
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";

type CandidatoTraspasoDisplay = {
  id: string;
  label: string;
};

export function MarcarComoTraspaso({
  movimientoId,
  candidatos,
  action,
}: {
  movimientoId: string;
  candidatos: CandidatoTraspasoDisplay[];
  action: (formData: FormData) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (candidatos.length === 0) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-0.5 block text-xs text-faint hover:text-accent hover:underline"
      >
        ¿Es un traspaso?
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 flex items-center gap-1">
      <input type="hidden" name="movimiento_id" value={movimientoId} />
      <select
        name="movimiento_contraparte_id"
        defaultValue=""
        required
        className="rounded-btn border border-border-strong px-1 py-0.5 text-xs"
      >
        <option value="" disabled>
          Vincular con…
        </option>
        {candidatos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs font-semibold text-accent hover:underline">
        Vincular
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="text-xs text-faint hover:text-danger"
      >
        Cancelar
      </button>
    </form>
  );
}

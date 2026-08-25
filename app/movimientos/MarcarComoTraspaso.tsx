"use client";

import { useState } from "react";
import type { CandidatoTraspaso } from "@/lib/traspasos";

export function MarcarComoTraspaso({
  movimientoId,
  candidatos,
  action,
  formatEUR,
}: {
  movimientoId: string;
  candidatos: CandidatoTraspaso[];
  action: (formData: FormData) => void;
  formatEUR: (v: number) => string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (candidatos.length === 0) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-0.5 block text-xs text-slate-400 hover:text-sky-600 hover:underline"
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
        className="rounded-md border border-slate-300 px-1 py-0.5 text-xs"
      >
        <option value="" disabled>
          Vincular con…
        </option>
        {candidatos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.cuenta ? `${c.cuenta.banco_nombre} — ${c.cuenta.nombre}` : "?"} · {c.fecha} ·{" "}
            {formatEUR(c.importe)}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs font-medium text-sky-600 hover:underline">
        Vincular
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="text-xs text-slate-400 hover:text-red-600"
      >
        Cancelar
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export type InversionOption = { id: string; nombre: string };

// La vía manual para vincular un movimiento con una inversión. Los extractos de bróker
// (Trade Republic) traen ISIN y participaciones y la importación lo hace sola; los de un
// banco normal (Revolut, Ibercaja) no traen nada de eso, así que la aportación hay que
// declararla aquí: el movimiento ya está registrado, lo que falta es decir qué se compró.
export function AsignarAInversion({
  movimientoId,
  inversiones,
  asignada,
  action,
}: {
  movimientoId: string;
  inversiones: InversionOption[];
  asignada: string | null;
  action: (formData: FormData) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (asignada) {
    return (
      <p className="mt-0.5 text-xs text-ink-tertiary">
        Aportación a{" "}
        <Link href="/inversiones" className="font-semibold text-accent hover:underline">
          {asignada}
        </Link>
      </p>
    );
  }

  if (inversiones.length === 0) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-0.5 block text-xs text-faint hover:text-accent hover:underline"
      >
        ¿Es una aportación a inversión?
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 flex flex-wrap items-center gap-1">
      <input type="hidden" name="movimiento_id" value={movimientoId} />
      <select
        name="inversion_id"
        defaultValue=""
        required
        className="rounded-btn border border-border-strong px-1 py-0.5 text-xs"
      >
        <option value="" disabled>
          Asignar a…
        </option>
        {inversiones.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nombre}
          </option>
        ))}
      </select>
      {/* Participaciones y precio son opcionales: sin ellos la operación cuenta como
          aportación (suma al coste) pero no aporta cantidad ni precio medio. */}
      <input
        name="participaciones"
        type="number"
        step="0.00000001"
        min="0"
        placeholder="Particip."
        className="w-24 rounded-btn border border-border-strong px-1 py-0.5 text-xs"
      />
      <input
        name="precio"
        type="number"
        step="0.000001"
        min="0"
        placeholder="Precio"
        className="w-20 rounded-btn border border-border-strong px-1 py-0.5 text-xs"
      />
      <button type="submit" className="text-xs font-semibold text-accent hover:underline">
        Asignar
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="text-xs text-faint hover:text-danger">
        Cancelar
      </button>
    </form>
  );
}

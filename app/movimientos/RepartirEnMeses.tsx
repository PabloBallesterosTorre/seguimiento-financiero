"use client";

import { useState, useTransition } from "react";
import { OPCIONES_PRORRATEO } from "@/lib/prorrateo";

// Tanda 16: repartir un gasto o ingreso entre varios meses en los informes (un seguro
// anual, la matrícula del curso). Discreto como "¿Es un traspaso?": solo un enlace pequeño
// hasta que se usa; si ya está repartido, lo dice.
export function RepartirEnMeses({
  movimientoId,
  meses,
  action,
}: {
  movimientoId: string;
  meses: number | null;
  action: (movimientoId: string, meses: number | null) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const guardar = (valor: number | null) =>
    startTransition(async () => {
      await action(movimientoId, valor);
      setAbierto(false);
    });

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`mt-0.5 block text-xs hover:underline ${meses ? "font-semibold text-accent" : "text-faint hover:text-accent"}`}
      >
        {meses ? `Repartido en ${meses} meses` : "Repartir en meses"}
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-ink-tertiary">En los informes, repartir en</span>
      {OPCIONES_PRORRATEO.map((n) => (
        <button
          key={n}
          type="button"
          disabled={pendiente}
          onClick={() => guardar(n)}
          className={`rounded-full px-2 py-0.5 font-semibold ${
            meses === n ? "bg-ink text-white" : "bg-chip text-ink-secondary hover:bg-border"
          }`}
        >
          {n}
        </button>
      ))}
      <span className="text-ink-tertiary">meses</span>
      {meses && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => guardar(null)}
          className="font-semibold text-faint hover:text-danger"
        >
          Quitar
        </button>
      )}
      <button type="button" onClick={() => setAbierto(false)} className="text-faint hover:text-ink">
        Cancelar
      </button>
    </div>
  );
}

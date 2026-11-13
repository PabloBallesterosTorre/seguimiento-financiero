"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";

export type InmuebleOption = { id: string; nombre: string };

// Tanda 18: vincular un movimiento a un inmueble (alquiler, comunidad, IBI, reformas). Igual
// de discreto que "Repartir en meses": un enlace pequeño hasta que se usa; si ya está
// vinculado, enseña a cuál y lleva a su ficha.
export function InmuebleCelda({
  movimientoId,
  inmuebleId,
  inmuebles,
  action,
}: {
  movimientoId: string;
  inmuebleId: string | null;
  inmuebles: InmuebleOption[];
  action: (movimientoId: string, inmuebleId: string | null) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [actual, setActual] = useOptimistic(inmuebleId);

  if (inmuebles.length === 0) return null;
  const nombre = inmuebles.find((i) => i.id === actual)?.nombre ?? null;

  const guardar = (valor: string | null) =>
    startTransition(async () => {
      setActual(valor);
      setAbierto(false);
      await action(movimientoId, valor);
    });

  if (!abierto) {
    if (actual && nombre) {
      return (
        <p className="mt-0.5 text-xs text-ink-tertiary">
          Inmueble{" "}
          <Link href={`/inmuebles/${actual}`} className="font-semibold text-accent hover:underline">
            {nombre}
          </Link>{" "}
          <button type="button" onClick={() => setAbierto(true)} className="text-faint hover:text-accent hover:underline">
            cambiar
          </button>
        </p>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-0.5 block text-xs text-faint hover:text-accent hover:underline"
      >
        Vincular a un inmueble
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      {inmuebles.map((i) => (
        <button
          key={i.id}
          type="button"
          disabled={pendiente}
          onClick={() => guardar(i.id)}
          className={`rounded-full px-2 py-0.5 font-semibold ${
            actual === i.id ? "bg-ink text-white" : "bg-chip text-ink-secondary hover:bg-border"
          }`}
        >
          {i.nombre}
        </button>
      ))}
      {actual && (
        <button type="button" disabled={pendiente} onClick={() => guardar(null)} className="font-semibold text-faint hover:text-danger">
          Quitar
        </button>
      )}
      <button type="button" onClick={() => setAbierto(false)} className="text-faint hover:text-ink">
        Cancelar
      </button>
    </div>
  );
}

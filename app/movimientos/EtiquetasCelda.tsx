"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";

export type EtiquetaOption = { id: string; nombre: string };

// Tanda 15: las etiquetas de un movimiento, debajo de su concepto. Cada una enlaza al
// filtro de Movimientos por esa etiqueta; el "+" abre una lista para poner o quitar.
// El cambio se ve al instante (useOptimistic) y se guarda en segundo plano.
export function EtiquetasCelda({
  movimientoId,
  etiquetaIds,
  etiquetas,
  alternarEtiqueta,
}: {
  movimientoId: string;
  etiquetaIds: string[];
  etiquetas: EtiquetaOption[];
  alternarEtiqueta: (movimientoId: string, etiquetaId: string, poner: boolean) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [, startTransition] = useTransition();
  const [ids, cambiarIds] = useOptimistic(etiquetaIds, (actuales: string[], cambio: { id: string; poner: boolean }) =>
    cambio.poner ? [...actuales, cambio.id] : actuales.filter((i) => i !== cambio.id)
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  // Sin etiquetas creadas no hay nada que poner: el botón solo estorbaría en cada fila.
  if (etiquetas.length === 0) return null;

  const nombre = new Map(etiquetas.map((e) => [e.id, e.nombre]));
  const puestas = ids.filter((id) => nombre.has(id));

  const alternar = (id: string, poner: boolean) =>
    startTransition(async () => {
      cambiarIds({ id, poner });
      await alternarEtiqueta(movimientoId, id, poner);
    });

  return (
    <div ref={ref} className="relative mt-1 flex flex-wrap items-center gap-1.5">
      {puestas.map((id) => (
        <Link
          key={id}
          href={`/movimientos?etiqueta=${id}`}
          className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-ink-secondary hover:bg-border"
        >
          #{nombre.get(id)}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label="Poner o quitar etiquetas"
        aria-expanded={abierto}
        className={`rounded-full border border-dashed border-border-strong px-2 py-0.5 text-[11px] font-semibold text-ink-tertiary hover:text-ink ${
          puestas.length === 0 && !abierto ? "opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100" : ""
        }`}
      >
        + etiqueta
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-card border border-border bg-surface p-2 shadow-card">
          <ul className="max-h-60 overflow-y-auto">
            {etiquetas.map((e) => {
              const marcada = ids.includes(e.id);
              return (
                <li key={e.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink hover:bg-chip">
                    <input type="checkbox" checked={marcada} onChange={() => alternar(e.id, !marcada)} />
                    {e.nombre}
                  </label>
                </li>
              );
            })}
          </ul>
          <Link
            href="/categorias"
            className="mt-1 block border-t border-border px-2 pt-2 text-[11px] font-semibold text-accent hover:underline"
          >
            Gestionar etiquetas
          </Link>
        </div>
      )}
    </div>
  );
}

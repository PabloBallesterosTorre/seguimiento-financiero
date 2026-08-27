"use client";

import { useState } from "react";
import { guardarOrdenTabla } from "@/lib/actions/ordenTabla";
import type { Direccion, OrdenTabla } from "@/lib/ordenTabla";

// Hook compartido por cualquier tabla ordenable de la app: mantiene el criterio de
// orden en memoria (arrancando del que ya tenía guardado el usuario) y lo persiste
// en cuanto cambia. Primer clic en una columna ordena ascendente, segundo clic
// descendente; clic en otra columna vuelve a empezar en ascendente.
export function useOrdenTabla(tabla: string, inicial: OrdenTabla) {
  const [orden, setOrden] = useState<OrdenTabla>(inicial);

  function toggle(columna: string) {
    setOrden((prev) => {
      const siguiente: OrdenTabla =
        prev?.columna === columna
          ? { columna, direccion: prev.direccion === "asc" ? ("desc" as Direccion) : ("asc" as Direccion) }
          : { columna, direccion: "asc" };
      guardarOrdenTabla(tabla, siguiente.columna, siguiente.direccion);
      return siguiente;
    });
  }

  return { orden, toggle };
}

export function ThOrdenable({
  columna,
  orden,
  onToggle,
  className = "",
  align = "left",
  children,
}: {
  columna: string;
  orden: OrdenTabla;
  onToggle: (columna: string) => void;
  className?: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const activa = orden?.columna === columna;

  return (
    <th
      onClick={() => onToggle(columna)}
      className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold text-ink-tertiary hover:text-ink ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
      <span className={`ml-1 inline-block w-3 text-[10px] ${activa ? "text-ink-secondary" : "text-gridline"}`}>
        {activa ? (orden!.direccion === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );
}

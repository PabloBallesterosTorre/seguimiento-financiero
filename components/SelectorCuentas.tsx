"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { guardarCuentasExcluidasInformes } from "@/lib/actions/cuentasSeleccionadas";

type CuentaOpcion = { id: string; nombre: string; banco_nombre: string };

// Selector de cuentas compartido por informes, planificador, prevision y home: permite
// ver los números incluyendo o excluyendo cuentas concretas (p. ej. excluir una cuenta
// compartida para ver solo el dinero propio). La selección se refleja en la URL
// (parámetro "cuentas", compartible/recargable) y además se guarda como preferencia del
// usuario — la próxima vez que entre sin ese parámetro, se recuerda.
export function SelectorCuentas({
  cuentas,
  seleccionadas,
}: {
  cuentas: CuentaOpcion[];
  seleccionadas: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seleccionadasSet = new Set(seleccionadas);
  const todasSeleccionadas = cuentas.length > 0 && cuentas.every((c) => seleccionadasSet.has(c.id));

  function aplicar(nuevaSeleccion: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("cuentas", nuevaSeleccion.join(","));
    router.push(`${pathname}?${params.toString()}`);

    const idsExcluidos = cuentas.filter((c) => !nuevaSeleccion.includes(c.id)).map((c) => c.id);
    guardarCuentasExcluidasInformes(idsExcluidos);
  }

  function toggleCuenta(id: string) {
    const nuevaSeleccion = seleccionadasSet.has(id)
      ? seleccionadas.filter((s) => s !== id)
      : [...seleccionadas, id];
    aplicar(nuevaSeleccion);
  }

  function toggleTodas() {
    aplicar(todasSeleccionadas ? [] : cuentas.map((c) => c.id));
  }

  if (cuentas.length === 0) return null;

  const resumen =
    seleccionadas.length === cuentas.length
      ? "Todas las cuentas"
      : seleccionadas.length === 0
        ? "Ninguna cuenta"
        : `${seleccionadas.length} de ${cuentas.length} cuentas`;

  return (
    <details className="w-fit rounded-card border border-border bg-surface text-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-ink">
        Cuentas: <span className="text-ink-secondary">{resumen}</span>
      </summary>
      <div className="space-y-2 border-t border-border px-4 py-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-secondary">
          <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} />
          Todas
        </label>
        <div className="space-y-1.5 border-t border-border pt-2">
          {cuentas.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={seleccionadasSet.has(c.id)}
                onChange={() => toggleCuenta(c.id)}
              />
              {c.banco_nombre} — {c.nombre}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

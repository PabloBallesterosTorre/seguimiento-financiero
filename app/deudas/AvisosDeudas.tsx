import type { AvisoDeuda } from "@/lib/revisionDeudas";

// Se pinta arriba del todo y no dentro de cada fila a propósito: el fallo que motivó esto
// era invisible mirando la ficha de la deuda —cuadraba consigo misma— y solo aparecía al
// contrastarla con los movimientos. Escondido en un detalle no lo habría visto nadie.
export function AvisosDeudas({ avisos, nombrePorDeuda }: { avisos: AvisoDeuda[]; nombrePorDeuda: Map<string, string> }) {
  if (avisos.length === 0) return null;

  const graves = avisos.filter((a) => a.gravedad === "grave");

  return (
    <div
      className={`rounded-card border p-5 ${
        graves.length > 0 ? "border-danger/30 bg-danger/5" : "border-border bg-chip/40"
      }`}
    >
      <h2 className="text-sm font-semibold text-ink">
        {graves.length > 0
          ? "Hay deudas que no cuadran con tus movimientos"
          : "Un par de cosas que repasar en tus deudas"}
      </h2>
      <ul className="mt-3 space-y-3">
        {avisos.map((a, i) => (
          <li key={`${a.deudaId}-${i}`} className="text-[13px]">
            <p className="font-semibold text-ink">
              {nombrePorDeuda.get(a.deudaId) ?? "Deuda"} — {a.titulo}
            </p>
            <p className="mt-0.5 text-ink-secondary">{a.detalle}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

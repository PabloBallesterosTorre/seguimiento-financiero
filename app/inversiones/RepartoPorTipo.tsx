import { formatMoneda, formatPorcentaje } from "@/lib/formato";

// Reparto de la cartera por tipo de activo. Barras en vez de un donut a propósito: lo que
// importa aquí es comparar pesos entre sí y leer el importe exacto, y para eso una barra
// con su cifra al lado gana a un sector circular.
export function RepartoPorTipo({
  reparto,
  total,
  moneda,
}: {
  reparto: { tipo: string; valor: number }[];
  total: number;
  moneda: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  if (reparto.length === 0 || total <= 0) {
    return <p className="text-sm text-ink-tertiary">Todavía no hay nada que repartir.</p>;
  }

  return (
    <div className="space-y-3">
      {reparto.map((r) => {
        const peso = (r.valor / total) * 100;
        return (
          <div key={r.tipo}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold capitalize text-ink">{r.tipo.replace(/_/g, " ")}</span>
              <span className="text-ink-secondary">
                {formatEUR(r.valor)} <span className="text-ink-tertiary">· {formatPorcentaje(peso, { decimales: 1 })}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-chip">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(peso, 1)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { formatMoneda, formatPorcentaje } from "@/lib/formato";
import { cardClass } from "@/components/formStyles";
import { BarrasMensuales } from "./BarrasMensuales";

export type CarteraEnAnalisis = {
  nombre: string;
  posiciones: number;
  valor: number;
  ganancia: number;
  rentabilidadPct: number | null;
};

export type PosicionEnRanking = { id: string; nombre: string; ganancia: number; rentabilidadPct: number | null };

// Tanda 14: el bloque de análisis de la cartera. Responde a cuatro preguntas que la tabla
// de posiciones no contesta de un vistazo: qué cartera va mejor, qué posiciones tiran del
// resultado, cuánto renta la cartera en dividendos y cuánto dinero se le ha ido metiendo.
export function AnalisisCartera({
  carteras,
  ganadores,
  perdedores,
  rentas,
  rentas12m,
  previsto12m,
  flujo,
  flujoNeto12m,
  moneda,
}: {
  carteras: CarteraEnAnalisis[];
  ganadores: PosicionEnRanking[];
  perdedores: PosicionEnRanking[];
  rentas: { mes: string; importe: number }[];
  rentas12m: number;
  previsto12m: number;
  flujo: { mes: string; importe: number }[];
  flujoNeto12m: number;
  moneda: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const maxGanancia = Math.max(1, ...carteras.map((c) => Math.abs(c.ganancia)));
  const maxRanking = Math.max(1, ...ganadores.map((p) => p.ganancia), ...perdedores.map((p) => -p.ganancia));

  return (
    <div className="space-y-6">
      {carteras.length > 1 && (
        <div className={`${cardClass} space-y-4`}>
          <div>
            <h2 className="font-sora text-base font-semibold text-ink">Resultado por cartera</h2>
            <p className="text-[13px] text-ink-tertiary">
              Cada cartera es la cuenta donde están custodiadas sus posiciones.
            </p>
          </div>
          <ul className="space-y-3">
            {carteras.map((c) => (
              <li key={c.nombre}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                  <span className="font-semibold text-ink">
                    {c.nombre}
                    <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                      {c.posiciones} {c.posiciones === 1 ? "posición" : "posiciones"} · {formatEUR(c.valor)}
                    </span>
                  </span>
                  <Resultado ganancia={c.ganancia} pct={c.rentabilidadPct} formatEUR={formatEUR} />
                </div>
                <Barra ganancia={c.ganancia} max={maxGanancia} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {(ganadores.length > 0 || perdedores.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          <Ranking titulo="Las que más ganan" posiciones={ganadores} max={maxRanking} formatEUR={formatEUR} />
          <Ranking titulo="Las que más pierden" posiciones={perdedores} max={maxRanking} formatEUR={formatEUR} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className={`${cardClass} space-y-3`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-sora text-base font-semibold text-ink">Rentas de inversión</h2>
              <p className="text-[13px] text-ink-tertiary">Dividendos netos cobrados cada mes.</p>
            </div>
            <div className="text-right">
              <p className="font-sora text-lg font-semibold tabular-nums text-success">{formatEUR(rentas12m)}</p>
              <p className="text-[11px] text-ink-tertiary">
                últimos 12 meses
                {previsto12m > 0 && ` · ${formatEUR(previsto12m)} previstos en los próximos 12`}
              </p>
            </div>
          </div>
          {rentas12m > 0 ? (
            <BarrasMensuales datos={rentas} moneda={moneda} color="#1baf7a" nombre="Dividendos" />
          ) : (
            <p className="text-sm text-ink-tertiary">
              No hay dividendos en el último año. Se registran como operación de tipo Dividendo en cada posición.
            </p>
          )}
        </div>

        <div className={`${cardClass} space-y-3`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-sora text-base font-semibold text-ink">Flujo de capital</h2>
              <p className="text-[13px] text-ink-tertiary">Lo aportado menos lo retirado cada mes.</p>
            </div>
            <div className="text-right">
              <p className="font-sora text-lg font-semibold tabular-nums text-ink">
                {flujoNeto12m >= 0 ? "+" : ""}
                {formatEUR(flujoNeto12m)}
              </p>
              <p className="text-[11px] text-ink-tertiary">neto en 12 meses</p>
            </div>
          </div>
          <BarrasMensuales datos={flujo} moneda={moneda} color="#4f7cac" nombre="Neto aportado" />
        </div>
      </div>
    </div>
  );
}

function Resultado({
  ganancia,
  pct,
  formatEUR,
}: {
  ganancia: number;
  pct: number | null;
  formatEUR: (v: number) => string;
}) {
  return (
    <span className={`shrink-0 font-semibold tabular-nums ${ganancia >= 0 ? "text-success" : "text-danger"}`}>
      {ganancia >= 0 ? "+" : ""}
      {formatEUR(ganancia)}
      {pct !== null && (
        <span className="ml-1.5 text-[11px] font-normal text-ink-tertiary">
          {formatPorcentaje(pct, { decimales: 1, signo: "siempre" })}
        </span>
      )}
    </span>
  );
}

function Barra({ ganancia, max }: { ganancia: number; max: number }) {
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-chip">
      <div
        className={`h-1.5 rounded-full ${ganancia >= 0 ? "bg-success" : "bg-danger"}`}
        style={{ width: `${(Math.abs(ganancia) / max) * 100}%` }}
      />
    </div>
  );
}

function Ranking({
  titulo,
  posiciones,
  max,
  formatEUR,
}: {
  titulo: string;
  posiciones: PosicionEnRanking[];
  max: number;
  formatEUR: (v: number) => string;
}) {
  return (
    <div className={`${cardClass} space-y-3`}>
      <h2 className="font-sora text-base font-semibold text-ink">{titulo}</h2>
      {posiciones.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Ninguna.</p>
      ) : (
        <ul className="space-y-3">
          {posiciones.map((p) => (
            <li key={p.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link
                  href={`/inversiones/${p.id}`}
                  className="truncate font-semibold text-ink hover:underline"
                  title={p.nombre}
                >
                  {p.nombre}
                </Link>
                <Resultado ganancia={p.ganancia} pct={p.rentabilidadPct} formatEUR={formatEUR} />
              </div>
              <Barra ganancia={p.ganancia} max={max} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

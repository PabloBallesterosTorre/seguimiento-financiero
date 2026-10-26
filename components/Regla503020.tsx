import Link from "next/link";
import { formatMoneda } from "@/lib/formato";
import { porcentajes, REFERENCIA_503020, type Reparto } from "@/lib/regla503020";

const pct = (v: number) => `${Math.round(v * 100)} %`;

const BLOQUES = [
  { clave: "necesario", nombre: "Necesario", color: "bg-accent" },
  { clave: "capricho", nombre: "Caprichos", color: "bg-forecast" },
  { clave: "sinClasificar", nombre: "Sin clasificar", color: "bg-gridline" },
  { clave: "ahorro", nombre: "Ahorro", color: "bg-success" },
] as const;

// Una barra apilada. Se escala sobre lo que entra o sobre lo que sale, lo que sea mayor:
// si un mes se gasta más de lo que entra no hay ahorro que pintar, y la barra tiene que
// seguir sumando el 100 % de su ancho en vez de desbordarse.
function Barra({ partes }: { partes: { clave: string; valor: number; color: string }[] }) {
  const visibles = partes.filter((p) => p.valor > 0);
  const total = visibles.reduce((s, p) => s + p.valor, 0);
  if (total <= 0) return <div className="h-9 rounded-btn bg-chip" />;
  return (
    <div className="flex h-9 overflow-hidden rounded-btn">
      {visibles.map((p) => {
        const ancho = (p.valor / total) * 100;
        return (
          <div
            key={p.clave}
            className={`${p.color} flex min-w-0 items-center justify-center text-[12px] font-semibold text-white`}
            style={{ width: `${ancho}%` }}
          >
            {ancho >= 9 ? `${Math.round(ancho)} %` : ""}
          </div>
        );
      })}
    </div>
  );
}

function Fila({ titulo, detalle, children }: { titulo: string; detalle: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[150px_1fr] sm:gap-4">
      <div>
        <p className="text-[13px] font-semibold text-ink">{titulo}</p>
        <p className="text-[11px] text-ink-tertiary">{detalle}</p>
      </div>
      {children}
    </div>
  );
}

function barraDe(r: Reparto) {
  return BLOQUES.map((b) => ({ clave: b.clave, valor: r[b.clave], color: b.color }));
}

export function Regla503020({
  moneda,
  etiquetaMes,
  descripcionMes,
  hastaHoy,
  cierre,
  objetivo,
  incluirInversionEnAhorro,
}: {
  moneda: string;
  etiquetaMes: string;
  descripcionMes?: string;
  hastaHoy: Reparto;
  cierre: Reparto;
  objetivo: number | null;
  incluirInversionEnAhorro: boolean;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const pHoy = porcentajes(hastaHoy);
  const pCierre = porcentajes(cierre);
  const haySinClasificar = Math.abs(hastaHoy.sinClasificar) >= 0.5 || Math.abs(cierre.sinClasificar) >= 0.5;
  // El objetivo se compara con el ahorro según el criterio de Configuración: con o sin lo
  // que va a inversión, igual que en el resto de la app.
  const ahorroParaObjetivo = incluirInversionEnAhorro ? cierre.ahorro : cierre.ahorro - cierre.inversion;

  const referencia = [
    { clave: "necesario", valor: REFERENCIA_503020.necesario, color: "bg-accent" },
    { clave: "capricho", valor: REFERENCIA_503020.capricho, color: "bg-forecast" },
    { clave: "ahorro", valor: REFERENCIA_503020.ahorro, color: "bg-success" },
  ];

  const filasTabla: { nombre: string; ref: number | null; hoy: number; cierre: number; nota?: string }[] = [
    { nombre: "Necesario", ref: cierre.ingresos * REFERENCIA_503020.necesario, hoy: hastaHoy.necesario, cierre: cierre.necesario },
    { nombre: "Caprichos", ref: cierre.ingresos * REFERENCIA_503020.capricho, hoy: hastaHoy.capricho, cierre: cierre.capricho },
    ...(haySinClasificar
      ? [{ nombre: "Sin clasificar", ref: null, hoy: hastaHoy.sinClasificar, cierre: cierre.sinClasificar }]
      : []),
    {
      nombre: "Ahorro",
      ref: cierre.ingresos * REFERENCIA_503020.ahorro,
      hoy: hastaHoy.ahorro,
      cierre: cierre.ahorro,
      nota: `de ello, a inversión: ${formatEUR(hastaHoy.inversion)} hasta hoy · ${formatEUR(cierre.inversion)} al cierre`,
    },
  ];
  const porcentajeDe = (valor: number, ingresos: number) => (ingresos > 0 ? pct(valor / ingresos) : "—");

  return (
    <div className="rounded-card border border-border bg-surface p-7 shadow-card">
      <h2 className="font-sora text-lg font-semibold text-ink">Regla 50/30/20 · {etiquetaMes}</h2>
      <p className="mb-4 mt-1 max-w-2xl text-[13px] text-ink-secondary">
        Cómo se reparte lo que entra este mes: la mitad para lo necesario, un 30 % para caprichos y al menos un 20 %
        de ahorro. {descripcionMes}
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
        {BLOQUES.filter((b) => b.clave !== "sinClasificar" || haySinClasificar).map((b) => (
          <span key={b.clave} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-sm ${b.color}`} />
            {b.nombre}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        <Fila titulo="Referencia" detalle="Lo recomendable">
          <Barra partes={referencia} />
        </Fila>
        <Fila titulo="Hasta hoy" detalle={`Entrado: ${formatEUR(hastaHoy.ingresos)}`}>
          {pHoy ? (
            <Barra partes={barraDe(hastaHoy)} />
          ) : (
            <p className="text-[13px] text-ink-tertiary">Todavía no ha entrado ningún ingreso este mes.</p>
          )}
        </Fila>
        <Fila titulo="Previsión al cierre" detalle={`Entrará: ${formatEUR(cierre.ingresos)}`}>
          {pCierre ? (
            <Barra partes={barraDe(cierre)} />
          ) : (
            <p className="text-[13px] text-ink-tertiary">No hay ingresos previstos para este mes.</p>
          )}
        </Fila>
      </div>

      {cierre.ahorro < 0 && (
        <p className="mt-3 text-[13px] font-semibold text-danger">
          Al ritmo previsto, este mes saldrán {formatEUR(-cierre.ahorro)} más de lo que entra.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-ink-tertiary">
              <th className="py-2 pr-3 font-semibold">Bloque</th>
              <th className="py-2 pr-3 text-right font-semibold">Referencia</th>
              <th className="py-2 pr-3 text-right font-semibold">Hasta hoy</th>
              <th className="py-2 text-right font-semibold">Previsión al cierre</th>
            </tr>
          </thead>
          <tbody>
            {filasTabla.map((f) => (
              <tr key={f.nombre} className="border-b border-border last:border-b-0">
                <td className="py-2.5 pr-3 text-ink">
                  {f.nombre}
                  {f.nota && <span className="block text-[11px] text-ink-tertiary">{f.nota}</span>}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-ink-tertiary">
                  {f.ref === null ? "—" : formatEUR(f.ref)}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-ink">
                  {formatEUR(f.hoy)} <span className="text-ink-tertiary">· {porcentajeDe(f.hoy, hastaHoy.ingresos)}</span>
                </td>
                <td
                  className={`py-2.5 text-right font-semibold tabular-nums ${
                    f.nombre === "Ahorro" && f.cierre < 0 ? "text-danger" : "text-ink"
                  }`}
                >
                  {formatEUR(f.cierre)} <span className="font-normal text-ink-tertiary">· {porcentajeDe(f.cierre, cierre.ingresos)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-[13px] text-ink-secondary">
        {objetivo !== null ? (
          <p>
            Objetivo de ahorro: <span className="font-semibold text-ink">{formatEUR(objetivo)}</span>
            {incluirInversionEnAhorro ? " (contando la inversión)" : " (sin contar la inversión)"} · previsión al cierre{" "}
            <span className={`font-semibold ${ahorroParaObjetivo >= objetivo ? "text-success" : "text-danger"}`}>
              {formatEUR(ahorroParaObjetivo)} — {ahorroParaObjetivo >= objetivo ? "se cumple" : "no se cumple"}
            </span>
          </p>
        ) : (
          <p>
            Todavía no has fijado un objetivo de ahorro.{" "}
            <Link href="/configuracion" className="font-semibold text-accent">
              Configúralo aquí
            </Link>
            .
          </p>
        )}
        {haySinClasificar && (
          <p className="text-ink-tertiary">
            Hay movimientos en categorías sin bloque o sin categoría.{" "}
            <Link href="/categorias" className="font-semibold text-accent">
              Asígnales un bloque en Categorías
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

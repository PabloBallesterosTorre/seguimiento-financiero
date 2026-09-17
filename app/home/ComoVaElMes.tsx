import { formatMonedaTabla } from "@/lib/formato";
import type { ComoVaElMes as Datos } from "@/lib/informes";

function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );
}

// Responde a "¿cómo voy este mes?" con el número que pidió el usuario: cuánto más (o
// menos) tiene ahora que en el último movimiento antes de cobrar la nómina.
//
// Debajo van DOS referencias del mes anterior, no una. Con sus datos reales, a día 20 de
// agosto iba en +40,44 € y el mes cerró en −1.370,48 €: todo el gasto se concentró en los
// últimos ocho días. Enseñar solo "cómo ibas a estas alturas" invitaría a confiarse, y
// enseñar solo el cierre no dejaría comparar a mitad de mes.
export function ComoVaElMes({
  datos,
  moneda,
  inicioMes,
  finMes,
  hoy,
  etiquetaMesAnterior,
  ambito,
}: {
  datos: Datos;
  moneda: string;
  inicioMes: string;
  finMes: string;
  hoy: string;
  etiquetaMesAnterior: string | null;
  ambito: "personal" | "conjunto" | "todo";
}) {
  const { acumulado, mismoPuntoMesAnterior, cierreMesAnterior } = datos;
  // Tres estados, no dos: más, menos e igual. Pintar un 0,00 € en verde con un "+" delante
  // afirma algo que no ha pasado — el mismo fallo que ya se corrigió en KpiDineroDisponible.
  const enCero = Math.abs(acumulado) < 0.005;
  const positivo = acumulado > 0;
  const diasRestantes = Math.max(
    Math.round(
      (new Date(`${finMes}T00:00:00Z`).getTime() - new Date(`${hoy}T00:00:00Z`).getTime()) / 86400000
    ),
    0
  );

  const mejora = mismoPuntoMesAnterior === null ? null : acumulado - mismoPuntoMesAnterior;

  const queEs =
    ambito === "conjunto"
      ? "en la cuenta común"
      : ambito === "personal"
        ? "en tus cuentas personales"
        : "sumando lo personal y lo común";

  return (
    <div className="rounded-card border border-border bg-surface p-[22px] shadow-card sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-sora text-[15px] font-bold text-ink">Cómo va el mes</h2>
        <span className="text-[13px] text-ink-tertiary">
          desde el cierre del {fechaCorta(inicioMes)}
        </span>
      </div>

      <p
        className={`mt-3 break-words font-sora text-[32px] font-bold leading-none tabular-nums sm:text-[44px] ${
          enCero ? "text-ink" : positivo ? "text-success" : "text-danger"
        }`}
      >
        {!enCero && (positivo ? "+" : "−")}
        {formatMonedaTabla(Math.abs(acumulado), moneda)}
      </p>
      <p className="mt-2.5 text-[13px] text-ink-tertiary">
        {enCero
          ? `El saldo ${queEs} está igual que antes de cobrar.`
          : `Es lo que llevas de ${positivo ? "más" : "menos"} ${queEs} desde el último movimiento antes de cobrar.`}{" "}
        {diasRestantes > 0
          ? `Quedan ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} hasta el cierre.`
          : "El mes está a punto de cerrar."}
      </p>

      {etiquetaMesAnterior && mismoPuntoMesAnterior !== null && cierreMesAnterior !== null ? (
        <div className="mt-5 space-y-2 border-t border-border pt-4 text-[13px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-ink-secondary">
              A estas alturas de {etiquetaMesAnterior.toLowerCase()} ibas en
            </span>
            <span className="tabular-nums text-ink">
              {formatMonedaTabla(mismoPuntoMesAnterior, moneda)}
              {indicadorMejora(mejora)}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-ink-secondary">{etiquetaMesAnterior} cerró en</span>
            <span className="tabular-nums text-ink">{formatMonedaTabla(cierreMesAnterior, moneda)}</span>
          </div>
          {cierreMesAnterior < mismoPuntoMesAnterior && (
            <p className="pt-1 text-[12px] text-ink-tertiary">
              Ojo: el mes pasado la mayor parte del gasto llegó en la recta final, así que ir bien ahora
              no garantiza cerrar bien.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-[13px] text-ink-tertiary">
          Todavía no hay un mes cerrado con el que comparar.
        </p>
      )}
    </div>
  );
}

function indicadorMejora(diferencia: number | null) {
  if (diferencia === null || Math.abs(diferencia) < 0.005) return null;
  return (
    <span className={`ml-2 font-semibold ${diferencia > 0 ? "text-success" : "text-danger"}`}>
      {diferencia > 0 ? "vas mejor" : "vas peor"}
    </span>
  );
}

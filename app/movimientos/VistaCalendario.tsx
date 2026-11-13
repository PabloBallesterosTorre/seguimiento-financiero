import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { construirCalendario, mesVecino } from "@/lib/calendario";
import { formatMoneda } from "@/lib/formato";
import type { MovimientoPrevisto } from "@/lib/prevision";

const NOMBRES_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// En la celda caben pocas líneas: a partir de aquí se resume con "+N más".
const MAX_ITEMS_DIA = 3;

function nombreMes(mes: string) {
  const texto = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
    new Date(`${mes}-01T00:00:00`)
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Tanda 16: Movimientos en un mes de calendario. Lo real en sólido; lo previsto que falta
// por llegar, con borde discontinuo, para ver de un vistazo qué cae y cuándo.
export async function VistaCalendario({ mes, moneda }: { mes: string; moneda: string }) {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimoDia = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();

  const [{ data: movimientos }, { data: previstos }, { data: conciliaciones }] = await Promise.all([
    supabase
      .from("movimientos")
      .select("id, fecha, descripcion, importe, tipo")
      .gte("fecha", `${mes}-01`)
      .lte("fecha", `${mes}-${String(ultimoDia).padStart(2, "0")}`)
      .order("fecha"),
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("previsto_conciliaciones").select("previsto_id, periodo"),
  ]);

  const { semanas, resumen } = construirCalendario(
    mes,
    (movimientos ?? []).map((m) => ({ ...m, importe: Number(m.importe) })),
    ((previstos ?? []) as MovimientoPrevisto[]).map((p) => ({ ...p, importe_estimado: Number(p.importe_estimado) })),
    conciliaciones ?? [],
    hoy
  );

  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const enlaceMes = (m: string) => `/movimientos?vista=calendario&mes=${m}`;
  const colorImporte = (tipo: string, importe: number) =>
    tipo === "traspaso" ? "text-accent" : importe < 0 ? "text-ink" : "text-success";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={enlaceMes(mesVecino(mes, -1))}
            aria-label="Mes anterior"
            className="rounded-btn border border-border-strong px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-chip"
          >
            ‹
          </Link>
          <h2 className="min-w-[10rem] text-center font-sora text-base font-semibold text-ink">{nombreMes(mes)}</h2>
          <Link
            href={enlaceMes(mesVecino(mes, 1))}
            aria-label="Mes siguiente"
            className="rounded-btn border border-border-strong px-2.5 py-1.5 text-sm text-ink-secondary hover:bg-chip"
          >
            ›
          </Link>
          {mes !== hoy.slice(0, 7) && (
            <Link href={enlaceMes(hoy.slice(0, 7))} className="ml-1 text-[13px] font-semibold text-accent hover:underline">
              Hoy
            </Link>
          )}
        </div>
        <p className="text-[13px] tabular-nums text-ink-tertiary">
          Entradas <span className="font-semibold text-success">{formatEUR(resumen.entradas)}</span> · Salidas{" "}
          <span className="font-semibold text-ink">{formatEUR(resumen.salidas)}</span> · Neto{" "}
          <span className={`font-semibold ${resumen.neto >= 0 ? "text-success" : "text-ink"}`}>
            {resumen.neto >= 0 ? "+" : ""}
            {formatEUR(resumen.neto)}
          </span>
          {resumen.previstoNeto !== 0 && (
            <>
              {" "}
              · Previsto pendiente{" "}
              <span className="font-semibold text-forecast">
                {resumen.previstoNeto >= 0 ? "+" : ""}
                {formatEUR(resumen.previstoNeto)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Escritorio: rejilla de 7 columnas. */}
      <div className="hidden overflow-hidden rounded-card border border-border bg-surface shadow-card md:block">
        <div className="grid grid-cols-7 border-b border-border bg-chip/60">
          {NOMBRES_DIA.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-ink-tertiary">
              {d}
            </div>
          ))}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0].fecha} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {semana.map((dia) => (
              <div
                key={dia.fecha}
                className={`min-h-[7.5rem] border-r border-border p-1.5 last:border-r-0 ${
                  dia.delMes ? "" : "bg-page/60"
                }`}
              >
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span
                    className={`text-xs font-semibold ${
                      dia.esHoy
                        ? "rounded-full bg-ink px-1.5 py-0.5 text-white"
                        : dia.delMes
                          ? "text-ink-secondary"
                          : "text-faint"
                    }`}
                  >
                    {Number(dia.fecha.slice(8, 10))}
                  </span>
                  {dia.neto !== 0 && (
                    <span className={`text-[10px] font-semibold tabular-nums ${dia.neto > 0 ? "text-success" : "text-ink-tertiary"}`}>
                      {dia.neto > 0 ? "+" : ""}
                      {formatEUR(dia.neto)}
                    </span>
                  )}
                </div>
                <ul className="space-y-1">
                  {dia.items.slice(0, MAX_ITEMS_DIA).map((it) => (
                    <li
                      key={it.id}
                      title={`${it.descripcion} · ${formatEUR(it.importe)}${it.previsto ? " (previsto)" : ""}`}
                      className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[11px] ${
                        it.previsto ? "border border-dashed border-forecast/60 text-ink-secondary" : "bg-chip/70"
                      }`}
                    >
                      <span className="truncate">{it.descripcion}</span>
                      <span className={`shrink-0 font-semibold tabular-nums ${colorImporte(it.tipo, it.importe)}`}>
                        {formatEUR(it.importe)}
                      </span>
                    </li>
                  ))}
                  {dia.items.length > MAX_ITEMS_DIA && (
                    <li className="px-1.5 text-[11px] text-ink-tertiary">+{dia.items.length - MAX_ITEMS_DIA} más</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Móvil: siete columnas no caben en 375 px, así que se lista día a día lo que tiene algo. */}
      <div className="space-y-3 md:hidden">
        {semanas
          .flat()
          .filter((d) => d.delMes && d.items.length > 0)
          .map((dia) => (
            <div key={dia.fecha} className="rounded-card border border-border bg-surface p-3 shadow-card">
              <p className={`mb-2 text-xs font-semibold ${dia.esHoy ? "text-accent" : "text-ink-secondary"}`}>
                {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric" }).format(
                  new Date(`${dia.fecha}T00:00:00`)
                )}
                {dia.esHoy && " · hoy"}
              </p>
              <ul className="space-y-1.5">
                {dia.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className={`truncate ${it.previsto ? "italic text-ink-secondary" : "text-ink"}`}>
                      {it.descripcion}
                      {it.previsto && <span className="ml-1.5 text-[11px] not-italic text-forecast">previsto</span>}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${colorImporte(it.tipo, it.importe)}`}>
                      {formatEUR(it.importe)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <p className="text-[11px] text-ink-tertiary">
        Borde discontinuo: previsto que todavía no ha llegado. Los previstos ya conciliados se ven como su movimiento
        real; los presupuestos de categoría no tienen día y no salen aquí.
      </p>
    </div>
  );
}

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  construirPeriodosConciliados,
  generarMeses,
  contarConciliacionesPorMes,
  ocurrenciasPendientesEnMes,
  importeEfectivoPrevisto,
  ocurrenciasEnMes,
  previstoAplicaEnMes,
  previstoYaMaterializadoEnMes,
  type MovimientoPrevisto,
} from "@/lib/prevision";
import { calcularInteresesPrevistos } from "@/lib/intereses";
import { mapaMediaPorCategoria, type MovimientoHistorico } from "@/lib/deteccionPatrones";
import { desvincularMovimientoPrevisto, vincularMovimientoPrevisto } from "./actions";
import { obtenerConfiguracion, obtenerOpcionesMesFinanciero } from "@/lib/configuracion";
import { mesDe } from "@/lib/mesFinanciero";
import { formatMoneda } from "@/lib/formato";
import { filtrarMovimientosPorCuentasSeleccionadas, resolverCuentasSeleccionadas } from "@/lib/informes";
import { SelectorCuentas } from "@/components/SelectorCuentas";

const HORIZONTES = [3, 6, 12];

export default async function PrevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string; cuentas?: string }>;
}) {
  const { meses: mesesParam, cuentas: cuentasParam } = await searchParams;
  const supabase = await createClient();
  const horizonte = HORIZONTES.includes(Number(mesesParam)) ? Number(mesesParam) : 3;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoyDate = new Date();
  const inicioMes = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, "0")}-01`;
  const inicioMesSiguienteDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 1);
  const inicioMesSiguiente = `${inicioMesSiguienteDate.getFullYear()}-${String(
    inicioMesSiguienteDate.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const desde = new Date();
  desde.setFullYear(desde.getFullYear() - 3);

  const [
    { data: previstosRaw },
    { data: categorias },
    { data: cuentas },
    { data: movimientosMes },
    { data: historicoRaw },
    { data: conciliacionesRaw },
    config,
  ] = await Promise.all([
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("categorias").select("id, nombre, categoria_padre_id"),
    supabase
      .from("cuentas")
      .select("id, nombre, banco_nombre, saldo_actual, es_remunerada, tipo_interes")
      .eq("activa", true),
    supabase
      .from("movimientos")
      .select("id, descripcion, importe, tipo, categoria_id, fecha, cuenta_id, traspaso_grupo_id")
      .gte("fecha", inicioMes)
      .lt("fecha", inicioMesSiguiente),
    supabase
      .from("movimientos")
      .select("descripcion, categoria_id, tipo, importe, fecha, cuenta_id, traspaso_grupo_id")
      .gte("fecha", desde.toISOString().slice(0, 10)),
    supabase.from("previsto_conciliaciones").select("previsto_id, periodo, movimiento_real_id"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");
  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const nombreCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  const idsCuentasActivas = (cuentas ?? []).map((c) => c.id);
  const cuentasSeleccionadas = resolverCuentasSeleccionadas(
    idsCuentasActivas,
    cuentasParam,
    config?.cuentas_excluidas_informes ?? []
  );
  const cuentasFiltradas = (cuentas ?? []).filter((c) => cuentasSeleccionadas.has(c.id));

  const saldoInicial = cuentasFiltradas.reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const movimientosDelMes = filtrarMovimientosPorCuentasSeleccionadas(
    (movimientosMes ?? []) as { id: string; descripcion: string; importe: number; tipo: string; categoria_id: string | null; fecha: string; cuenta_id: string; traspaso_grupo_id: string | null }[],
    cuentasSeleccionadas
  );

  const conciliaciones = conciliacionesRaw ?? [];

  const cuentasRemuneradas = cuentasFiltradas
    .filter((c) => c.es_remunerada && c.tipo_interes !== null)
    .map((c) => ({ id: c.id, saldo_actual: Number(c.saldo_actual), tipo_interes: Number(c.tipo_interes) }));

  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const historico = filtrarMovimientosPorCuentasSeleccionadas(
    (historicoRaw ?? []) as {
      descripcion: string;
      categoria_id: string | null;
      tipo: string;
      importe: number;
      fecha: string;
      cuenta_id: string;
      traspaso_grupo_id: string | null;
    }[],
    cuentasSeleccionadas
  ) as unknown as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historico, categoriaEfectiva);

  // Mismos meses que el resto de la app: de nómina a nómina si está activado.
  const opcionesMes = config
    ? await obtenerOpcionesMesFinanciero(supabase, config)
    : { activo: false, diaCorte: 25, anclas: [] };
  const mesDeFecha = (fecha: string) => mesDe(fecha, opcionesMes);
  const mesActualLabel = mesDeFecha(new Date().toISOString().slice(0, 10));
  const mesEnCurso = { year: Number(mesActualLabel.slice(0, 4)), month: Number(mesActualLabel.slice(5, 7)) };

  const periodosConciliados = construirPeriodosConciliados(conciliaciones, mesDeFecha);
  const conciliacionesPorMes = contarConciliacionesPorMes(conciliaciones, mesDeFecha);
  const categoriasConMovimiento = new Set(
    historico
      .filter((m) => m.categoria_id)
      // Resuelta al padre: el presupuesto vive en "Ocio" y el gasto cae en "Restaurantes".
      .map((m) => `${categoriaEfectiva(m.categoria_id!)}:${mesDeFecha(m.fecha)}`)
  );

  const mesesHorizonte = generarMeses(horizonte, mesEnCurso);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    mesesHorizonte,
    mediaPorCategoria,
    periodosConciliados
  );

  const meses = mesesHorizonte.map((mes) => {
    // Cuántas ocurrencias quedan pendientes de cada previsto: descuenta lo ya conciliado
    // ocurrencia a ocurrencia (los semanales no se cumplen enteros de golpe) y apaga los
    // presupuestos de categoría cuyo mes ya tiene gasto real.
    const pendientes = new Map<string, number>();
    for (const p of previstos) {
      const n = ocurrenciasPendientesEnMes(p, mes.year, mes.month, {
        conciliacionesPorMes,
        categoriasConMovimiento,
        categoriaEfectiva,
      });
      if (n > 0) pendientes.set(p.id, n);
    }
    const aplicables = previstos.filter((p) => pendientes.has(p.id));
    const traspasos = aplicables.filter((p) => p.tipo === "traspaso");
    const resto = aplicables.filter((p) => p.tipo !== "traspaso");

    const porCategoria = new Map<string, { nombre: string; importe: number }>();
    for (const p of resto) {
      const clave = p.categoria_id ?? "__sin_categoria__";
      const nombre = p.categoria_id ? nombreCategoria.get(p.categoria_id) ?? "Categoría eliminada" : "Sin categoría";
      const signo = p.tipo === "ingreso" ? 1 : -1;
      const actual = porCategoria.get(clave) ?? { nombre, importe: 0 };
      actual.importe += signo * importeEfectivoPrevisto(p, mediaPorCategoria) * (pendientes.get(p.id) ?? 0);
      porCategoria.set(clave, actual);
    }

    const interesMes = interesesPorMes.get(`${mes.year}-${mes.month}`) ?? 0;
    if (interesMes > 0) {
      porCategoria.set("__intereses__", { nombre: "Intereses (cuentas remuneradas)", importe: interesMes });
    }

    const totalMes = Array.from(porCategoria.values()).reduce((sum, c) => sum + c.importe, 0);

    return { ...mes, porCategoria: Array.from(porCategoria.entries()), totalMes, traspasos, previstosMes: resto, pendientes };
  });

  let saldoAcumulado = saldoInicial;
  const mesesConSaldo = meses.map((mes) => {
    saldoAcumulado += mes.totalMes;
    return { ...mes, saldoProyectado: saldoAcumulado };
  });

  const mesActual = mesesConSaldo[0];
  const claveMesActual = mesActual ? `${mesActual.year}-${String(mesActual.month).padStart(2, "0")}` : null;

  // Las conciliaciones del mes en curso, una por una y no una por previsto: un previsto
  // semanal puede tener varias, y cada una se desvincula por su cuenta. Cada fila lleva su
  // propio `periodo` (la fecha del movimiento real), que es la clave con la que se borra.
  const conciliacionesDelMes = claveMesActual
    ? conciliaciones
        .filter((c) => mesDeFecha(c.periodo) === claveMesActual)
        .map((c) => ({
          ...c,
          previsto: previstos.find((p) => p.id === c.previsto_id) ?? null,
        }))
        .filter((c) => c.previsto !== null)
        .sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
    : [];

  // previstosMes ya solo trae los que tienen ocurrencias PENDIENTES, así que un semanal a
  // medio conciliar sigue apareciendo aquí con las que le quedan.
  const previstosSinVincular = mesActual?.previstosMes ?? [];

  const cuentasQS =
    cuentasSeleccionadas.size === idsCuentasActivas.length ? "" : `&cuentas=${Array.from(cuentasSeleccionadas).join(",")}`;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Previsión de flujo de caja</h1>
          <div className="flex items-center gap-4">
            <Link href="/prevision/diagnostico" className="text-[13px] font-semibold text-accent hover:underline">
              Diagnóstico →
            </Link>
            <Link href="/prevision/previstos" className="text-[13px] font-semibold text-accent hover:underline">
              Gestionar previsiones →
            </Link>
          </div>
        </div>

        <SelectorCuentas
          cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: c.nombre, banco_nombre: c.banco_nombre }))}
          seleccionadas={Array.from(cuentasSeleccionadas)}
        />

        <div className="flex w-fit rounded-full bg-chip p-1">
          {HORIZONTES.map((h) => (
            <Link
              key={h}
              href={`/prevision?meses=${h}${cuentasQS}`}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                h === horizonte ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {h} meses
            </Link>
          ))}
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="text-[13px] text-ink-secondary">Saldo actual de cuentas</p>
          <p className="mt-2 font-sora text-[28px] font-bold text-ink">{formatEUR(saldoInicial)}</p>
        </div>

        <div className="space-y-4">
          {mesesConSaldo.map((mes, i) => (
            <div key={`${mes.year}-${mes.month}`} className="rounded-card border border-border bg-surface p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-ink">
                  {mes.label}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      i === 0 ? "bg-forecast/15 text-forecast" : "bg-accent-soft text-accent"
                    }`}
                  >
                    {i === 0 ? "Mes en curso" : "Previsión"}
                  </span>
                </h2>
                <p className="text-[13px] text-ink-secondary">
                  Neto:{" "}
                  <span className={`font-semibold ${mes.totalMes >= 0 ? "text-success" : "text-danger"}`}>
                    {formatEUR(mes.totalMes)}
                  </span>{" "}
                  · Saldo proyectado:{" "}
                  <span className="font-semibold text-ink">{formatEUR(mes.saldoProyectado)}</span>
                </p>
              </div>

              {mes.porCategoria.length === 0 ? (
                <p className="mt-3 text-sm text-ink-tertiary">Sin previsiones para este mes.</p>
              ) : (
                <table className="mt-3 w-full text-[13px]">
                  <tbody>
                    {mes.porCategoria.map(([clave, c]) => (
                      <tr key={clave} className="border-t border-border">
                        <td className="py-1.5 text-ink-secondary">{c.nombre}</td>
                        <td className={`py-1.5 text-right font-semibold ${c.importe >= 0 ? "text-success" : "text-ink"}`}>
                          {formatEUR(c.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {mes.traspasos.length > 0 && (
                <p className="mt-3 text-xs text-ink-tertiary">
                  + {mes.traspasos.length} traspaso(s) previsto(s) entre cuentas propias (no afectan al total).
                </p>
              )}
            </div>
          ))}
        </div>

        {mesActual && (
          <div className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
            <h2 className="font-sora text-base font-semibold text-ink">
              Previsto vs. real — {mesActual.label}
            </h2>

            {mesActual.porCategoria.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No hay previsiones activas para este mes.</p>
            ) : (
              <div className="space-y-3">
                {mesActual.porCategoria.map(([clave, c]) => {
                  const real = movimientosDelMes
                    .filter((m) => (m.categoria_id ?? "__sin_categoria__") === clave)
                    .reduce((sum, m) => sum + Number(m.importe), 0);
                  const cumplido = c.importe >= 0 ? real >= c.importe : real <= c.importe;
                  const pct =
                    c.importe !== 0 ? Math.min(100, Math.max(0, (Math.abs(real) / Math.abs(c.importe)) * 100)) : 0;

                  return (
                    <div key={clave}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-ink-secondary">{c.nombre}</span>
                        <span>
                          <span className="font-semibold text-ink">{formatEUR(real)}</span>
                          <span className="text-ink-tertiary"> / {formatEUR(c.importe)} previsto</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-chip">
                        <div
                          className={`h-1.5 rounded-full ${cumplido ? "bg-success" : "bg-ink"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(previstosSinVincular.length > 0 || conciliacionesDelMes.length > 0) && (
          <div className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
            <h2 className="font-sora text-base font-semibold text-ink">Conciliación — {mesActual?.label}</h2>
            <p className="text-xs text-ink-tertiary">
              Vincula cada previsión con el movimiento real correspondiente para que no se duplique en la
              proyección de los próximos meses.
            </p>

            {previstosSinVincular.map((p) => {
              const candidatos = movimientosDelMes.filter(
                (m) => (m.categoria_id ?? null) === p.categoria_id
              );
              return (
                <form key={p.id} action={vincularMovimientoPrevisto} className="flex items-center gap-2 text-sm">
                  {/* El periodo ya no se manda: lo deduce el servidor de la fecha del
                      movimiento elegido, que es lo que permite varias conciliaciones de un
                      mismo previsto semanal dentro del mes. */}
                  <input type="hidden" name="previsto_id" value={p.id} />
                  <span className="w-48 truncate text-ink-secondary" title={p.descripcion}>
                    {p.descripcion}
                  </span>
                  <span className="shrink-0 text-ink-tertiary">
                    {formatEUR(importeEfectivoPrevisto(p, mediaPorCategoria))}
                    {(mesActual?.pendientes.get(p.id) ?? 1) > 1 && (
                      <span className="ml-1.5 text-xs">× {mesActual?.pendientes.get(p.id)} pendientes</span>
                    )}
                  </span>
                  <select
                    name="movimiento_id"
                    className="flex-1 rounded-btn border border-border-strong bg-field px-2 py-1.5 text-sm"
                    defaultValue=""
                  >
                    <option value="">Sin vincular todavía</option>
                    {candidatos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.descripcion} — {formatEUR(Number(m.importe))}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-btn border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-chip"
                  >
                    Vincular
                  </button>
                </form>
              );
            })}

            {conciliacionesDelMes.map((c) => (
              <form
                key={`${c.previsto_id}:${c.periodo}`}
                action={desvincularMovimientoPrevisto}
                className="flex items-center gap-2 text-sm"
              >
                <input type="hidden" name="previsto_id" value={c.previsto_id} />
                <input type="hidden" name="periodo" value={c.periodo} />
                <span className="w-48 truncate text-ink-secondary" title={c.previsto?.descripcion}>
                  {c.previsto?.descripcion}
                </span>
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                  Vinculado
                </span>
                <span className="text-xs text-ink-tertiary">
                  {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
                    new Date(`${c.periodo}T00:00:00Z`)
                  )}
                </span>
                <button type="submit" className="text-xs text-ink-tertiary hover:text-danger">
                  Desvincular
                </button>
              </form>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { construirPeriodosConciliados, contarConciliacionesPorMes, generarMeses, generarMesesHaciaAtras, type MovimientoPrevisto } from "@/lib/prevision";
import { calcularInteresesPrevistos } from "@/lib/intereses";
import { mapaMediaPorCategoria, type MovimientoHistorico } from "@/lib/deteccionPatrones";
import {
  construirProyeccionPatrimonio,
  construirHistoricoPatrimonio,
  agruparPorAnio,
  type DeudaParaProyeccion,
  type DeudaParaHistorico,
  type AmortizacionProgramadaDeuda,
  type PuntoProyeccion,
} from "@/lib/planificador";
import { obtenerConfiguracion, obtenerOpcionesMesFinanciero } from "@/lib/configuracion";
import { mesDe, finMesFinanciero } from "@/lib/mesFinanciero";
import { formatMoneda, formatPorcentaje } from "@/lib/formato";
import { rentabilidadPonderada } from "@/lib/inversiones";
import { filtrarMovimientosPorCuentasSeleccionadas, resolverCuentasSeleccionadas } from "@/lib/informes";
import { SelectorCuentas } from "@/components/SelectorCuentas";

const HORIZONTES_MESES = [3, 6, 12];
const HORIZONTES_ANIOS = [5, 10, 20];

export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; horizonte?: string; cuentas?: string }>;
}) {
  const { vista: vistaParam, horizonte: horizonteParam, cuentas: cuentasParam } = await searchParams;
  const supabase = await createClient();
  const vista = vistaParam === "anual" ? "anual" : "mensual";
  const horizonteElegido =
    vista === "mensual"
      ? HORIZONTES_MESES.includes(Number(horizonteParam)) ? Number(horizonteParam) : 12
      : HORIZONTES_ANIOS.includes(Number(horizonteParam)) ? Number(horizonteParam) : 10;
  const horizonteMeses = vista === "mensual" ? horizonteElegido : horizonteElegido * 12;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoy = new Date().toISOString().slice(0, 10);
  const desde = new Date();
  desde.setFullYear(desde.getFullYear() - 3);

  const [
    { data: cuentas },
    { data: inversiones },
    { data: deudasRaw },
    { data: amortizacionesFuturasRaw },
    { data: amortizacionesAplicadasRaw },
    { data: previstosRaw },
    { data: categorias },
    { data: historicoRaw },
    { data: historicoCompletoRaw },
    config,
    { data: conciliacionesRaw },
  ] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, banco_nombre, saldo_actual, es_remunerada, tipo_interes")
      .eq("activa", true),
    supabase.from("inversiones").select("valor_actual, rentabilidad_anual_asumida"),
    supabase.from("deudas").select("id, capital_inicial, capital_pendiente, cuota, tipo_interes, valor_residual, fecha_inicio"),
    supabase
      .from("amortizaciones_extra")
      .select("deuda_id, fecha, importe, tipo_reduccion")
      .eq("aplicado", false)
      .gt("fecha", hoy),
    supabase.from("amortizaciones_extra").select("deuda_id, fecha, importe, tipo_reduccion").eq("aplicado", true),
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("categorias").select("id, es_categoria_inversion, categoria_padre_id"),
    supabase
      .from("movimientos")
      .select("descripcion, categoria_id, tipo, importe, fecha, cuenta_id, traspaso_grupo_id")
      .gte("fecha", desde.toISOString().slice(0, 10)),
    supabase
      .from("movimientos")
      .select("categoria_id, tipo, importe, fecha, cuenta_id, traspaso_grupo_id")
      .in("tipo", ["ingreso", "gasto", "traspaso"]),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    supabase.from("previsto_conciliaciones").select("previsto_id, periodo"),
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  // Mismos meses que en Informes y el Resumen (de nómina a nómina si está activado).
  const opcionesMes = config
    ? await obtenerOpcionesMesFinanciero(supabase, config)
    : { activo: false, diaCorte: 25, anclas: [] };
  const mesDeFecha = (fecha: string) => mesDe(fecha, opcionesMes);
  const finDeMes = (year: number, month: number) => finMesFinanciero(year, month, opcionesMes);
  const mesActualLabel = mesDeFecha(hoy);
  const mesEnCurso = { year: Number(mesActualLabel.slice(0, 4)), month: Number(mesActualLabel.slice(5, 7)) };

  const idsCuentasActivas = (cuentas ?? []).map((c) => c.id);
  const cuentasSeleccionadas = resolverCuentasSeleccionadas(
    idsCuentasActivas,
    cuentasParam,
    config?.cuentas_excluidas_informes ?? []
  );
  const cuentasFiltradas = (cuentas ?? []).filter((c) => cuentasSeleccionadas.has(c.id));

  const saldoLiquidoInicial = cuentasFiltradas.reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const valorInversionInicial = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const deudaActual = (deudasRaw ?? []).reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);
  const rentabilidadAsumida = rentabilidadPonderada(
    (inversiones ?? []).map((i) => ({
      valor_actual: Number(i.valor_actual ?? 0),
      rentabilidad_anual_asumida: i.rentabilidad_anual_asumida !== null ? Number(i.rentabilidad_anual_asumida) : null,
    }))
  );

  const deudas: DeudaParaProyeccion[] = (deudasRaw ?? []).map((d) => ({
    id: d.id,
    capital_pendiente: Number(d.capital_pendiente),
    cuota: Number(d.cuota),
    tipo_interes: d.tipo_interes === null ? null : Number(d.tipo_interes),
    valor_residual: Number(d.valor_residual ?? 0),
  }));

  const amortizacionesProgramadas = (amortizacionesFuturasRaw ?? []).map((a) => ({
    deuda_id: a.deuda_id,
    fecha: a.fecha,
    importe: Number(a.importe),
    tipoReduccion: a.tipo_reduccion as "reducir_cuota" | "reducir_plazo",
  }));

  const deudasHistorico: DeudaParaHistorico[] = (deudasRaw ?? []).map((d) => ({
    id: d.id,
    capital_inicial: Number(d.capital_inicial),
    capital_pendiente: Number(d.capital_pendiente),
    fecha_inicio: d.fecha_inicio,
    cuota: Number(d.cuota),
    tipo_interes: d.tipo_interes === null ? null : Number(d.tipo_interes),
    valor_residual: Number(d.valor_residual ?? 0),
  }));

  const amortizacionesAplicadasPorDeuda = new Map<string, AmortizacionProgramadaDeuda[]>();
  for (const a of amortizacionesAplicadasRaw ?? []) {
    const fila = {
      deuda_id: a.deuda_id,
      fecha: a.fecha,
      importe: Number(a.importe),
      tipoReduccion: a.tipo_reduccion as "reducir_cuota" | "reducir_plazo",
    };
    if (!amortizacionesAplicadasPorDeuda.has(a.deuda_id)) amortizacionesAplicadasPorDeuda.set(a.deuda_id, []);
    amortizacionesAplicadasPorDeuda.get(a.deuda_id)!.push(fila);
  }

  const cuentasRemuneradas = cuentasFiltradas
    .filter((c) => c.es_remunerada && c.tipo_interes !== null)
    .map((c) => ({ id: c.id, saldo_actual: Number(c.saldo_actual), tipo_interes: Number(c.tipo_interes) }));

  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const categoriaEsInversion = new Map((categorias ?? []).map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) =>
    categoriaId !== null && categoriaEsInversion.get(categoriaId) === true;

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

  const periodosConciliados = construirPeriodosConciliados(conciliacionesRaw ?? [], mesDeFecha);
  // Por OCURRENCIAS, no por mes: los previstos semanales (las aportaciones a inversión)
  // no deben darse por cumplidos enteros al conciliar una sola semana.
  const conciliacionesPorMes = contarConciliacionesPorMes(conciliacionesRaw ?? [], mesDeFecha);
  // Categorías que ya tienen movimiento real en cada mes financiero. Es lo que hace que un
  // presupuesto de categoría deje de aportar en el mes en curso: ese mes ya vale lo real.
  const categoriasConMovimiento = new Set(
    historico
      .filter((m) => m.categoria_id)
      // Resuelta al padre: el presupuesto vive en "Ocio" y el gasto cae en "Restaurantes".
      .map((m) => `${categoriaEfectiva(m.categoria_id!)}:${mesDeFecha(m.fecha)}`)
  );

  const meses = generarMeses(horizonteMeses, mesEnCurso);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    meses,
    mediaPorCategoria,
    periodosConciliados
  );

  const puntosFuturos = construirProyeccionPatrimonio({
    meses,
    fechaInicio: hoy,
    saldoLiquidoInicial,
    valorInversionInicial,
    previstos,
    interesesPorMes,
    deudas,
    mediaPorCategoria,
    amortizacionesProgramadas,
    esCategoriaInversion,
    conciliacionesPorMes,
    categoriasConMovimiento,
    categoriaEfectiva,
    rentabilidadAnualAsumidaInversion: rentabilidadAsumida,
  });

  const historicoCompleto = filtrarMovimientosPorCuentasSeleccionadas(
    (historicoCompletoRaw ?? []) as {
      categoria_id: string | null;
      tipo: "ingreso" | "gasto" | "traspaso";
      importe: number;
      fecha: string;
      cuenta_id: string;
      traspaso_grupo_id: string | null;
    }[],
    cuentasSeleccionadas
  );
  const primeraFecha = historicoCompleto.reduce(
    (min, m) => (min === null || m.fecha < min ? m.fecha : min),
    null as string | null
  );

  const mesesPasadosSolicitados = generarMesesHaciaAtras(horizonteMeses, mesEnCurso);
  const mesesPasadosDisponibles = primeraFecha
    ? mesesPasadosSolicitados.filter(
        (m) => `${m.year}-${String(m.month).padStart(2, "0")}` >= mesDeFecha(primeraFecha)
      )
    : [];

  const puntosHistoricos: PuntoProyeccion[] =
    mesesPasadosDisponibles.length > 0
      ? construirHistoricoPatrimonio({
          meses: mesesPasadosDisponibles,
          movimientos: historicoCompleto,
          saldoLiquidoActual: saldoLiquidoInicial,
          deudas: deudasHistorico,
          amortizacionesAplicadasPorDeuda,
          esCategoriaInversion,
          hoy,
          finDeMes,
        })
      : [];

  const puntos = [...puntosHistoricos, ...puntosFuturos];
  const indiceMesActual = puntosHistoricos.length;
  const filasAnuales = vista === "anual" ? agruparPorAnio(puntos) : [];

  const cuentasQS =
    cuentasSeleccionadas.size === idsCuentasActivas.length ? "" : `&cuentas=${Array.from(cuentasSeleccionadas).join(",")}`;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-10">
        <div className="flex items-start justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Planificador</h1>
          <Link href="/prevision" className="text-[13px] font-semibold text-accent hover:underline">
            Ver previsión de flujo →
          </Link>
        </div>

        <SelectorCuentas
          cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: c.nombre, banco_nombre: c.banco_nombre }))}
          seleccionadas={Array.from(cuentasSeleccionadas)}
        />

        {/* El texto no se recorta ni se tira: explica por qué cada número es lo que es, y
            eso es de lo mejor que tiene la pantalla. Pero siete líneas densas por delante de
            todo hacían que la pantalla abriera con una lectura en vez de con los datos
            (auditoría de diseño, tanda 11). */}
        <details className="max-w-3xl">
          <summary className="cursor-pointer list-none text-[13px] font-semibold text-accent hover:underline">
            Cómo se calcula esta proyección
          </summary>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
          Evolución de líquido, deuda e inversión, hacia atrás (reconstruido a partir de tu
          histórico real) y hacia adelante (previsión de flujo de caja, calendario de amortización
          e intereses de cuentas remuneradas). El horizonte elegido aplica en ambas direcciones.
          Para los meses pasados, la inversión es lo aportado hasta esa fecha (coste, no el valor
          de mercado histórico, que no se registra); para hoy y los meses futuros, es el valor real
          de hoy más las aportaciones previstas
          {rentabilidadAsumida !== null && rentabilidadAsumida !== 0 ? (
            <>
              {" "}
              compuestas a la rentabilidad anual asumida de cada inversión (
              <span className="font-semibold text-ink">{formatPorcentaje(rentabilidadAsumida, { decimales: 1 })} de media ponderada</span> —
              es una <span className="font-semibold">proyección estimada</span>, no una previsión real)
            </>
          ) : (
            " — no se asume ninguna rentabilidad futura mientras no definas una en cada inversión"
          )}
          . Un previsto ya vinculado a un movimiento real de este mes no se suma también como
          previsión — el saldo de hoy ya lo incluye.
          </p>
        </details>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Hoy — patrimonio real</p>
            <span className="rounded-full bg-success/12 px-2.5 py-0.5 text-[10px] font-bold text-success">Real</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <p className="text-xs text-ink-tertiary">Líquido</p>
              <p className="mt-1.5 font-sora text-lg font-bold text-ink">{formatEUR(saldoLiquidoInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-tertiary">Inversión</p>
              <p className="mt-1.5 font-sora text-lg font-bold text-ink">{formatEUR(valorInversionInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-tertiary">Deuda pendiente</p>
              <p className="mt-1.5 font-sora text-lg font-bold text-ink">{formatEUR(deudaActual)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-tertiary">Patrimonio con deuda</p>
              <p className={`mt-1.5 font-sora text-lg font-bold ${saldoLiquidoInicial + valorInversionInicial - deudaActual < 0 ? "text-danger" : "text-ink"}`}>
                {formatEUR(saldoLiquidoInicial + valorInversionInicial - deudaActual)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-tertiary">Patrimonio sin deuda</p>
              <p className="mt-1.5 font-sora text-lg font-bold text-ink">{formatEUR(saldoLiquidoInicial + valorInversionInicial)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex w-fit gap-2 text-[10px] font-bold">
              <span className="rounded-full bg-success/12 px-2.5 py-1 text-success">Real</span>
              <span className="rounded-full bg-forecast/15 px-2.5 py-1 text-forecast">Mixto</span>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">Proyección</span>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-tertiary">
              histórico real, el mes en curso (real + lo que falta) o previsión futura
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex rounded-full bg-chip p-1">
              <Link
                href={`/planificador?vista=mensual${cuentasQS}`}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${vista === "mensual" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"}`}
              >
                Mensual
              </Link>
              <Link
                href={`/planificador?vista=anual${cuentasQS}`}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${vista === "anual" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"}`}
              >
                Anual
              </Link>
            </div>
            <div className="flex rounded-full bg-chip p-1">
              {(vista === "mensual" ? HORIZONTES_MESES : HORIZONTES_ANIOS).map((h) => (
                <Link
                  key={h}
                  href={`/planificador?vista=${vista}&horizonte=${h}${cuentasQS}`}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${horizonteElegido === h ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"}`}
                >
                  {h} {vista === "mensual" ? "meses" : "años"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-3 py-3"></th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">{vista === "mensual" ? "Mes" : "Año"}</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">
                  {vista === "mensual" ? "Flujo neto" : "Flujo neto anual"}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Líquido</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Inversión</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Deuda pendiente</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Patrimonio (con deuda)</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Patrimonio (sin deuda)</th>
              </tr>
            </thead>
            <tbody>
              {vista === "mensual"
                ? puntos.map((p, i) => {
                    const esMesActual = i === indiceMesActual;
                    return (
                    <tr key={`${p.year}-${p.month}`} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.esReal
                              ? "bg-success/12 text-success"
                              : esMesActual
                                ? "bg-forecast/15 text-forecast"
                                : "bg-accent-soft text-accent"
                          }`}
                        >
                          {p.esReal ? "Real" : esMesActual ? "Mixto" : "Proy."}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-secondary">{p.label}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right ${p.flujoNeto >= 0 ? "text-success" : "text-ink"}`}>
                        {formatEUR(p.flujoNeto)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatEUR(p.saldoLiquido)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatEUR(p.valorInversion)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatEUR(p.deudaPendiente)}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${p.patrimonioConDeuda < 0 ? "text-danger" : "text-ink"}`}>
                        {formatEUR(p.patrimonioConDeuda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink">
                        {formatEUR(p.patrimonioSinDeuda)}
                      </td>
                    </tr>
                    );
                  })
                : filasAnuales.map((f) => (
                    <tr key={f.year} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            f.esReal ? "bg-success/12 text-success" : "bg-accent-soft text-accent"
                          }`}
                        >
                          {f.esReal ? "Real" : "Proy."}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-secondary">{f.year}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right ${f.flujoNetoAnual >= 0 ? "text-success" : "text-ink"}`}>
                        {formatEUR(f.flujoNetoAnual)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatEUR(f.saldoLiquido)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatEUR(f.valorInversion)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-ink">{formatEUR(f.deudaPendiente)}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${f.patrimonioConDeuda < 0 ? "text-danger" : "text-ink"}`}>
                        {formatEUR(f.patrimonioConDeuda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-ink">
                        {formatEUR(f.patrimonioSinDeuda)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

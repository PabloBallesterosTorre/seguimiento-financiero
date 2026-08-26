import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { generarMeses, generarMesesHaciaAtras, type MovimientoPrevisto } from "@/lib/prevision";
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
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";

const HORIZONTES_MESES = [3, 6, 12];
const HORIZONTES_ANIOS = [5, 10, 20];

export default async function PlanificadorPage({
  searchParams,
}: {
  searchParams: { vista?: string; horizonte?: string };
}) {
  const supabase = createClient();
  const vista = searchParams.vista === "anual" ? "anual" : "mensual";
  const horizonteElegido =
    vista === "mensual"
      ? HORIZONTES_MESES.includes(Number(searchParams.horizonte)) ? Number(searchParams.horizonte) : 12
      : HORIZONTES_ANIOS.includes(Number(searchParams.horizonte)) ? Number(searchParams.horizonte) : 10;
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
  ] = await Promise.all([
    supabase.from("cuentas").select("id, saldo_actual, es_remunerada, tipo_interes").eq("activa", true),
    supabase.from("inversiones").select("valor_actual"),
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
      .select("descripcion, categoria_id, tipo, importe, fecha")
      .in("tipo", ["ingreso", "gasto"])
      .gte("fecha", desde.toISOString().slice(0, 10)),
    supabase.from("movimientos").select("categoria_id, tipo, importe, fecha").in("tipo", ["ingreso", "gasto", "traspaso"]),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  const saldoLiquidoInicial = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const valorInversionInicial = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const deudaActual = (deudasRaw ?? []).reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);

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

  const cuentasRemuneradas = (cuentas ?? [])
    .filter((c) => c.es_remunerada && c.tipo_interes !== null)
    .map((c) => ({ id: c.id, saldo_actual: Number(c.saldo_actual), tipo_interes: Number(c.tipo_interes) }));

  const previstos = (previstosRaw ?? []) as unknown as MovimientoPrevisto[];
  const categoriaEsInversion = new Map((categorias ?? []).map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) =>
    categoriaId !== null && categoriaEsInversion.get(categoriaId) === true;

  const categoriaPadreId = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const historico = (historicoRaw ?? []) as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historico, categoriaEfectiva);

  const idsMovimientosReales = previstos.map((p) => p.movimiento_real_id).filter((id): id is string => Boolean(id));
  const { data: movimientosVinculados } =
    idsMovimientosReales.length > 0
      ? await supabase.from("movimientos").select("id, fecha").in("id", idsMovimientosReales)
      : { data: [] as { id: string; fecha: string }[] };
  const fechaPorMovimientoReal = new Map((movimientosVinculados ?? []).map((m) => [m.id, m.fecha]));

  const meses = generarMeses(horizonteMeses);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    meses,
    mediaPorCategoria,
    fechaPorMovimientoReal
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
    fechaPorMovimientoReal,
  });

  const historicoCompleto = (historicoCompletoRaw ?? []) as {
    categoria_id: string | null;
    tipo: "ingreso" | "gasto" | "traspaso";
    importe: number;
    fecha: string;
  }[];
  const primeraFecha = historicoCompleto.reduce(
    (min, m) => (min === null || m.fecha < min ? m.fecha : min),
    null as string | null
  );

  const mesesPasadosSolicitados = generarMesesHaciaAtras(horizonteMeses);
  const mesesPasadosDisponibles = primeraFecha
    ? mesesPasadosSolicitados.filter(
        (m) => `${m.year}-${String(m.month).padStart(2, "0")}` >= primeraFecha.slice(0, 7)
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
        })
      : [];

  const puntos = [...puntosHistoricos, ...puntosFuturos];
  const indiceMesActual = puntosHistoricos.length;
  const filasAnuales = vista === "anual" ? agruparPorAnio(puntos) : [];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Planificador</h1>
          <Link href="/prevision" className="text-sm text-slate-500 hover:text-slate-900">
            Ver previsión de flujo →
          </Link>
        </div>
        <p className="text-sm text-slate-400">
          Evolución de líquido, deuda e inversión, hacia atrás (reconstruido a partir de tu
          histórico real) y hacia adelante (previsión de flujo de caja, calendario de amortización
          e intereses de cuentas remuneradas). El horizonte elegido aplica en ambas direcciones.
          Para los meses pasados, la inversión es lo aportado hasta esa fecha (coste, no el valor
          de mercado histórico, que no se registra); para hoy y los meses futuros, es el valor real
          de hoy más las aportaciones previstas — no se asume ninguna rentabilidad futura. Un
          previsto ya vinculado a un movimiento real de este mes no se suma también como previsión
          — el saldo de hoy ya lo incluye.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Hoy — patrimonio real</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Real</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <p className="text-xs text-slate-500">Líquido</p>
              <p className="text-sm font-medium">{formatEUR(saldoLiquidoInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Inversión</p>
              <p className="text-sm font-medium">{formatEUR(valorInversionInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Deuda pendiente</p>
              <p className="text-sm font-medium">{formatEUR(deudaActual)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Patrimonio con deuda</p>
              <p className="text-sm font-medium">{formatEUR(saldoLiquidoInicial + valorInversionInicial - deudaActual)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Patrimonio sin deuda</p>
              <p className="text-sm font-medium">{formatEUR(saldoLiquidoInicial + valorInversionInicial)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">Real</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Mixto</span>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">Proyección</span>
            <p className="text-sm text-slate-500">
              histórico real, el mes en curso (real + lo que falta) o previsión futura
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-slate-300 text-sm">
              <Link
                href={`/planificador?vista=mensual`}
                className={`px-3 py-1.5 rounded-l-md ${vista === "mensual" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                Mensual
              </Link>
              <Link
                href={`/planificador?vista=anual`}
                className={`px-3 py-1.5 rounded-r-md ${vista === "anual" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                Anual
              </Link>
            </div>
            <div className="flex rounded-md border border-slate-300 text-sm">
              {(vista === "mensual" ? HORIZONTES_MESES : HORIZONTES_ANIOS).map((h, idx, arr) => (
                <Link
                  key={h}
                  href={`/planificador?vista=${vista}&horizonte=${h}`}
                  className={`px-3 py-1.5 ${horizonteElegido === h ? "bg-slate-900 text-white" : "hover:bg-slate-100"} ${
                    idx === 0 ? "rounded-l-md" : idx === arr.length - 1 ? "rounded-r-md" : ""
                  }`}
                >
                  {h} {vista === "mensual" ? "meses" : "años"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium"></th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">{vista === "mensual" ? "Mes" : "Año"}</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {vista === "mensual" ? "Flujo neto" : "Flujo neto anual"}
                </th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Líquido</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Inversión</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Deuda pendiente</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Patrimonio (con deuda)</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-medium">Patrimonio (sin deuda)</th>
              </tr>
            </thead>
            <tbody>
              {vista === "mensual"
                ? puntos.map((p, i) => {
                    const esMesActual = i === indiceMesActual;
                    return (
                    <tr
                      key={`${p.year}-${p.month}`}
                      className={`border-t border-slate-100 ${p.esReal ? "" : "bg-sky-50/40"}`}
                    >
                      <td className="whitespace-nowrap px-2 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.esReal
                              ? "bg-slate-100 text-slate-500"
                              : esMesActual
                                ? "bg-amber-100 text-amber-700"
                                : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {p.esReal ? "Real" : esMesActual ? "Mixto" : "Proy."}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{p.label}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right ${
                          p.flujoNeto >= 0 ? "text-emerald-600" : "text-slate-900"
                        }`}
                      >
                        {formatEUR(p.flujoNeto)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(p.saldoLiquido)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(p.valorInversion)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(p.deudaPendiente)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(p.patrimonioConDeuda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(p.patrimonioSinDeuda)}
                      </td>
                    </tr>
                    );
                  })
                : filasAnuales.map((f) => (
                    <tr key={f.year} className={`border-t border-slate-100 ${f.esReal ? "" : "bg-sky-50/40"}`}>
                      <td className="whitespace-nowrap px-2 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            f.esReal ? "bg-slate-100 text-slate-500" : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {f.esReal ? "Real" : "Proy."}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">{f.year}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right ${
                          f.flujoNetoAnual >= 0 ? "text-emerald-600" : "text-slate-900"
                        }`}
                      >
                        {formatEUR(f.flujoNetoAnual)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(f.saldoLiquido)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(f.valorInversion)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">{formatEUR(f.deudaPendiente)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                        {formatEUR(f.patrimonioConDeuda)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
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

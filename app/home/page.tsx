import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";
import {
  construirPeriodosConciliados,
  generarMeses,
  generarMesesHaciaAtras,
  ocurrenciasEnMes,
  previstoAplicaEnMes,
  previstoYaMaterializadoEnMes,
  importeEfectivoPrevisto,
  type MovimientoPrevisto,
  type CategoriaInfo,
} from "@/lib/prevision";
import { calcularInteresesPrevistos } from "@/lib/intereses";
import { mapaMediaPorCategoria, type MovimientoHistorico } from "@/lib/deteccionPatrones";
import {
  construirHistoricoPatrimonio,
  construirProyeccionPatrimonio,
  type DeudaParaHistorico,
  type DeudaParaProyeccion,
  type AmortizacionProgramadaDeuda,
  type PuntoProyeccion,
  type MovimientoParaHistorico,
} from "@/lib/planificador";
import { ahorroDelMes, type MovimientoParaInforme } from "@/lib/informes";
import { KpiDineroDisponible } from "@/app/informes/KpiDineroDisponible";
import { FlujoMensualDisponible, type MesAhorroHome } from "./FlujoMensualDisponible";

const MESES_PASADOS = 6;
const MESES_FUTUROS = 6;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { sinDeuda?: string };
}) {
  const supabase = createClient();
  const conDeuda = searchParams.sinDeuda !== "1";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoy = new Date().toISOString().slice(0, 10);

  const [
    { data: cuentas },
    { data: inversiones },
    { data: deudasRaw },
    { data: amortizacionesFuturasRaw },
    { data: amortizacionesAplicadasRaw },
    { data: previstosRaw },
    { data: categoriasRaw },
    { data: historicoCompletoRaw },
    config,
    { data: conciliacionesRaw },
  ] = await Promise.all([
    supabase.from("cuentas").select("id, saldo_actual, es_remunerada, tipo_interes").eq("activa", true),
    supabase.from("inversiones").select("valor_actual"),
    supabase
      .from("deudas")
      .select("id, capital_inicial, capital_pendiente, cuota, tipo_interes, valor_residual, fecha_inicio"),
    supabase
      .from("amortizaciones_extra")
      .select("deuda_id, fecha, importe, tipo_reduccion")
      .eq("aplicado", false)
      .gt("fecha", hoy),
    supabase.from("amortizaciones_extra").select("deuda_id, fecha, importe, tipo_reduccion").eq("aplicado", true),
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("categorias").select("id, nombre, categoria_padre_id, es_categoria_inversion"),
    supabase.from("movimientos").select("categoria_id, tipo, importe, fecha, descripcion"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    supabase.from("previsto_conciliaciones").select("previsto_id, periodo"),
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const objetivoAhorroMensual = config?.objetivo_ahorro_mensual ?? null;
  const incluirInversionEnAhorro = config?.incluir_inversion_en_ahorro ?? true;

  const totalCuentas = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const totalInversion = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const totalDeuda = (deudasRaw ?? []).reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);
  const patrimonio = totalCuentas + totalInversion - (conDeuda ? totalDeuda : 0);

  const deudasHistorico: DeudaParaHistorico[] = (deudasRaw ?? []).map((d) => ({
    id: d.id,
    capital_inicial: Number(d.capital_inicial),
    fecha_inicio: d.fecha_inicio,
    cuota: Number(d.cuota),
    tipo_interes: d.tipo_interes === null ? null : Number(d.tipo_interes),
    valor_residual: Number(d.valor_residual ?? 0),
  }));
  const deudasFuturo: DeudaParaProyeccion[] = (deudasRaw ?? []).map((d) => ({
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
  const categorias = (categoriasRaw ?? []) as (CategoriaInfo & { es_categoria_inversion: boolean })[];
  const categoriaPadreId = new Map(categorias.map((c) => [c.id, c.categoria_padre_id]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const categoriaEsInversion = new Map(categorias.map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) =>
    categoriaId !== null && categoriaEsInversion.get(categoriaId) === true;

  const historicoCompleto = (historicoCompletoRaw ?? []) as MovimientoParaInforme[];
  const historicoParaMedia = historicoCompleto.filter((m) => m.tipo !== "traspaso") as unknown as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historicoParaMedia, categoriaEfectiva);

  const periodosConciliados = construirPeriodosConciliados(conciliacionesRaw ?? []);

  const primeraFecha = historicoCompleto.reduce(
    (min, m) => (min === null || m.fecha < min ? m.fecha : min),
    null as string | null
  );

  const mesesPasadosSolicitados = generarMesesHaciaAtras(MESES_PASADOS);
  const mesesPasadosDisponibles = primeraFecha
    ? mesesPasadosSolicitados.filter((m) => `${m.year}-${String(m.month).padStart(2, "0")}` >= primeraFecha.slice(0, 7))
    : [];

  const mesesFuturos = generarMeses(MESES_FUTUROS);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    mesesFuturos,
    mediaPorCategoria,
    periodosConciliados
  );

  const saldoLiquidoInicial = totalCuentas;
  const valorInversionInicial = totalInversion;

  const puntosHistoricos: PuntoProyeccion[] =
    mesesPasadosDisponibles.length > 0
      ? construirHistoricoPatrimonio({
          meses: mesesPasadosDisponibles,
          movimientos: historicoCompleto as unknown as MovimientoParaHistorico[],
          saldoLiquidoActual: saldoLiquidoInicial,
          deudas: deudasHistorico,
          amortizacionesAplicadasPorDeuda,
          esCategoriaInversion,
        })
      : [];

  const puntosFuturos = construirProyeccionPatrimonio({
    meses: mesesFuturos,
    fechaInicio: hoy,
    saldoLiquidoInicial,
    valorInversionInicial,
    previstos,
    interesesPorMes,
    deudas: deudasFuturo,
    amortizacionesProgramadas,
    esCategoriaInversion,
    mediaPorCategoria,
    periodosConciliados,
  });

  const puntos = [...puntosHistoricos, ...puntosFuturos];

  // ---- Liquidez (mismo cálculo que el KPI 8.1 de Informes) ----
  const patrimonioHoy = saldoLiquidoInicial + valorInversionInicial;
  const patrimonioMesAnterior = puntosHistoricos.at(-1)?.patrimonioSinDeuda ?? null;
  const variacionLiquidez =
    patrimonioMesAnterior === null
      ? null
      : {
          abs: patrimonioHoy - patrimonioMesAnterior,
          pct:
            patrimonioMesAnterior !== 0
              ? ((patrimonioHoy - patrimonioMesAnterior) / Math.abs(patrimonioMesAnterior)) * 100
              : 0,
        };
  const miniSerieLiquidez = [
    ...puntosHistoricos.map((p) => ({ label: p.label, valor: p.patrimonioSinDeuda })),
    { label: "Hoy", valor: patrimonioHoy },
  ];

  // ---- Flujo mensual disponible: ahorro real/previsto de cada mes, con el mismo
  // criterio (incluir_inversion_en_ahorro) que el resto de la app ----
  function aportacionInversionMesHistorico(mesLabel: string) {
    return historicoCompleto
      .filter((m) => m.fecha.slice(0, 7) === mesLabel && m.tipo === "gasto" && esCategoriaInversion(m.categoria_id))
      .reduce((suma, m) => suma + Math.abs(Number(m.importe)), 0);
  }

  function aportacionInversionMesPrevisto(year: number, month: number) {
    let suma = 0;
    for (const p of previstos) {
      if (p.tipo !== "gasto" || !esCategoriaInversion(p.categoria_id)) continue;
      if (!previstoAplicaEnMes(p, year, month)) continue;
      if (previstoYaMaterializadoEnMes(p.id, year, month, periodosConciliados)) continue;
      suma += importeEfectivoPrevisto(p, mediaPorCategoria) * ocurrenciasEnMes(p, year, month);
    }
    return suma;
  }

  const ahorroPorMes: MesAhorroHome[] = puntos.map((p) => {
    const mesLabel = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const aportacionInversion = p.esReal
      ? aportacionInversionMesHistorico(mesLabel)
      : aportacionInversionMesPrevisto(p.year, p.month);
    const ahorro = ahorroDelMes(p.flujoNeto, aportacionInversion, incluirInversionEnAhorro);
    return { label: p.label, esReal: p.esReal, ahorro };
  });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Patrimonio global</h1>
          <div className="flex rounded-md border border-slate-300 text-sm">
            <Link
              href="/home"
              className={`px-3 py-1.5 rounded-l-md ${conDeuda ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Con deuda
            </Link>
            <Link
              href="/home?sinDeuda=1"
              className={`px-3 py-1.5 rounded-r-md ${!conDeuda ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            >
              Sin deuda
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">Patrimonio total</p>
          <p className="mt-1 text-3xl font-semibold">{formatMoneda(patrimonio, moneda)}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
          <KpiDineroDisponible
            moneda={moneda}
            valor={patrimonioHoy}
            variacion={variacionLiquidez}
            miniSerie={miniSerieLiquidez}
            titulo="Liquidez"
          />
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Inversión</p>
            <p className="mt-1 text-lg font-medium">{formatMoneda(totalInversion, moneda)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Deuda pendiente</p>
            <p className="mt-1 text-lg font-medium">{formatMoneda(totalDeuda, moneda)}</p>
          </div>
        </div>

        <FlujoMensualDisponible moneda={moneda} datos={ahorroPorMes} objetivo={objetivoAhorroMensual} />

        <p className="text-sm text-slate-400">
          El objetivo de ahorro se edita desde{" "}
          <Link href="/configuracion" className="underline">
            Configuración
          </Link>
          . El detalle de cuentas está en{" "}
          <Link href="/cuentas" className="underline">
            Cuentas
          </Link>
          , y más informes en{" "}
          <Link href="/informes" className="underline">
            Informes
          </Link>
          .
        </p>
      </main>
    </>
  );
}

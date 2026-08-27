import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  construirPeriodosConciliados,
  generarMeses,
  generarMesesHaciaAtras,
  ocurrenciasEnMes,
  previstoAplicaEnMes,
  previstoYaMaterializadoEnMes,
  importeEfectivoPrevisto,
  construirDiagnosticoPrevision,
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
import {
  agruparPorCategoriaPadreYMes,
  mediaPorCategoriaEnRango,
  previstoVsRealPorCategoria,
  type MovimientoParaInforme,
} from "@/lib/informes";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { rentabilidadPonderada } from "@/lib/inversiones";
import { InformesClient, type MesFlujo, type CategoriaMedia, type SerieCategoria, type FilaComparativa } from "./InformesClient";

const RANGOS = ["6", "12", "todos"] as const;
type Rango = (typeof RANGOS)[number];

export default async function InformesPage({ searchParams }: { searchParams: { rango?: string } }) {
  const supabase = createClient();
  const rango: Rango = RANGOS.includes(searchParams.rango as Rango) ? (searchParams.rango as Rango) : "12";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoy = new Date().toISOString().slice(0, 10);
  const hoyDate = new Date();
  const mesActualLabel = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, "0")}`;

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
    supabase.from("inversiones").select("valor_actual, rentabilidad_anual_asumida"),
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

  const saldoLiquidoInicial = (cuentas ?? []).reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const valorInversionInicial = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const rentabilidadAsumida = rentabilidadPonderada(
    (inversiones ?? []).map((i) => ({
      valor_actual: Number(i.valor_actual ?? 0),
      rentabilidad_anual_asumida: i.rentabilidad_anual_asumida !== null ? Number(i.rentabilidad_anual_asumida) : null,
    }))
  );

  const deudasHistorico: DeudaParaHistorico[] = (deudasRaw ?? []).map((d) => ({
    id: d.id,
    capital_inicial: Number(d.capital_inicial),
    capital_pendiente: Number(d.capital_pendiente),
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
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const categoriaPadreId = new Map(categorias.map((c) => [c.id, c.categoria_padre_id]));
  const categoriaEfectiva = (id: string) => categoriaPadreId.get(id) ?? id;
  const categoriaEsInversion = new Map(categorias.map((c) => [c.id, c.es_categoria_inversion === true]));
  const esCategoriaInversion = (categoriaId: string | null) =>
    categoriaId !== null && categoriaEsInversion.get(categoriaId) === true;

  const historicoCompleto = (historicoCompletoRaw ?? []) as MovimientoParaInforme[];
  const historicoParaMedia = historicoCompleto.filter((m) => m.tipo !== "traspaso") as unknown as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historicoParaMedia, categoriaEfectiva);

  const periodosConciliados = construirPeriodosConciliados(conciliacionesRaw ?? []);

  // ---- Horizonte: rango de histórico elegido (limitado a los datos disponibles) + previsión que le sigue ----
  const rangoMesesPasados = rango === "todos" ? 240 : Number(rango);
  const futuroMeses = rango === "todos" ? 12 : Number(rango);

  const primeraFecha = historicoCompleto.reduce(
    (min, m) => (min === null || m.fecha < min ? m.fecha : min),
    null as string | null
  );

  const mesesPasadosSolicitados = generarMesesHaciaAtras(rangoMesesPasados);
  const mesesPasadosDisponibles = primeraFecha
    ? mesesPasadosSolicitados.filter((m) => `${m.year}-${String(m.month).padStart(2, "0")}` >= primeraFecha.slice(0, 7))
    : [];

  const mesesFuturos = generarMeses(futuroMeses);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    mesesFuturos,
    mediaPorCategoria,
    periodosConciliados
  );

  const puntosHistoricos: PuntoProyeccion[] =
    mesesPasadosDisponibles.length > 0
      ? construirHistoricoPatrimonio({
          meses: mesesPasadosDisponibles,
          movimientos: historicoCompleto as unknown as MovimientoParaHistorico[],
          saldoLiquidoActual: saldoLiquidoInicial,
          deudas: deudasHistorico,
          amortizacionesAplicadasPorDeuda,
          esCategoriaInversion,
          hoy,
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
    rentabilidadAnualAsumidaInversion: rentabilidadAsumida,
  });

  const puntos = [...puntosHistoricos, ...puntosFuturos];

  // ---- 8.1 KPI dinero disponible ----
  // Principio transversal (tanda 6, mejora 5): sin un mes anterior real con el que
  // comparar, no se inventa una variación de 0% — se comunica explícitamente que no
  // hay periodo anterior disponible.
  const patrimonioHoy = saldoLiquidoInicial + valorInversionInicial;
  const patrimonioMesAnterior = puntosHistoricos.at(-1)?.patrimonioSinDeuda ?? null;
  const variacion =
    patrimonioMesAnterior === null
      ? null
      : {
          abs: patrimonioHoy - patrimonioMesAnterior,
          pct:
            patrimonioMesAnterior !== 0
              ? ((patrimonioHoy - patrimonioMesAnterior) / Math.abs(patrimonioMesAnterior)) * 100
              : 0,
        };
  const miniSerie = [
    ...puntosHistoricos.slice(-11).map((p) => ({ label: p.label, valor: p.patrimonioSinDeuda })),
    { label: "Hoy", valor: patrimonioHoy },
  ];

  // ---- Desglose ingreso/gasto mes a mes (8.2) ----
  function desgloseMesHistorico(mesLabel: string) {
    let ingresos = 0;
    let gastos = 0;
    for (const m of historicoCompleto) {
      if (m.fecha.slice(0, 7) !== mesLabel || m.tipo === "traspaso") continue;
      const importe = Number(m.importe);
      if (m.tipo === "ingreso") ingresos += importe;
      else gastos += importe;
    }
    return { ingresos, gastos };
  }

  function desgloseMesPrevisto(year: number, month: number) {
    let ingresos = 0;
    let gastos = 0;
    for (const p of previstos) {
      if (p.tipo === "traspaso") continue;
      if (!previstoAplicaEnMes(p, year, month)) continue;
      if (previstoYaMaterializadoEnMes(p.id, year, month, periodosConciliados)) continue;
      const importe = importeEfectivoPrevisto(p, mediaPorCategoria) * ocurrenciasEnMes(p, year, month);
      if (p.tipo === "ingreso") ingresos += importe;
      else gastos += -importe;
    }
    ingresos += interesesPorMes.get(`${year}-${month}`) ?? 0;
    return { ingresos, gastos };
  }

  const flujoPorMes: MesFlujo[] = puntos.map((p) => {
    const mesLabel = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const desglose = p.esReal ? desgloseMesHistorico(mesLabel) : desgloseMesPrevisto(p.year, p.month);
    return { label: p.label, esReal: p.esReal, ingresos: desglose.ingresos, gastos: desglose.gastos, neto: p.flujoNeto };
  });

  // ---- 8.3 y 8.4: agregaciones por categoría, solo histórico real (incluye el mes en curso hasta hoy) ----
  const mesesParaCategoria = [...mesesPasadosDisponibles, { year: hoyDate.getFullYear(), month: hoyDate.getMonth() + 1, label: "" }];
  const finRango = `${mesActualLabel}-31`;
  const inicioRango = mesesParaCategoria[0] ? `${mesesParaCategoria[0].year}-${String(mesesParaCategoria[0].month).padStart(2, "0")}-01` : "0000-00-00";
  const historicoEnRango = historicoCompleto.filter((m) => m.fecha >= inicioRango && m.fecha <= finRango);

  const gastoPorCategoriaYMes = agruparPorCategoriaPadreYMes(historicoEnRango, "gasto", categoriaEfectiva);
  const ingresoPorCategoriaYMes = agruparPorCategoriaPadreYMes(historicoEnRango, "ingreso", categoriaEfectiva);

  const mediaGasto: CategoriaMedia[] = mediaPorCategoriaEnRango(gastoPorCategoriaYMes, mesesParaCategoria.length).map(
    (m) => ({ nombre: nombreCategoria.get(m.categoriaId) ?? "Sin categoría", media: m.media })
  );
  const mediaIngreso: CategoriaMedia[] = mediaPorCategoriaEnRango(ingresoPorCategoriaYMes, mesesParaCategoria.length).map(
    (m) => ({ nombre: nombreCategoria.get(m.categoriaId) ?? "Sin categoría", media: m.media })
  );
  // La media ya se divide entre mesesParaCategoria.length (meses reales con datos, no el
  // rango nominal elegido) — se expone aquí solo para que la interfaz lo comunique.
  const mesesUsadosParaMedia = mesesParaCategoria.length;

  const etiquetasMeses = mesesParaCategoria.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`);
  const seriesGasto: SerieCategoria[] = Array.from(gastoPorCategoriaYMes.entries()).map(([categoriaId, porMes]) => ({
    nombre: nombreCategoria.get(categoriaId) ?? "Sin categoría",
    valores: etiquetasMeses.map((mesKey) => porMes.get(mesKey) ?? 0),
  }));

  // ---- 8.5: previsto vs. real, último mes cerrado (el anterior al actual) ----
  const ultimoMesCerrado = mesesPasadosDisponibles.at(-1) ?? null;
  let comparativa: FilaComparativa[] = [];
  let etiquetaMesCerrado = "";
  if (ultimoMesCerrado) {
    etiquetaMesCerrado = ultimoMesCerrado.label;
    const filasDiagnostico = construirDiagnosticoPrevision(previstos, [ultimoMesCerrado], categorias, new Map(), mediaPorCategoria);
    const previstoPorCategoria = new Map(
      filasDiagnostico.filter((f) => f.importesPorMes[0] < 0).map((f) => [f.categoriaId, Math.abs(f.importesPorMes[0])])
    );
    const mesLabelCerrado = `${ultimoMesCerrado.year}-${String(ultimoMesCerrado.month).padStart(2, "0")}`;
    const realDelMes = historicoCompleto.filter((m) => m.fecha.slice(0, 7) === mesLabelCerrado);
    const realPorCategoria = new Map(
      Array.from(agruparPorCategoriaPadreYMes(realDelMes, "gasto", categoriaEfectiva).entries()).map(([id, porMes]) => [
        id,
        Array.from(porMes.values()).reduce((s, v) => s + v, 0),
      ])
    );
    comparativa = previstoVsRealPorCategoria(previstoPorCategoria, realPorCategoria)
      .map((f) => ({ nombre: nombreCategoria.get(f.categoriaId) ?? "Categoría eliminada", previsto: f.previsto, real: f.real }))
      .sort((a, b) => b.real - a.real);
  }

  // ---- 8.6: patrimonio neto y deuda pendiente ----
  const patrimonioYDeuda = puntos.map((p) => ({
    label: p.label,
    esReal: p.esReal,
    patrimonio: p.patrimonioConDeuda,
    deuda: p.deudaPendiente,
  }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Informes</h1>
          <Link href="/planificador" className="text-[13px] font-semibold text-accent hover:underline">
            Ver Planificador →
          </Link>
        </div>

        <div className="flex w-fit rounded-full bg-chip p-1 text-sm">
          {RANGOS.map((r) => (
            <Link
              key={r}
              href={`/informes?rango=${r}`}
              className={`rounded-full px-[18px] py-2.5 text-sm font-semibold transition-colors ${
                rango === r ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {r === "todos" ? "Todo el histórico" : `Últimos ${r} meses`}
            </Link>
          ))}
        </div>

        <InformesClient
          moneda={moneda}
          patrimonioHoy={patrimonioHoy}
          variacion={variacion}
          miniSerie={miniSerie}
          flujoPorMes={flujoPorMes}
          mediaGasto={mediaGasto}
          mediaIngreso={mediaIngreso}
          mesesUsadosParaMedia={mesesUsadosParaMedia}
          seriesGastoPorCategoria={seriesGasto}
          etiquetasMeses={mesesParaCategoria.map((m) => m.label || "Hoy")}
          comparativa={comparativa}
          etiquetaMesCerrado={etiquetaMesCerrado}
          patrimonioYDeuda={patrimonioYDeuda}
        />
      </main>
    </>
  );
}

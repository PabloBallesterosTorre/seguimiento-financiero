import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  construirPeriodosConciliados,
  contarConciliacionesPorMes,
  generarMeses,
  generarMesesHaciaAtras,
  ocurrenciasPendientesEnMes,
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
import {
  filtrarMovimientosPorCuentasSeleccionadas,
  resolverCuentasSeleccionadas,
  type MovimientoParaInforme,
  netoPorCategoria,
  separarGastosEIngresos,
  SIN_CATEGORIA,
} from "@/lib/informes";
import { obtenerConfiguracion, obtenerOpcionesMesFinanciero } from "@/lib/configuracion";
import { mesDe, inicioMesFinanciero, finMesFinanciero, descripcionMes } from "@/lib/mesFinanciero";
import { rentabilidadPonderada } from "@/lib/inversiones";
import { SelectorAmbito, type Ambito } from "@/components/SelectorAmbito";
import { SelectorCuentas } from "@/components/SelectorCuentas";
import { InformesClient, type MesFlujo } from "./InformesClient";

const RANGOS = ["6", "12", "todos"] as const;
type Rango = (typeof RANGOS)[number];

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; cuentas?: string; ambito?: string; mes?: string }>;
}) {
  const { rango: rangoParam, cuentas: cuentasParam, ambito: ambitoParam, mes: mesParam } = await searchParams;
  // Mes concreto para el desglose de "en qué se va y de dónde viene". Vacío = todo el rango.
  const mesDesglose = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : null;
  const ambito: Ambito = ambitoParam === "personal" || ambitoParam === "conjunto" ? ambitoParam : "todo";
  const supabase = await createClient();
  const rango: Rango = RANGOS.includes(rangoParam as Rango) ? (rangoParam as Rango) : "12";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoy = new Date().toISOString().slice(0, 10);
  const hoyDate = new Date();

  const [
    { data: cuentas },
    { data: inversiones },
    { data: deudasRaw },
    { data: amortizacionesFuturasRaw },
    { data: amortizacionesAplicadasRaw },
    { data: previstosRaw },
    { data: categoriasRaw },
    { data: historicoCompletoRaw },
    { data: valoracionesInversionRaw },
    { data: operacionesInversionRaw },
    config,
    { data: conciliacionesRaw },
  ] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, banco_nombre, saldo_actual, es_remunerada, tipo_interes, ambito")
      .eq("activa", true),
    supabase.from("inversiones").select("valor_actual, rentabilidad_anual_asumida, cuenta_id"),
    supabase
      .from("deudas")
      .select("id, capital_inicial, capital_pendiente, cuota, tipo_interes, valor_residual, fecha_inicio, ambito"),
    supabase
      .from("amortizaciones_extra")
      .select("deuda_id, fecha, importe, tipo_reduccion")
      .eq("aplicado", false)
      .gt("fecha", hoy),
    supabase.from("amortizaciones_extra").select("deuda_id, fecha, importe, tipo_reduccion").eq("aplicado", true),
    supabase.from("movimientos_previstos").select("*"),
    supabase.from("categorias").select("id, nombre, categoria_padre_id, es_categoria_inversion"),
    supabase
      .from("movimientos")
      .select("id, cuenta_id, categoria_id, tipo, importe, fecha, descripcion, traspaso_grupo_id"),
    supabase.from("inversion_valoraciones").select("inversion_id, fecha, valor"),
    supabase.from("inversion_operaciones").select("movimiento_id").not("movimiento_id", "is", null),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    supabase.from("previsto_conciliaciones").select("previsto_id, periodo"),
  ]);

  const moneda = config?.moneda_base ?? "EUR";

  // El mes financiero: los meses van de nómina a nómina en vez del 1 al 31. Ver
  // lib/mesFinanciero.ts — sin esto, la nómina del 28 de agosto cuenta como ingreso de
  // agosto y septiembre aparece como un mes sin sueldo.
  const opcionesMes = config
    ? await obtenerOpcionesMesFinanciero(supabase, config)
    : { activo: false, diaCorte: 25, anclas: [] };
  const mesDeFecha = (fecha: string) => mesDe(fecha, opcionesMes);
  const finDeMes = (year: number, month: number) => finMesFinanciero(year, month, opcionesMes);
  const mesActualLabel = mesDeFecha(hoy);
  // El mes financiero en curso puede ir por delante del natural: a partir del día en que
  // entra la nómina ya se está viviendo el mes siguiente. Ancla tanto el histórico como la
  // previsión, para que el último mes cerrado sea de verdad el último cerrado.
  const mesActualYear = Number(mesActualLabel.slice(0, 4));
  const mesActualMonth = Number(mesActualLabel.slice(5, 7));
  const mesEnCurso = { year: mesActualYear, month: mesActualMonth };

  const idsCuentasActivas = (cuentas ?? []).map((c) => c.id);

  // Al elegir un ámbito concreto manda el ámbito y se ignora la preferencia de cuentas
  // excluidas: si pides ver el conjunto, quieres el conjunto entero, no el conjunto menos
  // lo que habías escondido del resumen global. En "Todo" se respeta la preferencia.
  const idsDelAmbito = (cuentas ?? []).filter((c) => (c.ambito ?? "personal") === ambito).map((c) => c.id);
  const cuentasSeleccionadas =
    ambito === "todo"
      ? resolverCuentasSeleccionadas(
          idsCuentasActivas,
          cuentasParam,
          config?.cuentas_excluidas_informes ?? []
        )
      : new Set(idsDelAmbito);
  const cuentasFiltradas = (cuentas ?? []).filter((c) => cuentasSeleccionadas.has(c.id));

  // La inversión hereda el ámbito de la cuenta donde está custodiada; sin cuenta asignada
  // se considera personal. Sin esto, la vista de Conjunto sumaba la cartera entera —que es
  // personal— a las cuentas compartidas, y el "dinero disponible" salía inflado.
  const ambitoDeCuenta = new Map((cuentas ?? []).map((c) => [c.id, (c.ambito ?? "personal") as Ambito]));
  const inversionesDelAmbito = (inversiones ?? []).filter((i) => {
    if (ambito === "todo") return true;
    const suyo = i.cuenta_id ? ambitoDeCuenta.get(i.cuenta_id) ?? "personal" : "personal";
    return suyo === ambito;
  });

  const saldoLiquidoInicial = cuentasFiltradas.reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const valorInversionInicial = inversionesDelAmbito.reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const rentabilidadAsumida = rentabilidadPonderada(
    inversionesDelAmbito.map((i) => ({
      valor_actual: Number(i.valor_actual ?? 0),
      rentabilidad_anual_asumida: i.rentabilidad_anual_asumida !== null ? Number(i.rentabilidad_anual_asumida) : null,
    }))
  );

  // La deuda, como la inversión, solo cuenta en su ámbito: en la vista de Conjunto la
  // hipoteca a nombre propio no es deuda compartida.
  const deudasDelAmbito = (deudasRaw ?? []).filter(
    (d) => ambito === "todo" || (d.ambito ?? "personal") === ambito
  );

  const deudasHistorico: DeudaParaHistorico[] = deudasDelAmbito.map((d) => ({
    id: d.id,
    capital_inicial: Number(d.capital_inicial),
    capital_pendiente: Number(d.capital_pendiente),
    fecha_inicio: d.fecha_inicio,
    cuota: Number(d.cuota),
    tipo_interes: d.tipo_interes === null ? null : Number(d.tipo_interes),
    valor_residual: Number(d.valor_residual ?? 0),
  }));
  const deudasFuturo: DeudaParaProyeccion[] = deudasDelAmbito.map((d) => ({
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

  const cuentasRemuneradas = cuentasFiltradas
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

  const historicoCompleto = filtrarMovimientosPorCuentasSeleccionadas(
    (historicoCompletoRaw ?? []) as (MovimientoParaInforme & { cuenta_id: string; traspaso_grupo_id: string | null })[],
    cuentasSeleccionadas
  );
  const historicoParaMedia = historicoCompleto as unknown as MovimientoHistorico[];
  const mediaPorCategoria = mapaMediaPorCategoria(historicoParaMedia, categoriaEfectiva);

  const conNombre = (f: { categoriaId: string; neto: number; salidas: number; entradas: number; movimientosContrarios: number }) => ({
    nombre: f.categoriaId === SIN_CATEGORIA ? "Sin categorizar" : nombreCategoria.get(f.categoriaId) ?? "Sin categoría",
    neto: f.neto,
    salidas: f.salidas,
    entradas: f.entradas,
    movimientosContrarios: f.movimientosContrarios,
  });

  const periodosConciliados = construirPeriodosConciliados(conciliacionesRaw ?? [], mesDeFecha);
  // Por OCURRENCIAS, no por mes: los previstos semanales (las aportaciones a inversión)
  // no deben darse por cumplidos enteros al conciliar una sola semana.
  const conciliacionesPorMes = contarConciliacionesPorMes(conciliacionesRaw ?? [], mesDeFecha);
  // Categorías que ya tienen movimiento real en cada mes financiero. Es lo que hace que un
  // presupuesto de categoría deje de aportar en el mes en curso: ese mes ya vale lo real.
  const categoriasConMovimiento = new Set(
    historicoCompleto
      .filter((m) => m.categoria_id)
      // Dos claves por movimiento: su categoría y la de su padre. Un presupuesto sobre
      // "Ocio" lo apaga el gasto en "Restaurantes"; uno sobre "Restaurantes", solo el suyo.
      .flatMap((m) => [
        `${m.categoria_id}:${mesDeFecha(m.fecha)}`,
        `${categoriaEfectiva(m.categoria_id!)}:${mesDeFecha(m.fecha)}`,
      ])
  );

  // ---- Horizonte: rango de histórico elegido (limitado a los datos disponibles) + previsión que le sigue ----
  const rangoMesesPasados = rango === "todos" ? 240 : Number(rango);
  const futuroMeses = rango === "todos" ? 12 : Number(rango);

  const primeraFecha = historicoCompleto.reduce(
    (min, m) => (min === null || m.fecha < min ? m.fecha : min),
    null as string | null
  );

  const mesesPasadosSolicitados = generarMesesHaciaAtras(rangoMesesPasados, mesEnCurso);
  const mesesPasadosDisponibles = primeraFecha
    ? mesesPasadosSolicitados.filter((m) => `${m.year}-${String(m.month).padStart(2, "0")}` >= mesDeFecha(primeraFecha))
    : [];

  const mesesFuturos = generarMeses(futuroMeses, mesEnCurso);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    mesesFuturos,
    mediaPorCategoria,
    periodosConciliados
  );

  // Inversión histórica: las aportaciones vinculadas a una posición se valoran a mercado
  // con su última valoración conocida de cada mes; las que no lo están siguen contando a
  // coste. Ver el comentario de construirHistoricoPatrimonio.
  const valoracionesInversion = (valoracionesInversionRaw ?? []).map((v) => ({
    inversionId: v.inversion_id as string,
    fecha: v.fecha as string,
    valor: Number(v.valor),
  }));
  const movimientosVinculadosAInversion = new Set(
    (operacionesInversionRaw ?? []).map((o) => o.movimiento_id as string)
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
          valoracionesInversion,
          movimientosVinculadosAInversion,
          finDeMes,
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
    conciliacionesPorMes,
    categoriasConMovimiento,
    rentabilidadAnualAsumidaInversion: rentabilidadAsumida,
  });

  const puntos = [...puntosHistoricos, ...puntosFuturos];

  // ---- 8.1 KPI dinero disponible ----
  // Principio transversal (tanda 6, mejora 5): sin un mes anterior real con el que
  // comparar, no se inventa una variación de 0% — se comunica explícitamente que no
  // hay periodo anterior disponible.
  const patrimonioHoy = saldoLiquidoInicial + valorInversionInicial;
  const ultimoCerrado = puntosHistoricos.at(-1) ?? null;
  const fechaCierreAnterior = ultimoCerrado ? finDeMes(ultimoCerrado.year, ultimoCerrado.month) : undefined;
  const patrimonioMesAnterior = ultimoCerrado?.patrimonioSinDeuda ?? null;
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
      if (mesDeFecha(m.fecha) !== mesLabel || m.tipo === "traspaso") continue;
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
      const ocurrencias = ocurrenciasPendientesEnMes(p, year, month, {
        conciliacionesPorMes,
        categoriasConMovimiento,
      });
      if (ocurrencias === 0) continue;
      const importe = importeEfectivoPrevisto(p, mediaPorCategoria) * ocurrencias;
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
  // Se rellena hasta el mes en curso en vez de añadirlo suelto: si no, podría quedar un
  // mes sin contar entre medias y la media por categoría se dividiría entre menos meses de
  // los que abarca el rango.
  const mesesParaCategoria = [...mesesPasadosDisponibles];
  const ultimoPasado = mesesPasadosDisponibles.at(-1);
  let cursor = ultimoPasado
    ? { year: ultimoPasado.year, month: ultimoPasado.month }
    : { year: mesActualYear, month: mesActualMonth - 1 };
  while (cursor.year * 12 + cursor.month < mesActualYear * 12 + mesActualMonth) {
    cursor = cursor.month === 12 ? { year: cursor.year + 1, month: 1 } : { year: cursor.year, month: cursor.month + 1 };
    mesesParaCategoria.push({ year: cursor.year, month: cursor.month, label: "" });
  }
  const finRango = finDeMes(mesActualYear, mesActualMonth);
  const inicioRango = mesesParaCategoria[0]
    ? inicioMesFinanciero(mesesParaCategoria[0].year, mesesParaCategoria[0].month, opcionesMes)
    : "0000-00-00";
  const historicoEnRango = historicoCompleto.filter((m) => m.fecha >= inicioRango && m.fecha <= finRango);

  // "En qué se va y de dónde viene": una sola pasada neteada, en vez de dos agregaciones
  // separadas por signo.
  //
  // Antes usaba el histórico ENTERO mientras el encabezado decía "Últimos 12 meses", así que
  // el rango elegido no cambiaba nada y el rótulo mentía. Ahora respeta el rango y, si se ha
  // elegido un mes concreto, solo ese mes.
  const historicoDelDesglose = mesDesglose
    ? historicoCompleto.filter((m) => mesDeFecha(m.fecha) === mesDesglose)
    : historicoEnRango;
  const { gastos: gastosNetos, ingresos: ingresosNetos } = separarGastosEIngresos(
    netoPorCategoria(historicoDelDesglose as unknown as MovimientoParaInforme[], categoriaEfectiva)
  );

  // Meses que puede elegir el desglose: los mismos que ya se conocen del histórico, del más
  // reciente al más antiguo, porque lo habitual es mirar el mes en curso o el anterior.
  const mesesDelDesglose = [...mesesParaCategoria]
    .reverse()
    .map((m) => {
      const clave = `${m.year}-${String(m.month).padStart(2, "0")}`;
      const d = new Date(m.year, m.month - 1, 1);
      const nombre = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
      return { clave, etiqueta: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
    });

  // Se añade a los enlaces internos de la página (pestañas de rango) para que cambiar
  // de rango no pierda una selección de cuentas hecha vía URL en esta misma carga.
  const cuentasQS =
    ambito !== "todo" || cuentasSeleccionadas.size === idsCuentasActivas.length
      ? ""
      : `&cuentas=${Array.from(cuentasSeleccionadas).join(",")}`;
  const ambitoQS = ambito === "todo" ? "" : `&ambito=${ambito}`;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Informes</h1>
          <Link href="/planificador" className="text-[13px] font-semibold text-accent hover:underline">
            Ver Planificador →
          </Link>
        </div>

        <SelectorAmbito actual={ambito} queryBase={`&rango=${rango}`} />

        {ambito === "todo" && (
          <SelectorCuentas
            cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: c.nombre, banco_nombre: c.banco_nombre }))}
            seleccionadas={Array.from(cuentasSeleccionadas)}
          />
        )}

        <div className="flex w-fit rounded-full bg-chip p-1 text-sm">
          {RANGOS.map((r) => (
            <Link
              key={r}
              href={`/informes?rango=${r}${ambitoQS}${cuentasQS}`}
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
          gastosNetos={gastosNetos.map(conNombre)}
          ingresosNetos={ingresosNetos.map(conNombre)}
          etiquetaRango={rango === "todos" ? "Todo el histórico" : `Últimos ${rango} meses`}
          mesesDelDesglose={mesesDelDesglose}
          mesDesglose={mesDesglose}
          queryBaseDesglose={`rango=${rango}${ambitoQS}${cuentasQS}`}
          fechaCierreAnterior={fechaCierreAnterior}
          notaMes={
            opcionesMes.activo
              ? `Los meses van de nómina a nómina: este ${descripcionMes(mesActualYear, mesActualMonth, opcionesMes)}.`
              : undefined
          }
        />
      </main>
    </>
  );
}

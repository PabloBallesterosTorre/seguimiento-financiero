import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion, obtenerOpcionesMesFinanciero } from "@/lib/configuracion";
import { mesDe, finMesFinanciero, inicioMesFinanciero } from "@/lib/mesFinanciero";
import { formatMoneda, formatMonedaTabla } from "@/lib/formato";
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
  ahorroDelMes,
  comoVaElMes,
  filtrarMovimientosPorCuentasSeleccionadas,
  resolverCuentasSeleccionadas,
  type MovimientoParaInforme,
} from "@/lib/informes";
import { KpiDineroDisponible } from "@/app/informes/KpiDineroDisponible";
import { SelectorCuentas } from "@/components/SelectorCuentas";
import { SelectorAmbito, type Ambito } from "@/components/SelectorAmbito";
import { FlujoMensualDisponible, type MesAhorroHome } from "./FlujoMensualDisponible";
import { ComoVaElMes } from "./ComoVaElMes";

const MESES_PASADOS = 6;
const MESES_FUTUROS = 6;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ conDeuda?: string; cuentas?: string; ambito?: string }>;
}) {
  const { conDeuda: conDeudaParam, cuentas: cuentasParam, ambito: ambitoParam } = await searchParams;
  const ambito: Ambito = ambitoParam === "personal" || ambitoParam === "conjunto" ? ambitoParam : "todo";
  const supabase = await createClient();
  // La portada abre SIN deuda a propósito (auditoría de diseño, tanda 11). El patrimonio
  // con una hipoteca a 30 años dentro es un número correcto, pero enorme, rojo y que no
  // cambia de un día para otro: no es lo que quieres ver al abrir la app cada mañana. La
  // deuda sigue a un clic, y su tarjeta la enseña siempre.
  const conDeuda = conDeudaParam === "1";

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
    { data: valoracionesInversionRaw },
    { data: operacionesInversionRaw },
    config,
    { data: conciliacionesRaw },
  ] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, banco_nombre, saldo_actual, es_remunerada, tipo_interes, ambito")
      .eq("activa", true),
    supabase.from("inversiones").select("valor_actual, coste_neto, cuenta_id"),
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

  // Mismos meses que en Informes: de nómina a nómina si está activado. Si el Resumen
  // usara meses naturales y los Informes no, el mismo mes daría dos cifras distintas
  // según la pantalla, que es justo lo que no puede pasar.
  const opcionesMes = config
    ? await obtenerOpcionesMesFinanciero(supabase, config)
    : { activo: false, diaCorte: 25, anclas: [] };
  const mesDeFecha = (fecha: string) => mesDe(fecha, opcionesMes);
  const finDeMes = (year: number, month: number) => finMesFinanciero(year, month, opcionesMes);
  const mesActualLabel = mesDeFecha(hoy);
  const objetivoAhorroMensual = config?.objetivo_ahorro_mensual ?? null;
  const incluirInversionEnAhorro = config?.incluir_inversion_en_ahorro ?? true;

  const idsCuentasActivas = (cuentas ?? []).map((c) => c.id);

  // Mismo criterio que en Informes: al elegir un ámbito concreto manda el ámbito y se
  // ignora la preferencia de cuentas excluidas. Si pides ver el conjunto, quieres el
  // conjunto entero, no el conjunto menos lo que habías escondido del resumen global.
  const idsDelAmbito = (cuentas ?? []).filter((c) => (c.ambito ?? "personal") === ambito).map((c) => c.id);
  const cuentasSeleccionadas =
    ambito === "todo"
      ? resolverCuentasSeleccionadas(idsCuentasActivas, cuentasParam, config?.cuentas_excluidas_informes ?? [])
      : new Set(idsDelAmbito);
  const cuentasFiltradas = (cuentas ?? []).filter((c) => cuentasSeleccionadas.has(c.id));

  // La inversión hereda el ámbito de la cuenta donde está custodiada; sin cuenta asignada
  // se considera personal. Sin esto, la vista de Conjunto sumaría la cartera entera —que
  // es personal— al patrimonio compartido.
  const ambitoDeCuenta = new Map((cuentas ?? []).map((c) => [c.id, (c.ambito ?? "personal") as Ambito]));
  const inversionesDelAmbito = (inversiones ?? []).filter((i) => {
    if (ambito === "todo") return true;
    const suyo = i.cuenta_id ? ambitoDeCuenta.get(i.cuenta_id) ?? "personal" : "personal";
    return suyo === ambito;
  });
  const deudasDelAmbito = (deudasRaw ?? []).filter((d) => ambito === "todo" || (d.ambito ?? "personal") === ambito);

  const totalCuentas = cuentasFiltradas.reduce((sum, c) => sum + Number(c.saldo_actual ?? 0), 0);
  const totalInversion = inversionesDelAmbito.reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);
  const totalDeuda = deudasDelAmbito.reduce((sum, d) => sum + Number(d.capital_pendiente ?? 0), 0);
  // Segunda línea de las tarjetas de Inversión y Deuda: sin ella quedaban con un título y
  // un número sueltos, mucho más bajas que la de Liquidez, que lleva variación y gráfico.
  const aportadoInversion = inversionesDelAmbito.reduce((sum, i) => sum + Number(i.coste_neto ?? 0), 0);
  const gananciaInversion = totalInversion - aportadoInversion;
  const cuotaMensualDeuda = deudasDelAmbito.reduce((sum, d) => sum + Number(d.cuota ?? 0), 0);
  const patrimonio = totalCuentas + totalInversion - (conDeuda ? totalDeuda : 0);

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

  const primeraFecha = historicoCompleto.reduce(
    (min, m) => (min === null || m.fecha < min ? m.fecha : min),
    null as string | null
  );

  // El ancla es el mes financiero en curso, no el natural: así el último punto histórico
  // es siempre el último mes CERRADO, que es la referencia contra la que se compara el
  // saldo de hoy.
  const mesEnCurso = { year: Number(mesActualLabel.slice(0, 4)), month: Number(mesActualLabel.slice(5, 7)) };
  const mesesPasadosSolicitados = generarMesesHaciaAtras(MESES_PASADOS, mesEnCurso);
  const mesesPasadosDisponibles = primeraFecha
    ? mesesPasadosSolicitados.filter((m) => `${m.year}-${String(m.month).padStart(2, "0")}` >= mesDeFecha(primeraFecha))
    : [];

  const mesesFuturos = generarMeses(MESES_FUTUROS, mesEnCurso);
  const interesesPorMes = calcularInteresesPrevistos(
    cuentasRemuneradas,
    previstos,
    mesesFuturos,
    mediaPorCategoria,
    periodosConciliados
  );

  const saldoLiquidoInicial = totalCuentas;
  const valorInversionInicial = totalInversion;

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
          finDeMes,
          valoracionesInversion,
          movimientosVinculadosAInversion,
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
  });

  const puntos = [...puntosHistoricos, ...puntosFuturos];

  // ---- Liquidez ----
  // Esta tarjeta enseñaba líquido + inversión con el título "Liquidez", y justo al lado
  // había otra tarjeta de "Inversión": quien sumara las dos se equivocaba por el valor de
  // la cartera entera. Ahora enseña el líquido y solo el líquido, y la variación y la
  // mini-serie van con él en vez de con el patrimonio (auditoría de diseño, tanda 11).
  // La referencia es el CIERRE del último mes cerrado, no un día del mes en curso: con los
  // meses de nómina a nómina, agosto cierra el 27 de agosto y no el 31.
  const ultimoMesCerrado = puntosHistoricos.at(-1) ?? null;
  const fechaCierreAnterior = ultimoMesCerrado ? finDeMes(ultimoMesCerrado.year, ultimoMesCerrado.month) : undefined;
  const liquidoMesAnterior = ultimoMesCerrado?.saldoLiquido ?? null;

  // ---- "Cómo va el mes": lo acumulado desde el cierre anterior, con las dos referencias
  // del mes pasado (mismo punto y cierre). Los movimientos ya vienen filtrados por ámbito
  // y con los traspasos internos anulados.
  const inicioMesActual = inicioMesFinanciero(mesEnCurso.year, mesEnCurso.month, opcionesMes);
  const finMesActual = finDeMes(mesEnCurso.year, mesEnCurso.month);
  const datosDelMes = comoVaElMes({
    movimientos: historicoCompleto,
    inicioMesActual,
    hoy,
    inicioMesAnterior: ultimoMesCerrado
      ? inicioMesFinanciero(ultimoMesCerrado.year, ultimoMesCerrado.month, opcionesMes)
      : null,
    finMesAnterior: ultimoMesCerrado ? finDeMes(ultimoMesCerrado.year, ultimoMesCerrado.month) : null,
  });
  const variacionLiquidez =
    liquidoMesAnterior === null
      ? null
      : {
          abs: totalCuentas - liquidoMesAnterior,
          pct:
            liquidoMesAnterior !== 0 ? ((totalCuentas - liquidoMesAnterior) / Math.abs(liquidoMesAnterior)) * 100 : 0,
        };
  const miniSerieLiquidez = [
    ...puntosHistoricos.map((p) => ({ label: p.label, valor: p.saldoLiquido })),
    { label: "Hoy", valor: totalCuentas },
  ];

  // ---- Flujo mensual disponible: ahorro real/previsto de cada mes, con el mismo
  // criterio (incluir_inversion_en_ahorro) que el resto de la app ----
  function aportacionInversionMesHistorico(mesLabel: string) {
    return historicoCompleto
      .filter((m) => mesDeFecha(m.fecha) === mesLabel && m.tipo === "gasto" && esCategoriaInversion(m.categoria_id))
      .reduce((suma, m) => suma + Math.abs(Number(m.importe)), 0);
  }

  function aportacionInversionMesPrevisto(year: number, month: number) {
    let suma = 0;
    for (const p of previstos) {
      if (p.tipo !== "gasto" || !esCategoriaInversion(p.categoria_id)) continue;
      const ocurrencias = ocurrenciasPendientesEnMes(p, year, month, {
        conciliacionesPorMes,
        categoriasConMovimiento,
      });
      suma += importeEfectivoPrevisto(p, mediaPorCategoria) * ocurrencias;
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

  // Dentro de un ámbito concreto la selección de cuentas no se arrastra: la decide el
  // ámbito, así que meterla en la URL solo serviría para que al volver a "Todo" apareciera
  // filtrado por las cuentas del ámbito anterior.
  const cuentasQS =
    ambito !== "todo" || cuentasSeleccionadas.size === idsCuentasActivas.length
      ? ""
      : `&cuentas=${Array.from(cuentasSeleccionadas).join(",")}`;
  const ambitoQS = ambito === "todo" ? "" : `&ambito=${ambito}`;
  const restoQS = `${ambitoQS}${cuentasQS}`;
  const hrefSinDeuda = restoQS ? `/home?${restoQS.slice(1)}` : "/home";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-xl font-bold text-ink sm:text-[26px]">Resumen</h1>
          <div className="flex rounded-full bg-chip p-1">
            <Link
              href={hrefSinDeuda}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                !conDeuda ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              Sin deuda
            </Link>
            <Link
              href={`/home?conDeuda=1${restoQS}`}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                conDeuda ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              Con deuda
            </Link>
          </div>
        </div>

        <SelectorAmbito actual={ambito} queryBase={conDeuda ? "&conDeuda=1" : ""} ruta="/home" />

        {/* Dentro de Personal o Conjunto el ámbito ya decide las cuentas, así que el
            selector no pintaría nada: solo se ofrece en "Todo", igual que en Informes. */}
        {ambito === "todo" && (
          <SelectorCuentas
            cuentas={(cuentas ?? []).map((c) => ({ id: c.id, nombre: c.nombre, banco_nombre: c.banco_nombre }))}
            seleccionadas={Array.from(cuentasSeleccionadas)}
          />
        )}

        <div className="rounded-card border border-border bg-surface p-[22px] shadow-card sm:p-9">
          <p className="text-sm text-ink-secondary">Patrimonio</p>
          <p className={`mt-2.5 break-words font-sora text-[38px] font-bold leading-none sm:text-[56px] ${patrimonio < 0 ? "text-danger" : "text-ink"}`}>
            {formatMonedaTabla(patrimonio, moneda)}
          </p>
          <p className="mt-3.5 text-[13px] text-ink-tertiary">
            {conDeuda
              ? `Líquido más inversión, menos ${formatMoneda(totalDeuda, moneda)} de deuda pendiente.`
              : `Líquido más inversión. No descuenta ${formatMoneda(totalDeuda, moneda)} de deuda pendiente.`}
          </p>
        </div>

        <ComoVaElMes
          datos={datosDelMes}
          moneda={moneda}
          inicioMes={inicioMesActual}
          finMes={finMesActual}
          hoy={hoy}
          etiquetaMesAnterior={ultimoMesCerrado?.label ?? null}
          ambito={ambito}
        />

        {/* Mismo ancho (`grid-cols-3`, sin el 1.3fr de antes) y mismo alto: sin
            `items-start` las tres se estiran a la altura de la más alta. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <KpiDineroDisponible
            moneda={moneda}
            valor={totalCuentas}
            variacion={variacionLiquidez}
            miniSerie={miniSerieLiquidez}
            titulo="Liquidez"
            fechaCierreAnterior={fechaCierreAnterior}
          />
          <div className="flex flex-col rounded-card border border-border bg-surface p-6 shadow-card">
            <p className="text-sm text-ink-secondary">Inversión</p>
            <p className="mt-2.5 break-words font-sora text-[21px] font-bold tabular-nums text-ink sm:text-[30px]">
              {formatMonedaTabla(totalInversion, moneda)}
            </p>
            {totalInversion === 0 ? (
              <>
                <p className="mt-3 text-xs text-ink-tertiary">Sin inversiones registradas todavía.</p>
                <Link href="/inversiones" className="mt-1.5 inline-block text-xs font-semibold text-accent">
                  + Añadir inversión
                </Link>
              </>
            ) : (
              <p
                className={`mt-2 text-[13px] font-semibold tabular-nums ${
                  gananciaInversion >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {gananciaInversion >= 0 ? "+" : "−"}
                {formatMonedaTabla(Math.abs(gananciaInversion), moneda)} sobre lo aportado
              </p>
            )}
          </div>
          <div className="flex flex-col rounded-card border border-border bg-surface p-6 shadow-card">
            <p className="text-sm text-ink-secondary">Deuda pendiente</p>
            <p className="mt-2.5 break-words font-sora text-[21px] font-bold tabular-nums text-ink sm:text-[30px]">
              {formatMonedaTabla(totalDeuda, moneda)}
            </p>
            {cuotaMensualDeuda > 0 && (
              <p className="mt-2 text-[13px] tabular-nums text-ink-tertiary">
                {formatMonedaTabla(cuotaMensualDeuda, moneda)} al mes en cuotas
              </p>
            )}
            {!conDeuda && <p className="mt-1 text-[11px] font-semibold text-ink-tertiary">No descontada arriba</p>}
          </div>
        </div>

        <FlujoMensualDisponible moneda={moneda} datos={ahorroPorMes} objetivo={objetivoAhorroMensual} />

        <p className="px-1 text-[13px] text-ink-tertiary">
          El objetivo de ahorro se edita desde{" "}
          <Link href="/configuracion" className="font-semibold text-accent">
            Configuración
          </Link>
          . El detalle de cuentas está en{" "}
          <Link href="/cuentas" className="font-semibold text-accent">
            Cuentas
          </Link>
          , y más informes en{" "}
          <Link href="/informes" className="font-semibold text-accent">
            Informes
          </Link>
          .
        </p>
      </main>
    </>
  );
}
